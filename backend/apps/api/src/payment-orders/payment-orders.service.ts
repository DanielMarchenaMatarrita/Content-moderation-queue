import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PAYMENT_ORDER_CREATED_EVENT } from '@app/contracts';
import { PrismaService } from '@app/database';
import {
  PaymentOrderStatus,
  type Prisma,
} from '../../../../generated/prisma/client.js';
import type { CreatePaymentOrderDto } from './dto/create-payment-order.dto.js';
import type { ListPaymentOrdersQueryDto } from './dto/list-payment-orders-query.dto.js';
import type { ReprocessPaymentOrderDto } from './dto/reprocess-payment-order.dto.js';

const paymentOrderSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  simulationScenario: true,
  reprocessScenario: true,
  retryCount: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentOrderSelect;

const processingAttemptSelect = {
  id: true,
  orderId: true,
  attemptNumber: true,
  status: true,
  errorDescription: true,
  createdAt: true,
} satisfies Prisma.ProcessingAttemptSelect;

const paymentOrderDetailSelect = {
  ...paymentOrderSelect,
  attempts: {
    orderBy: { attemptNumber: 'asc' },
    select: processingAttemptSelect,
  },
} satisfies Prisma.PaymentOrderSelect;

@Injectable()
export class PaymentOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePaymentOrderDto) {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const createdAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.paymentOrder.create({
        data: {
          amount: input.amount,
          currency: input.currency,
          status: PaymentOrderStatus.PENDING,
          simulationScenario: input.simulationScenario,
          retryCount: 0,
          lastError: null,
          createdAt,
        },
        select: paymentOrderSelect,
      });

      await transaction.outboxEvent.create({
        data: {
          eventId,
          eventType: PAYMENT_ORDER_CREATED_EVENT.type,
          eventVersion: PAYMENT_ORDER_CREATED_EVENT.version,
          aggregateType: 'PaymentOrder',
          aggregateId: order.id,
          payload: { orderId: order.id },
          correlationId,
          occurredAt: createdAt,
          createdAt,
        },
      });

      return { ...order, submissionEventId: eventId };
    });
  }

  async reprocess(id: string, input: ReprocessPaymentOrderDto) {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const occurredAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const transition = await transaction.paymentOrder.updateMany({
        where: { id, status: PaymentOrderStatus.FAILED },
        data: {
          status: PaymentOrderStatus.PENDING,
          reprocessScenario: input.scenario,
          retryCount: 0,
          lastError: null,
        },
      });
      if (transition.count === 0) {
        const current = await transaction.paymentOrder.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!current)
          throw new NotFoundException(`Payment order ${id} was not found`);
        throw new ConflictException(
          `Payment order ${id} can only be reprocessed from FAILED`,
        );
      }
      const order = await transaction.paymentOrder.findUniqueOrThrow({
        where: { id },
        select: paymentOrderSelect,
      });
      await transaction.outboxEvent.create({
        data: {
          eventId,
          eventType: PAYMENT_ORDER_CREATED_EVENT.type,
          eventVersion: PAYMENT_ORDER_CREATED_EVENT.version,
          aggregateType: 'PaymentOrder',
          aggregateId: order.id,
          payload: { orderId: order.id },
          correlationId,
          occurredAt,
          createdAt: occurredAt,
        },
      });
      return { ...order, reprocessEventId: eventId };
    });
  }

  async findAll(query: ListPaymentOrdersQueryDto) {
    const where: Prisma.PaymentOrderWhereInput = { status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentOrder.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: paymentOrderSelect,
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);

    return { items, page: query.page, limit: query.limit, total };
  }

  async findOne(id: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id },
      select: paymentOrderDetailSelect,
    });
    if (!order) {
      throw new NotFoundException(`Payment order ${id} was not found`);
    }
    return order;
  }

  async findAttempts(id: string) {
    await this.assertOrderExists(id);

    return this.prisma.processingAttempt.findMany({
      where: { orderId: id },
      orderBy: { attemptNumber: 'asc' },
      select: processingAttemptSelect,
    });
  }

  async getStats() {
    const [total, pending, successful, failed, retried, totalAttempts] =
      await Promise.all([
        this.prisma.paymentOrder.count(),
        this.prisma.paymentOrder.count({
          where: { status: PaymentOrderStatus.PENDING },
        }),
        this.prisma.paymentOrder.count({
          where: { status: PaymentOrderStatus.SUCCESS },
        }),
        this.prisma.paymentOrder.count({
          where: { status: PaymentOrderStatus.FAILED },
        }),
        this.prisma.paymentOrder.count({ where: { retryCount: { gt: 0 } } }),
        this.prisma.processingAttempt.count(),
      ]);

    return { total, pending, successful, failed, retried, totalAttempts };
  }

  private async assertOrderExists(id: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(`Payment order ${id} was not found`);
    }
  }
}
