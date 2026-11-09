import { ExpenseEntity } from '../entities/expense.entity';
import { CreditCardEntity } from '../entities/credit-card.entity';
import { ExpenseInstallmentEntity } from '../entities/expense-installment.entity';

export abstract class IExpensesRepository {
  abstract saveExpense(expense: Partial<ExpenseEntity>): Promise<ExpenseEntity>;
  abstract findExpenseById(id: string): Promise<ExpenseEntity | null>;
  abstract findExpenses(limit?: number, offset?: number): Promise<ExpenseEntity[]>;
  abstract findInstallmentsByDueDateRange(startDate: string, endDate: string): Promise<ExpenseInstallmentEntity[]>;
  abstract findPendingInstallments(creditCardId?: string): Promise<ExpenseInstallmentEntity[]>;
  abstract findInstallmentById(id: string): Promise<ExpenseInstallmentEntity | null>;
  abstract saveInstallment(installment: ExpenseInstallmentEntity): Promise<ExpenseInstallmentEntity>;
  abstract searchPendingInstallments(query?: string, dueDate?: string): Promise<ExpenseInstallmentEntity[]>;
  abstract saveCreditCard(card: Partial<CreditCardEntity>): Promise<CreditCardEntity>;
  abstract findCreditCards(): Promise<CreditCardEntity[]>;
  abstract findCreditCardById(id: string): Promise<CreditCardEntity | null>;
  abstract findCreditCardByDetails(bank: string, cardName: string, holderName?: string): Promise<CreditCardEntity | null>;
}
