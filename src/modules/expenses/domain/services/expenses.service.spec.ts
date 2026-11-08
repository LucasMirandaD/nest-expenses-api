import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { IExpensesRepository } from '../data/repositories/i-expenses.repository';
import { CreateExpenseDto } from '../presentation/dtos/create-expense.dto';
import { ExpenseEntity } from '../data/entities/expense.entity';
import { CreditCardEntity } from '../data/entities/credit-card.entity';
import { NotFound } from '../../../common/errors/errors';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let mockRepository: Partial<Record<keyof IExpensesRepository, jest.Mock>>;

  beforeEach(async () => {
    mockRepository = {
      saveExpense: jest.fn(),
      findExpenseById: jest.fn(),
      findExpenses: jest.fn(),
      findInstallmentsByDueDateRange: jest.fn(),
      findPendingInstallments: jest.fn(),
      saveCreditCard: jest.fn(),
      findCreditCards: jest.fn(),
      findCreditCardById: jest.fn(),
      findCreditCardByDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: IExpensesRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    jest.clearAllMocks();
  });

  describe('registerExpense', () => {
    it('should register single payment expense successfully', async () => {
      // Arrange
      const dto: CreateExpenseDto = {
        description: 'Supermercado Vea',
        merchantName: 'Vea Cencosud',
        totalAmount: 12500.5,
        currency: 'ARS',
        expenseDate: '2026-11-08',
        paymentMethod: 'DEBIT_CARD',
      };

      const savedEntity = new ExpenseEntity();
      Object.assign(savedEntity, dto, { id: 'uuid-1', installmentsPlan: [] });
      mockRepository.saveExpense!.mockResolvedValue(savedEntity);

      // Act
      const result = await service.registerExpense(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().id).toBe('uuid-1');
      expect(mockRepository.saveExpense).toHaveBeenCalledTimes(1);
    });

    it('should generate installments plan and match credit card when card details are provided', async () => {
      // Arrange
      const card = new CreditCardEntity();
      card.id = 'card-uuid-1';
      card.bank = 'Santander';
      card.cardName = 'Visa Black';
      card.isExtension = true;
      card.holderName = 'Mamá';
      card.dueDay = 10;

      mockRepository.findCreditCardByDetails!.mockResolvedValue(card);

      const dto: CreateExpenseDto = {
        description: 'Smart TV 55"',
        merchantName: 'Fravega',
        totalAmount: 300000,
        currency: 'ARS',
        expenseDate: '2026-11-08',
        cardBank: 'Santander',
        cardName: 'Visa Black',
        cardHolder: 'Mamá',
        isInstallment: true,
        totalInstallments: 3,
        intervalMonths: 2, // Cuotas cada 2 meses
      };

      mockRepository.saveExpense!.mockImplementation(async (entity) => {
        return { ...entity, id: 'expense-uuid-99' };
      });

      // Act
      const result = await service.registerExpense(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      const savedExpense = result.getValue();
      expect(savedExpense.id).toBe('expense-uuid-99');
      expect(savedExpense.creditCardId).toBe('card-uuid-1');
      expect(savedExpense.installmentsPlan).toHaveLength(3);
      expect(savedExpense.installmentsPlan[0].dueDate).toBe('2026-12-10');
      expect(savedExpense.installmentsPlan[1].dueDate).toBe('2027-02-10');
      expect(savedExpense.installmentsPlan[2].dueDate).toBe('2027-04-10');
    });

    it('should return failure Result when creditCardId does not exist', async () => {
      // Arrange
      const dto: CreateExpenseDto = {
        description: 'Combustible YPF',
        merchantName: 'YPF',
        totalAmount: 45000,
        expenseDate: '2026-11-08',
        creditCardId: 'non-existent-uuid',
      };
      mockRepository.findCreditCardById!.mockResolvedValue(null);

      // Act
      const result = await service.registerExpense(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFound);
    });
  });

  describe('getMonthlyInstallmentsSummary', () => {
    it('should summarize installments for given month', async () => {
      // Arrange
      const mockInstallment = {
        id: 'inst-1',
        expenseId: 'exp-1',
        installmentNumber: 2,
        totalInstallments: 6,
        amount: 25000,
        dueDate: '2026-12-10',
        status: 'PENDING',
        expense: {
          merchantName: 'MercadoLibre',
          description: 'Auriculares Sony',
          creditCard: {
            bank: 'Galicia',
            cardName: 'Mastercard',
            isExtension: false,
            holderName: 'Lucas M',
          },
        },
      };

      mockRepository.findInstallmentsByDueDateRange!.mockResolvedValue([mockInstallment]);

      // Act
      const result = await service.getMonthlyInstallmentsSummary('2026-12');

      // Assert
      expect(result.isSuccess).toBe(true);
      const summary = result.getValue();
      expect(summary.month).toBe('2026-12');
      expect(summary.totalAmountDue).toBe(25000);
      expect(summary.installmentsCount).toBe(1);
      expect(summary.items[0].cardBank).toBe('Galicia');
    });
  });
});
