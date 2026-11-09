import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IExpensesService } from '../../domain/services/i-expenses.service';
import { CreateExpenseDto } from '../dtos/create-expense.dto';
import { CreateCreditCardDto } from '../dtos/create-credit-card.dto';
import { PayInstallmentDto } from '../dtos/pay-installment.dto';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { ErrorMapperToHttp } from '../../../../common/errors/error.mapper';
import { ExpenseResponseDto } from '../dtos/expense-response.dto';
import { MonthlyInstallmentsSummaryDto } from '../dtos/installment-summary.dto';

@Controller('expenses')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ExpensesController {
  constructor(private readonly expensesService: IExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createExpense(@Body() dto: CreateExpenseDto): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.registerExpense(dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return ExpenseMapper.toPresentation(result.getValue());
  }

  @Get()
  async listExpenses(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ExpenseResponseDto[]> {
    const result = await this.expensesService.listExpenses(limit, offset);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue().map((exp) => ExpenseMapper.toPresentation(exp));
  }

  @Get('installments/summary')
  async getInstallmentsSummary(
    @Query('month') month?: string,
  ): Promise<MonthlyInstallmentsSummaryDto> {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const result = await this.expensesService.getMonthlyInstallmentsSummary(targetMonth);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get('installments/pending')
  async searchPendingInstallments(
    @Query('search') search?: string,
    @Query('dueDate') dueDate?: string,
  ) {
    const result = await this.expensesService.searchPendingInstallments(search, dueDate);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue().map((inst) => ({
      id: inst.id,
      expenseId: inst.expenseId,
      merchantName: inst.expense?.merchantName,
      description: inst.expense?.description,
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      notes: inst.notes,
    }));
  }

  @Post('installments/:id/pay')
  @HttpCode(HttpStatus.OK)
  async payInstallment(
    @Param('id') id: string,
    @Body() dto: PayInstallmentDto,
  ) {
    const result = await this.expensesService.payInstallment(
      id,
      dto.paymentMethod,
      dto.bankName,
      dto.notes,
    );
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    const inst = result.getValue();
    return {
      id: inst.id,
      expenseId: inst.expenseId,
      merchantName: inst.expense?.merchantName,
      description: inst.expense?.description,
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      amount: Number(inst.amount),
      dueDate: inst.dueDate,
      status: inst.status,
      notes: inst.notes,
      paidAt: inst.paidAt,
    };
  }

  @Get('cards')
  async listCreditCards() {
    const result = await this.expensesService.listCreditCards();
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Post('cards')
  @HttpCode(HttpStatus.CREATED)
  async createCreditCard(@Body() dto: CreateCreditCardDto) {
    const result = await this.expensesService.registerCreditCard(dto);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return result.getValue();
  }

  @Get(':id')
  async getExpenseById(@Param('id') id: string): Promise<ExpenseResponseDto> {
    const result = await this.expensesService.getExpenseById(id);
    if (result.isFailure) {
      throw ErrorMapperToHttp(result.getError());
    }
    return ExpenseMapper.toPresentation(result.getValue());
  }
}
