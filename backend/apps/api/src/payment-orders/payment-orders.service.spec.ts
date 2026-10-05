import { ConflictException, NotFoundException } from '@nestjs/common';
import { PAYMENT_ORDER_CREATED_EVENT } from '@app/contracts';
import type { PrismaService } from '@app/database';
import {
  PaymentOrderStatus,
  ProcessingAttemptStatus,
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
  reprocessScenario: null,
  retryCount: 0,
  lastError: null,
  createdAt,
  updatedAt: createdAt,
};
const firstAttempt = {
  id: '70216a5c-2f02-4ea4-82a0-25d31997f9c2',
  orderId,
  attemptNumber: 1,
  status: ProcessingAttemptStatus.ERROR,
  errorDescription: 'Gateway timeout',
  createdAt,
};
const secondAttempt = {
  id: 'ef2fd99a-1167-4d6d-84d2-1b0a2e7e6396',
  orderId,
  attemptNumber: 2,
  status: ProcessingAttemptStatus.SUCCESS,
  errorDescription: null,
  createdAt: new Date('2026-10-03T12:01:00.000Z'),
};

function createHarness() {
  const transaction = {
    paymentOrder: {
      create: vi.fn().mockResolvedValue(order),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue(order),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const paymentOrder = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const processingAttempt = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const $transaction = vi
    .fn()
    .mockImplementation(async (input) =>
      typeof input === 'function' ? input(transaction) : Promise.all(input),
    );
  const prisma = {
    $transaction,
    paymentOrder,
    processingAttempt,
  } as unknown as PrismaService;
  return {
    service: new PaymentOrdersService(prisma),
    transaction,
    paymentOrder,
    processingAttempt,
    $transaction,
  };
}

function expectNoReadWrites(harness: ReturnType<typeof createHarness>) {
  expect(harness.transaction.paymentOrder.create).not.toHaveBeenCalled();
  expect(harness.transaction.outboxEvent.create).not.toHaveBeenCalled();
  expect(harness.paymentOrder.create).not.toHaveBeenCalled();
  expect(harness.paymentOrder.update).not.toHaveBeenCalled();
  expect(harness.paymentOrder.delete).not.toHaveBeenCalled();
  expect(harness.processingAttempt.create).not.toHaveBeenCalled();
  expect(harness.processingAttempt.update).not.toHaveBeenCalled();
  expect(harness.processingAttempt.delete).not.toHaveBeenCalled();
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

  it('atomically reprocesses only a failed order with a new event and preserved original scenario', async () => {
    const harness = createHarness();
    const failedOrder = { ...order, status: PaymentOrderStatus.FAILED, retryCount: 3, lastError: 'failed' };
    const reprocessed = { ...failedOrder, status: PaymentOrderStatus.PENDING, reprocessScenario: SimulationScenario.SUCCESS, retryCount: 0, lastError: null };
    harness.transaction.paymentOrder.findUniqueOrThrow.mockResolvedValueOnce(reprocessed);

    const result = await harness.service.reprocess(orderId, { scenario: SimulationScenario.SUCCESS });

    expect(harness.$transaction).toHaveBeenCalledOnce();
    expect(harness.transaction.paymentOrder.updateMany).toHaveBeenCalledWith({
      where: { id: orderId, status: PaymentOrderStatus.FAILED },
      data: { status: PaymentOrderStatus.PENDING, reprocessScenario: SimulationScenario.SUCCESS, retryCount: 0, lastError: null },
    });
    expect(harness.transaction.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: result.reprocessEventId,
        eventType: PAYMENT_ORDER_CREATED_EVENT.type,
        aggregateId: orderId,
        payload: { orderId },
      }),
    });
    expect(reprocessed.simulationScenario).toBe(SimulationScenario.FAIL_ONCE);
    expect(result.reprocessEventId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('rejects absent and non-failed reprocess requests without writes', async () => {
    const absent = createHarness();
    absent.transaction.paymentOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    absent.transaction.paymentOrder.findUnique.mockResolvedValueOnce(null);
    await expect(absent.service.reprocess(orderId, { scenario: SimulationScenario.SUCCESS })).rejects.toBeInstanceOf(NotFoundException);
    expect(absent.transaction.paymentOrder.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(absent.transaction.outboxEvent.create).not.toHaveBeenCalled();

    const pending = createHarness();
    pending.transaction.paymentOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    pending.transaction.paymentOrder.findUnique.mockResolvedValueOnce({ id: orderId });
    await expect(pending.service.reprocess(orderId, { scenario: SimulationScenario.SUCCESS })).rejects.toBeInstanceOf(ConflictException);
    expect(pending.transaction.paymentOrder.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(pending.transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('does not create another recovery event when conditional failed transition loses a race', async () => {
    const harness = createHarness();
    harness.transaction.paymentOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    harness.transaction.paymentOrder.findUnique.mockResolvedValueOnce({ id: orderId });

    await expect(
      harness.service.reprocess(orderId, { scenario: SimulationScenario.SUCCESS }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.transaction.paymentOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId, status: PaymentOrderStatus.FAILED },
      }),
    );
    expect(harness.transaction.paymentOrder.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(harness.transaction.outboxEvent.create).not.toHaveBeenCalled();
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
    expect(harness.paymentOrder.findMany.mock.calls[0][0].select).not.toHaveProperty(
      'attempts',
    );
    expectNoReadWrites(harness);
  });

  it('returns full persisted order state with attempts ascending by attempt number', async () => {
    const harness = createHarness();
    const retriedOrder = {
      ...order,
      status: PaymentOrderStatus.SUCCESS,
      retryCount: 1,
      lastError: 'Gateway timeout',
      attempts: [firstAttempt, secondAttempt],
    };
    harness.paymentOrder.findUnique.mockResolvedValueOnce(retriedOrder);
    await expect(harness.service.findOne(orderId)).resolves.toEqual(retriedOrder);
    expect(harness.paymentOrder.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        select: expect.objectContaining({
          retryCount: true,
          lastError: true,
          attempts: expect.objectContaining({ orderBy: { attemptNumber: 'asc' } }),
        }),
      }),
    );
    expectNoReadWrites(harness);
  });

  it('returns payment order processing attempts ascending and allows an empty list', async () => {
    const harness = createHarness();
    harness.paymentOrder.findUnique.mockResolvedValue({ id: orderId });
    harness.processingAttempt.findMany
      .mockResolvedValueOnce([firstAttempt, secondAttempt])
      .mockResolvedValueOnce([]);

    await expect(harness.service.findAttempts(orderId)).resolves.toEqual([
      firstAttempt,
      secondAttempt,
    ]);
    await expect(harness.service.findAttempts(orderId)).resolves.toEqual([]);
    expect(harness.processingAttempt.findMany).toHaveBeenCalledWith({
      where: { orderId },
      orderBy: { attemptNumber: 'asc' },
      select: expect.any(Object),
    });
    expectNoReadWrites(harness);
  });

  it('returns a 404 when an order or its attempts are requested for an absent order', async () => {
    const harness = createHarness();

    harness.paymentOrder.findUnique.mockResolvedValueOnce(null);
    await expect(harness.service.findOne(orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    harness.paymentOrder.findUnique.mockResolvedValueOnce(null);
    await expect(harness.service.findAttempts(orderId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(harness.processingAttempt.findMany).not.toHaveBeenCalled();
    expectNoReadWrites(harness);
  });

  it('returns exact database-backed order and attempt counts', async () => {
    const harness = createHarness();
    harness.paymentOrder.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);
    harness.processingAttempt.count.mockResolvedValueOnce(18);

    await expect(harness.service.getStats()).resolves.toEqual({
      total: 12,
      pending: 3,
      successful: 5,
      failed: 2,
      retried: 4,
      totalAttempts: 18,
    });
    expect(harness.paymentOrder.count).toHaveBeenNthCalledWith(1);
    expect(harness.paymentOrder.count).toHaveBeenNthCalledWith(2, {
      where: { status: PaymentOrderStatus.PENDING },
    });
    expect(harness.paymentOrder.count).toHaveBeenNthCalledWith(3, {
      where: { status: PaymentOrderStatus.SUCCESS },
    });
    expect(harness.paymentOrder.count).toHaveBeenNthCalledWith(4, {
      where: { status: PaymentOrderStatus.FAILED },
    });
    expect(harness.paymentOrder.count).toHaveBeenNthCalledWith(5, {
      where: { retryCount: { gt: 0 } },
    });
    expect(harness.processingAttempt.count).toHaveBeenCalledOnce();
    expectNoReadWrites(harness);
  });
});
