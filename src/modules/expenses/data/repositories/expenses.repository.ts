import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { IExpensesRepository } from './i-expenses.repository';
import { ExpenseEntity } from '../entities/expense.entity';
import { CreditCardEntity } from '../entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../entities/expense-installment.entity';

@Injectable()
export class ExpensesRepository implements IExpensesRepository {
  constructor(
    @InjectRepository(ExpenseEntity)
    private readonly expenseRepo: Repository<ExpenseEntity>,
    @InjectRepository(CreditCardEntity)
    private readonly cardRepo: Repository<CreditCardEntity>,
    @InjectRepository(ExpenseInstallmentEntity)
    private readonly installmentRepo: Repository<ExpenseInstallmentEntity>,
  ) {}

  async saveExpense(expense: Partial<ExpenseEntity>): Promise<ExpenseEntity> {
    return this.expenseRepo.save(expense);
  }

  async findExpenseById(id: string): Promise<ExpenseEntity | null> {
    return this.expenseRepo.findOne({
      where: { id },
      relations: ['creditCard', 'installmentsPlan'],
    });
  }

  async findExpenses(limit = 50, offset = 0): Promise<ExpenseEntity[]> {
    return this.expenseRepo.find({
      order: { expenseDate: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['creditCard', 'installmentsPlan'],
    });
  }

  async findInstallmentsByDueDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ExpenseInstallmentEntity[]> {
    return this.installmentRepo.find({
      where: {
        dueDate: Between(startDate, endDate),
      },
      order: { dueDate: 'ASC' },
      relations: ['expense', 'expense.creditCard'],
    });
  }

  async findPendingInstallments(creditCardId?: string): Promise<ExpenseInstallmentEntity[]> {
    const query = this.installmentRepo
      .createQueryBuilder('inst')
      .innerJoinAndSelect('inst.expense', 'exp')
      .leftJoinAndSelect('exp.creditCard', 'card')
      .where('inst.status = :status', { status: 'PENDING' });

    if (creditCardId) {
      query.andWhere('exp.credit_card_id = :creditCardId', { creditCardId });
    }

    return query.orderBy('inst.dueDate', 'ASC').getMany();
  }

  async saveCreditCard(card: Partial<CreditCardEntity>): Promise<CreditCardEntity> {
    return this.cardRepo.save(card);
  }

  async findCreditCards(): Promise<CreditCardEntity[]> {
    return this.cardRepo.find({
      where: { isActive: true },
      order: { bank: 'ASC', cardName: 'ASC' },
    });
  }

  async findCreditCardById(id: string): Promise<CreditCardEntity | null> {
    return this.cardRepo.findOne({ where: { id } });
  }

  async findCreditCardByDetails(
    bank: string,
    cardName: string,
    holderName?: string,
  ): Promise<CreditCardEntity | null> {
    const query = this.cardRepo
      .createQueryBuilder('card')
      .where('LOWER(card.bank) = LOWER(:bank)', { bank })
      .andWhere('LOWER(card.cardName) = LOWER(:cardName)', { cardName });

    if (holderName) {
      query.andWhere('LOWER(card.holderName) LIKE LOWER(:holderName)', {
        holderName: `%${holderName}%`,
      });
    }

    return query.getOne();
  }
}
