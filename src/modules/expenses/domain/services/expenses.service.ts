import { Injectable, Logger } from '@nestjs/common';
import { IExpensesService } from './i-expenses.service';
import { IExpensesRepository } from '../data/repositories/i-expenses.repository';
import { Result } from '../../../common/errors/result.mapper';
import {
  BaseError,
  CouldNotSave,
  InvalidOperation,
  NotFound,
} from '../../../common/errors/errors';
import { CreateExpenseDto } from '../presentation/dtos/create-expense.dto';
import { CreateCreditCardDto } from '../presentation/dtos/create-credit-card.dto';
import { ExpenseEntity } from '../data/entities/expense.entity';
import { CreditCardEntity } from '../data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../data/entities/expense-installment.entity';
import { InstallmentPlanGenerator } from './installment-plan-generator';
import {
  InstallmentItemDto,
  MonthlyInstallmentsSummaryDto,
} from '../presentation/dtos/installment-summary.dto';
import { ExpenseMapper } from '../presentation/mappers/expense.mapper';

@Injectable()
export class ExpensesService implements IExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(private readonly expensesRepo: IExpensesRepository) {}

  async registerExpense(dto: CreateExpenseDto): Promise<Result<ExpenseEntity>> {
    try {
      let matchedCard: CreditCardEntity | null = null;

      // 1. Resolve Credit Card if provided
      if (dto.creditCardId) {
        matchedCard = await this.expensesRepo.findCreditCardById(dto.creditCardId);
        if (!matchedCard) {
          return Result.fail(new NotFound(`CreditCard with id ${dto.creditCardId}`));
        }
      } else if (dto.cardBank && dto.cardName) {
        matchedCard = await this.expensesRepo.findCreditCardByDetails(
          dto.cardBank,
          dto.cardName,
          dto.cardHolder,
        );
      }

      const totalInstallments = dto.totalInstallments && dto.totalInstallments > 1 ? dto.totalInstallments : 1;
      const isInstallment = dto.isInstallment || totalInstallments > 1;
      const intervalMonths = dto.intervalMonths && dto.intervalMonths > 0 ? dto.intervalMonths : 1;

      // 2. Generate Installments Plan if multi-installment
      const installmentsPlan: ExpenseInstallmentEntity[] = [];

      if (isInstallment) {
        const firstDueDate = dto.firstDueDate || this.calculateFirstDueDate(dto.expenseDate, matchedCard?.dueDay);
        const generated = InstallmentPlanGenerator.generate(
          dto.totalAmount,
          totalInstallments,
          firstDueDate,
          intervalMonths,
        );

        for (const item of generated) {
          const installment = new ExpenseInstallmentEntity();
          installment.installmentNumber = item.installmentNumber;
          installment.totalInstallments = item.totalInstallments;
          installment.amount = item.amount;
          installment.dueDate = item.dueDate;
          installment.status = 'PENDING';
          installmentsPlan.push(installment);
        }
      }

      // 3. Build Expense Entity
      const expense = new ExpenseEntity();
      expense.description = dto.description;
      expense.merchantName = dto.merchantName;
      expense.totalAmount = dto.totalAmount;
      expense.currency = dto.currency || 'ARS';
      expense.expenseDate = dto.expenseDate;
      expense.paymentMethod = dto.paymentMethod || (matchedCard ? 'CREDIT_CARD' : 'CASH');
      expense.creditCardId = matchedCard?.id;
      expense.creditCard = matchedCard || undefined;
      expense.isInstallment = isInstallment;
      expense.totalInstallments = totalInstallments;
      expense.intervalMonths = intervalMonths;
      expense.category = dto.category || 'GENERAL';
      expense.source = dto.source || 'MANUAL';
      expense.rawSourceText = dto.rawSourceText;
      expense.paperlessDocumentId = dto.paperlessDocumentId;
      expense.metadata = dto.metadata;
      expense.installmentsPlan = installmentsPlan;

      const saved = await this.expensesRepo.saveExpense(expense);
      this.logger.log(`Registered expense ${saved.id} - Total: ${saved.totalAmount} ${saved.currency}`);
      return Result.ok(saved);
    } catch (error: any) {
      this.logger.error(`Failed to register expense: ${error.message}`, error.stack);
      return Result.fail(new CouldNotSave('Expense', error.message));
    }
  }

  async getExpenseById(id: string): Promise<Result<ExpenseEntity>> {
    try {
      const expense = await this.expensesRepo.findExpenseById(id);
      if (!expense) {
        return Result.fail(new NotFound(`Expense with id ${id}`));
      }
      return Result.ok(expense);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async listExpenses(limit = 50, offset = 0): Promise<Result<ExpenseEntity[]>> {
    try {
      const expenses = await this.expensesRepo.findExpenses(limit, offset);
      return Result.ok(expenses);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async registerCreditCard(dto: CreateCreditCardDto): Promise<Result<CreditCardEntity>> {
    try {
      const cardEntity = ExpenseMapper.toCardEntity(dto);
      const saved = await this.expensesRepo.saveCreditCard(cardEntity);
      return Result.ok(saved);
    } catch (error: any) {
      return Result.fail(new CouldNotSave('CreditCard', error.message));
    }
  }

  async listCreditCards(): Promise<Result<CreditCardEntity[]>> {
    try {
      const cards = await this.expensesRepo.findCreditCards();
      return Result.ok(cards);
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  async getMonthlyInstallmentsSummary(yearMonth: string): Promise<Result<MonthlyInstallmentsSummaryDto>> {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return Result.fail(new InvalidOperation('yearMonth must be in YYYY-MM format'));
    }

    try {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();

      const startDate = `${yearMonth}-01`;
      const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

      const installments = await this.expensesRepo.findInstallmentsByDueDateRange(startDate, endDate);

      const items: InstallmentItemDto[] = installments.map((inst) => ({
        installmentId: inst.id,
        expenseId: inst.expenseId,
        merchantName: inst.expense?.merchantName || 'Desconocido',
        description: inst.expense?.description || '',
        installmentNumber: inst.installmentNumber,
        totalInstallments: inst.totalInstallments,
        amount: Number(inst.amount),
        dueDate: inst.dueDate,
        status: inst.status,
        cardBank: inst.expense?.creditCard?.bank,
        cardName: inst.expense?.creditCard?.cardName,
        isExtension: inst.expense?.creditCard?.isExtension,
        holderName: inst.expense?.creditCard?.holderName,
      }));

      const totalAmountDue = Math.round(
        items.reduce((sum, item) => sum + item.amount, 0) * 100,
      ) / 100;

      return Result.ok({
        month: yearMonth,
        totalAmountDue,
        installmentsCount: items.length,
        items,
      });
    } catch (error: any) {
      return Result.fail(new InvalidOperation(error.message));
    }
  }

  private calculateFirstDueDate(expenseDate: string, dueDay?: number): string {
    const [yearStr, monthStr, dayStr] = expenseDate.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // 0-based
    const day = parseInt(dayStr, 10);

    const targetDueDay = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : day;

    // Next month due date
    const nextMonthIndex = month + 1;
    const nextYear = year + Math.floor(nextMonthIndex / 12);
    const nextMonth = nextMonthIndex % 12;

    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const actualDay = Math.min(targetDueDay, daysInNextMonth);

    return new Date(Date.UTC(nextYear, nextMonth, actualDay)).toISOString().slice(0, 10);
  }
}
