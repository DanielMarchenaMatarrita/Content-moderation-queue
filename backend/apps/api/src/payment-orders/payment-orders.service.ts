import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PAYMENT_ORDER_CREATED_EVENT } from '@app/contracts';
import { PrismaService } from '@app/database';
import {
  PaymentOrderStatus,
  type Prisma,
} from '../../../../generated/prisma/client.js';
import type { CreatePaymentOrderDto } from './dto/create-payment-order.dto.js';
import type { ListPaymentOrdersQueryDto } from './dto/list-payment-orders-query.dto.js';

const paymentOrderSelect = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  simulationScenario: true,
  retryCount: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
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
      select: paymentOrderSelect,
    });
    if (!order) {
      throw new NotFoundException(`Payment order ${id} was not found`);
    }
    return order;
  }
}
