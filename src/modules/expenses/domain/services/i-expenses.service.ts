import { Result } from '../../../../common/errors/result.mapper';
import { BaseError } from '../../../../common/errors/errors';
import { CreateExpenseDto } from '../../presentation/dtos/create-expense.dto';
import { CreateCreditCardDto } from '../../presentation/dtos/create-credit-card.dto';
import { ExpenseEntity } from '../../data/entities/expense.entity';
import { CreditCardEntity } from '../../data/entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../../data/entities/expense-installment.entity';
import { MonthlyInstallmentsSummaryDto } from '../../presentation/dtos/installment-summary.dto';

export abstract class IExpensesService {
  abstract registerExpense(dto: CreateExpenseDto): Promise<Result<ExpenseEntity>>;
  abstract getExpenseById(id: string): Promise<Result<ExpenseEntity>>;
  abstract listExpenses(limit?: number, offset?: number): Promise<Result<ExpenseEntity[]>>;
  abstract registerCreditCard(dto: CreateCreditCardDto): Promise<Result<CreditCardEntity>>;
  abstract listCreditCards(): Promise<Result<CreditCardEntity[]>>;
  abstract getMonthlyInstallmentsSummary(yearMonth: string): Promise<Result<MonthlyInstallmentsSummaryDto>>;
  abstract searchPendingInstallments(query?: string, dueDate?: string): Promise<Result<ExpenseInstallmentEntity[]>>;
  abstract payInstallment(id: string, paymentMethod?: string, bankName?: string, notes?: string): Promise<Result<ExpenseInstallmentEntity>>;
}
