import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '@app/database';
import { InternalDiagnosticsService } from './internal-diagnostics.service.js';

const outboxId = '0f069398-9ece-44b6-8390-b130da447e79';
const eventId = 'b436a766-e8fa-4800-824a-f1189eb32855';
const aggregateId = 'fd65ea0d-2807-4cdf-a53d-744bf9ca63db';
const processedId = '553ebae5-f477-488f-a129-97032239b09e';
const createdAt = new Date('2026-09-22T12:00:00.000Z');
const outboxListItem = {
  id: outboxId,
  eventId,
  eventType: 'content.submitted',
  eventVersion: 1,
  aggregateType: 'Content',
  aggregateId,
  correlationId: '80e94065-9222-4483-9e76-538031e2203c',
  occurredAt: createdAt,
  publishedAt: null,
  claimedAt: null,
  claimedBy: null,
  retryCount: 0,
  nextAttemptAt: null,
  lastError: null,
  createdAt,
};
const outboxDetail = { ...outboxListItem, payload: { contentId: aggregateId } };
const processedMessage = {
  id: processedId,
  eventId,
  consumerName: 'moderation-worker',
  processedAt: createdAt,
};

function createHarness() {
  const writeSpies = Array.from({ length: 15 }, () => vi.fn());
  const writeMethods = (offset: number) => ({
    create: writeSpies[offset],
    createMany: writeSpies[offset + 1],
    update: writeSpies[offset + 2],
    updateMany: writeSpies[offset + 3],
    delete: writeSpies[offset + 4],
    deleteMany: writeSpies[offset + 5],
    upsert: writeSpies[offset + 6],
  });
  const outboxEvent = {
    findMany: vi.fn().mockResolvedValue([outboxListItem]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue(outboxDetail),
    ...writeMethods(0),
  };
  const processedMessageDelegate = {
    findMany: vi.fn().mockResolvedValue([processedMessage]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue(processedMessage),
    ...writeMethods(7),
  };
  const $transaction = vi.fn().mockImplementation((queries: Promise<unknown>[]) =>
    Promise.all(queries),
  );
  const prisma = {
    outboxEvent,
    processedMessage: processedMessageDelegate,
    $transaction,
    $executeRaw: writeSpies[14],
  } as unknown as PrismaService;

  return {
    service: new InternalDiagnosticsService(prisma),
    outboxEvent,
    processedMessage: processedMessageDelegate,
    $transaction,
    writeSpies,
  };
}

describe('InternalDiagnosticsService', () => {
  it('lists outbox events with exact filters, pagination, ordering, and no payload', async () => {
    const harness = createHarness();

    await expect(
      harness.service.findOutboxEvents({
        page: 3,
        limit: 20,
        eventType: 'content.submitted',
        aggregateId,
        published: true,
      }),
    ).resolves.toEqual({ items: [outboxListItem], page: 3, limit: 20, total: 1 });

    const where = {
      eventType: 'content.submitted',
      aggregateId,
      publishedAt: { not: null },
    };
    expect(harness.outboxEvent.findMany).toHaveBeenCalledWith({
      where,
      skip: 40,
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        eventId: true,
        eventType: true,
        eventVersion: true,
        aggregateType: true,
        aggregateId: true,
        correlationId: true,
        occurredAt: true,
        publishedAt: true,
        claimedAt: true,
        claimedBy: true,
        retryCount: true,
        nextAttemptAt: true,
        lastError: true,
        createdAt: true,
      },
    });
    expect(harness.outboxEvent.findMany.mock.calls[0][0].select).not.toHaveProperty(
      'payload',
    );
    expect(harness.outboxEvent.count).toHaveBeenCalledWith({ where });
    expect(harness.outboxEvent.count.mock.calls[0][0].where).toBe(
      harness.outboxEvent.findMany.mock.calls[0][0].where,
    );
    expect(harness.$transaction).toHaveBeenCalledOnce();
  });

  it('maps published=false to null and preserves default pagination', async () => {
    const harness = createHarness();

    await expect(
      harness.service.findOutboxEvents({ page: 1, limit: 20, published: false }),
    ).resolves.toEqual({ items: [outboxListItem], page: 1, limit: 20, total: 1 });
    expect(harness.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventType: undefined, aggregateId: undefined, publishedAt: null },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('gets outbox detail by OutboxEvent.id with payload and all contract fields', async () => {
    const harness = createHarness();

    await expect(harness.service.findOutboxEvent(outboxId)).resolves.toEqual(outboxDetail);
    expect(harness.outboxEvent.findUnique).toHaveBeenCalledWith({
      where: { id: outboxId },
      select: {
        id: true,
        eventId: true,
        eventType: true,
        eventVersion: true,
        aggregateType: true,
        aggregateId: true,
        correlationId: true,
        occurredAt: true,
        publishedAt: true,
        claimedAt: true,
        claimedBy: true,
        retryCount: true,
        nextAttemptAt: true,
        lastError: true,
        createdAt: true,
        payload: true,
      },
    });
  });

  it('returns 404 for missing outbox detail', async () => {
    const harness = createHarness();
    harness.outboxEvent.findUnique.mockResolvedValueOnce(null);

    await expect(harness.service.findOutboxEvent(outboxId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists processed messages with exact filters, projection, and ordering', async () => {
    const harness = createHarness();

    await expect(
      harness.service.findProcessedMessages({
        page: 2,
        limit: 10,
        eventId,
        consumerName: 'moderation-worker',
      }),
    ).resolves.toEqual({ items: [processedMessage], page: 2, limit: 10, total: 1 });

    const where = { eventId, consumerName: 'moderation-worker' };
    expect(harness.processedMessage.findMany).toHaveBeenCalledWith({
      where,
      skip: 10,
      take: 10,
      orderBy: [{ processedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, eventId: true, consumerName: true, processedAt: true },
    });
    expect(harness.processedMessage.count).toHaveBeenCalledWith({ where });
    expect(harness.processedMessage.count.mock.calls[0][0].where).toBe(
      harness.processedMessage.findMany.mock.calls[0][0].where,
    );
    expect(harness.$transaction).toHaveBeenCalledOnce();
  });

  it('gets processed detail by ProcessedMessage.id with four exact fields', async () => {
    const harness = createHarness();

    await expect(harness.service.findProcessedMessage(processedId)).resolves.toEqual(
      processedMessage,
    );
    expect(harness.processedMessage.findUnique).toHaveBeenCalledWith({
      where: { id: processedId },
      select: { id: true, eventId: true, consumerName: true, processedAt: true },
    });
  });

  it('returns 404 for missing processed-message detail', async () => {
    const harness = createHarness();
    harness.processedMessage.findUnique.mockResolvedValueOnce(null);

    await expect(
      harness.service.findProcessedMessage(processedId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('performs no Prisma writes across all diagnostics methods', async () => {
    const harness = createHarness();

    await harness.service.findOutboxEvents({ page: 1, limit: 20 });
    await harness.service.findOutboxEvent(outboxId);
    await harness.service.findProcessedMessages({ page: 1, limit: 20 });
    await harness.service.findProcessedMessage(processedId);

    for (const write of harness.writeSpies) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});
