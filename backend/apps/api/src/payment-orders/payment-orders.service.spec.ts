import { NotFoundException } from '@nestjs/common';
import { PAYMENT_ORDER_CREATED_EVENT } from '@app/contracts';
import type { PrismaService } from '@app/database';
import {
  PaymentOrderStatus,
  SimulationScenario,
} from '../../../../generated/prisma/client.js';
import { PaymentOrdersService } from './payment-orders.service.js';

const orderId = 'b436a766-e8fa-4800-824a-f1189eb32855';
const createdAt = new Date('2026-10-03T12:00:00.000Z');
const order = {
  id: orderId,
  amount: 1500,
  currency: 'USD',
  status: PaymentOrderStatus.PENDING,
  simulationScenario: SimulationScenario.FAIL_ONCE,
  retryCount: 0,
  lastError: null,
  createdAt,
  updatedAt: createdAt,
};

function createHarness() {
  const transaction = {
    paymentOrder: { create: vi.fn().mockResolvedValue(order) },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const paymentOrder = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn(),
  };
  const $transaction = vi
    .fn()
    .mockImplementation(async (input) =>
      typeof input === 'function' ? input(transaction) : Promise.all(input),
    );
  const prisma = { $transaction, paymentOrder } as unknown as PrismaService;
  return {
    service: new PaymentOrdersService(prisma),
    transaction,
    paymentOrder,
    $transaction,
  };
}

describe('PaymentOrdersService', () => {
  it('atomically creates a pending order and payment-order.created v1 outbox event', async () => {
    const harness = createHarness();

    const result = await harness.service.create({
      amount: 1500,
      currency: 'USD',
      simulationScenario: SimulationScenario.FAIL_ONCE,
    });

    expect(harness.$transaction).toHaveBeenCalledOnce();
    expect(harness.transaction.paymentOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 1500,
        currency: 'USD',
        status: PaymentOrderStatus.PENDING,
        simulationScenario: SimulationScenario.FAIL_ONCE,
        retryCount: 0,
        lastError: null,
      }),
      select: expect.any(Object),
    });
    expect(harness.transaction.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: result.submissionEventId,
        eventType: PAYMENT_ORDER_CREATED_EVENT.type,
        eventVersion: PAYMENT_ORDER_CREATED_EVENT.version,
        aggregateType: 'PaymentOrder',
        aggregateId: orderId,
        payload: { orderId },
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      }),
    });
    expect(result).toEqual({
      ...order,
      submissionEventId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
  });

  it('paginates newest-first orders with an optional status filter', async () => {
    const harness = createHarness();
    harness.paymentOrder.findMany.mockResolvedValueOnce([order]);
    harness.paymentOrder.count.mockResolvedValueOnce(1);

    await expect(
      harness.service.findAll({
        page: 2,
        limit: 10,
        status: PaymentOrderStatus.PENDING,
      }),
    ).resolves.toEqual({ items: [order], page: 2, limit: 10, total: 1 });
    expect(harness.paymentOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: PaymentOrderStatus.PENDING },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('returns an order or a 404', async () => {
    const harness = createHarness();
    harness.paymentOrder.findUnique.mockResolvedValueOnce(order);
    await expect(harness.service.findOne(orderId)).resolves.toBe(order);

    harness.paymentOrder.findUnique.mockResolvedValueOnce(null);
    await expect(harness.service.findOne(orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
