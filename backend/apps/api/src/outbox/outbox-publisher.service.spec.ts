import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import type { PrismaService } from '@app/database';
import { RABBITMQ_TOPOLOGY, type RabbitMqConnectionService } from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { OutboxEvent } from '../../../../generated/prisma/client.js';
import { OUTBOX_PUBLISHER_CONFIG } from './outbox-publisher.constants.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';

const occurredAt = new Date('2026-09-22T12:00:00.000Z');

function createOutboxEvent(
  overrides: Partial<OutboxEvent> = {},
): OutboxEvent {
  return {
    id: '4d2064f1-951b-4d64-9056-4f36e01160a7',
    eventId: '68191604-b060-4e20-ac85-d38456704f08',
    eventType: CONTENT_SUBMITTED_EVENT.type,
    eventVersion: CONTENT_SUBMITTED_EVENT.version,
    aggregateType: 'Content',
    aggregateId: '206eb712-8f3d-48d9-b95f-27624bc4f738',
    payload: { contentId: '206eb712-8f3d-48d9-b95f-27624bc4f738' },
    correlationId: '53b604a6-f10d-42e2-a47e-25d9a641726e',
    occurredAt,
    publishedAt: null,
    claimedAt: new Date('2026-09-22T12:00:01.000Z'),
    claimedBy: 'test-publisher',
    retryCount: 0,
    nextAttemptAt: null,
    lastError: null,
    createdAt: occurredAt,
    ...overrides,
  };
}

function createHarness(events: OutboxEvent[] = []) {
  const queryRaw = vi.fn().mockResolvedValue(events);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const publish = vi.fn().mockResolvedValue(true);
  const close = vi.fn().mockResolvedValue(undefined);
  const channel = { publish, close } as unknown as ChannelWrapper;
  const createChannel = vi.fn().mockReturnValue(channel);
  const prisma = {
    $queryRaw: queryRaw,
    outboxEvent: { updateMany },
  } as unknown as PrismaService;
  const rabbitMq = {
    getConnection: () => ({ createChannel }),
  } as unknown as RabbitMqConnectionService;
  const service = new OutboxPublisherService(prisma, rabbitMq);

  service.onModuleInit();

  return {
    service,
    queryRaw,
    updateMany,
    publish,
    close,
    createChannel,
  };
}

describe('OutboxPublisherService', () => {
  let service: OutboxPublisherService | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await service?.onModuleDestroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('claims atomically and does not publish an empty outbox', async () => {
    const harness = createHarness();
    service = harness.service;

    await service.publishPendingBatch();

    expect(harness.publish).not.toHaveBeenCalled();
    expect(harness.updateMany).not.toHaveBeenCalled();

    const sql = Array.from(harness.queryRaw.mock.calls[0][0] as string[]).join('');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('UPDATE "OutboxEvent" AS outbox');
  });

  it('publishes the original envelope and marks it published', async () => {
    const event = createOutboxEvent();
    const harness = createHarness([event]);
    service = harness.service;

    await service.publishPendingBatch();

    expect(harness.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'outbox-publisher',
        confirm: true,
        publishTimeout: OUTBOX_PUBLISHER_CONFIG.publishTimeoutMs,
      }),
    );
    expect(harness.publish).toHaveBeenCalledWith(
      RABBITMQ_TOPOLOGY.eventsExchange.name,
      CONTENT_SUBMITTED_EVENT.routingKey,
      expect.any(String),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        correlationId: event.correlationId,
        type: event.eventType,
      },
    );

    const envelope = JSON.parse(harness.publish.mock.calls[0][2] as string);
    expect(envelope).toEqual({
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      occurredAt: occurredAt.toISOString(),
      correlationId: event.correlationId,
      payload: event.payload,
    });
    expect(harness.updateMany).toHaveBeenCalledWith({
      where: {
        id: event.id,
        claimedBy: expect.any(String),
        publishedAt: null,
      },
      data: {
        publishedAt: expect.any(Date),
        claimedAt: null,
        claimedBy: null,
        nextAttemptAt: null,
        lastError: null,
      },
    });
  });

  it('waits for publisher confirmation before setting publishedAt', async () => {
    let confirmPublish!: (confirmed: boolean) => void;
    const confirmation = new Promise<boolean>((resolve) => {
      confirmPublish = resolve;
    });
    let publishStarted!: () => void;
    const publishInvocation = new Promise<void>((resolve) => {
      publishStarted = resolve;
    });
    const harness = createHarness([createOutboxEvent()]);
    service = harness.service;
    harness.publish.mockImplementationOnce(() => {
      publishStarted();
      return confirmation;
    });

    const publishing = service.publishPendingBatch();
    await publishInvocation;

    expect(harness.publish).toHaveBeenCalledOnce();
    expect(harness.updateMany).not.toHaveBeenCalled();

    confirmPublish(true);
    await publishing;

    expect(harness.updateMany).toHaveBeenCalledOnce();
  });

  it('keeps failed events unpublished, backs off, and releases the claim', async () => {
    const now = new Date('2026-09-22T13:00:00.000Z');
    vi.setSystemTime(now);
    const event = createOutboxEvent({ retryCount: 2 });
    const harness = createHarness([event]);
    service = harness.service;
    harness.publish.mockRejectedValueOnce(
      new Error('Broker amqp://guest:secret@localhost:5672 unavailable'),
    );

    await service.publishPendingBatch();

    const update = harness.updateMany.mock.calls[0][0];
    expect(update.data).not.toHaveProperty('publishedAt');
    expect(update.data).toEqual({
      retryCount: { increment: 1 },
      nextAttemptAt: new Date(
        now.getTime() + OUTBOX_PUBLISHER_CONFIG.retryBaseMs * 2 ** event.retryCount,
      ),
      lastError: 'Broker [REDACTED_URL] unavailable',
      claimedAt: null,
      claimedBy: null,
    });
  });

  it.each([
    ['unknown event type', { eventType: 'content.unknown' }],
    ['unsupported event version', { eventVersion: 2 }],
    ['invalid content payload', { payload: { contentId: '' } }],
  ])('does not publish an %s', async (_name, overrides) => {
    const harness = createHarness([createOutboxEvent(overrides)]);
    service = harness.service;

    await service.publishPendingBatch();

    expect(harness.publish).not.toHaveBeenCalled();
    expect(harness.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          retryCount: { increment: 1 },
          claimedAt: null,
          claimedBy: null,
        }),
      }),
    );
  });

  it('stops scheduling cycles and closes only its channel on shutdown', async () => {
    const harness = createHarness();
    service = harness.service;

    expect(vi.getTimerCount()).toBe(1);
    await service.onModuleDestroy();

    expect(vi.getTimerCount()).toBe(0);
    expect(harness.close).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(harness.queryRaw).not.toHaveBeenCalled();

    service = undefined;
  });
});
