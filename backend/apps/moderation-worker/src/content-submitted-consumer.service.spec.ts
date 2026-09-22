import { randomUUID } from 'node:crypto';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import { CONTENT_SUBMITTED_CONSUMER_CONFIG } from './content-submitted-consumer.constants.js';
import { ContentSubmittedConsumerService } from './content-submitted-consumer.service.js';
import type {
  IdempotentMessageExecutorService,
  TransactionClient,
} from './idempotent-message-executor.service.js';

const validEvent = {
  eventId: '68191604-b060-4e20-ac85-d38456704f08',
  eventType: CONTENT_SUBMITTED_EVENT.type,
  eventVersion: CONTENT_SUBMITTED_EVENT.version,
  occurredAt: '2026-09-22T12:00:00.000Z',
  correlationId: '53b604a6-f10d-42e2-a47e-25d9a641726e',
  payload: { contentId: '206eb712-8f3d-48d9-b95f-27624bc4f738' },
};

function createMessage(
  body: unknown = validEvent,
  metadata: Record<string, unknown> = {},
): ConsumeMessage {
  const content = Buffer.from(
    typeof body === 'string' ? body : JSON.stringify(body),
  );

  return {
    content,
    properties: metadata,
  } as unknown as ConsumeMessage;
}

function createHarness(
  executeOnce: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue('processed'),
) {
  const executor = { executeOnce } as unknown as IdempotentMessageExecutorService;
  const ack = vi.fn();
  const channel = { ack } as unknown as Pick<Channel, 'ack'>;

  return {
    service: new ContentSubmittedConsumerService(executor),
    executeOnce,
    ack,
    channel,
  };
}

describe('ContentSubmittedConsumerService', () => {
  it('parses a valid event and preserves its identifiers and contentId', () => {
    const harness = createHarness();
    const parsed = harness.service.parseMessage(
      createMessage(validEvent, {
        messageId: validEvent.eventId,
        correlationId: validEvent.correlationId,
        type: validEvent.eventType,
      }),
    );

    expect(parsed).toEqual({ valid: true, event: validEvent });
  });

  it.each([
    ['wrong event type', { ...validEvent, eventType: 'content.deleted' }],
    ['future version', { ...validEvent, eventVersion: 2 }],
    ['invalid payload', { ...validEvent, payload: { contentId: '' } }],
  ])('rejects %s', (_name, body) => {
    const harness = createHarness();
    expect(harness.service.parseMessage(createMessage(body)).valid).toBe(false);
  });

  it('rejects invalid JSON', () => {
    const harness = createHarness();
    expect(harness.service.parseMessage(createMessage('{broken')).valid).toBe(
      false,
    );
  });

  it('rejects AMQP metadata that conflicts with the envelope', () => {
    const harness = createHarness();
    const parsed = harness.service.parseMessage(
      createMessage(validEvent, { messageId: randomUUID() }),
    );

    expect(parsed.valid).toBe(false);
  });

  it('leaves invalid messages unacknowledged for the future DLQ policy', async () => {
    const harness = createHarness();

    await expect(
      harness.service.handleMessage(
        createMessage('{broken'),
        harness.channel,
        vi.fn(),
      ),
    ).resolves.toMatchObject({ status: 'invalid' });
    expect(harness.executeOnce).not.toHaveBeenCalled();
    expect(harness.ack).not.toHaveBeenCalled();
  });

  it('ACKs a duplicate without invoking a processor callback', async () => {
    const executeOnce = vi.fn().mockResolvedValue('duplicate');
    const harness = createHarness(executeOnce);
    const processor = vi.fn().mockResolvedValue(undefined);
    const message = createMessage();

    await expect(
      harness.service.handleMessage(message, harness.channel, processor),
    ).resolves.toMatchObject({ status: 'duplicate' });
    expect(processor).not.toHaveBeenCalled();
    expect(harness.ack).toHaveBeenCalledWith(message);
    expect(executeOnce).toHaveBeenCalledWith(
      validEvent.eventId,
      'moderation-worker.content-submitted.v1',
      expect.any(Function),
    );
    expect(CONTENT_SUBMITTED_CONSUMER_CONFIG).toMatchObject({
      consumerName: 'moderation-worker.content-submitted.v1',
      prefetch: 10,
      autoConsume: false,
    });
  });

  it('ACKs only after successful processing resolves', async () => {
    let completeProcessing!: () => void;
    const processing = new Promise<void>((resolve) => {
      completeProcessing = resolve;
    });
    const transaction = {} as TransactionClient;
    const executeOnce = vi.fn().mockImplementation(async (_id, _name, callback) => {
      await callback(transaction);
      return 'processed';
    });
    const harness = createHarness(executeOnce);
    const processor = vi.fn().mockReturnValue(processing);
    const message = createMessage();

    const handling = harness.service.handleMessage(
      message,
      harness.channel,
      processor,
    );
    await vi.waitFor(() => expect(processor).toHaveBeenCalledOnce());
    expect(harness.ack).not.toHaveBeenCalled();

    completeProcessing();
    await expect(handling).resolves.toMatchObject({ status: 'processed' });
    expect(harness.ack).toHaveBeenCalledWith(message);
  });

  it('returns failed and does not ACK when processing fails', async () => {
    const failure = new Error('transaction rolled back');
    const executeOnce = vi.fn().mockRejectedValue(failure);
    const harness = createHarness(executeOnce);

    await expect(
      harness.service.handleMessage(
        createMessage(),
        harness.channel,
        vi.fn(),
      ),
    ).resolves.toMatchObject({ status: 'failed', error: failure });
    expect(harness.ack).not.toHaveBeenCalled();
  });
});
