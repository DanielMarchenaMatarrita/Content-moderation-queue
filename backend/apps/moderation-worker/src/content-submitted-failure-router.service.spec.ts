import { RABBITMQ_TOPOLOGY, type RabbitMqConnectionService } from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { ContentSubmittedFailureRouterService } from './content-submitted-failure-router.service.js';

function createMessage(): ConsumeMessage {
  return {
    content: Buffer.from('{"eventId":"event"}'),
    properties: {
      contentType: 'application/json',
      messageId: '68191604-b060-4e20-ac85-d38456704f08',
      correlationId: '53b604a6-f10d-42e2-a47e-25d9a641726e',
      type: 'content.submitted',
      headers: { trace: 'safe', 'x-retry-count': 2, 'x-death': [{ count: 1 }] },
    },
  } as unknown as ConsumeMessage;
}

async function createHarness() {
  const publish = vi.fn().mockResolvedValue(true);
  const close = vi.fn().mockResolvedValue(undefined);
  const assertExchange = vi.fn().mockResolvedValue(undefined);
  const setupChannel = { assertExchange } as unknown as Channel;
  let setup: ((channel: Channel) => Promise<void>) | undefined;
  const waitForConnect = vi.fn().mockImplementation(async () => setup?.(setupChannel));
  const wrapper = { publish, close, waitForConnect } as unknown as ChannelWrapper;
  const createChannel = vi.fn().mockImplementation((options) => {
    setup = options.setup;
    return wrapper;
  });
  const rabbitMq = {
    getConnection: () => ({ createChannel }),
  } as unknown as RabbitMqConnectionService;
  const service = new ContentSubmittedFailureRouterService(rabbitMq);
  await service.onModuleInit();
  return { service, publish, close, createChannel, assertExchange };
}

describe('ContentSubmittedFailureRouterService', () => {
  it('publishes persistent retry while preserving body and message metadata', async () => {
    const harness = await createHarness();
    const message = createMessage();

    await harness.service.publishRetry(message, 3);

    expect(harness.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        confirm: true,
        publishTimeout: 10_000,
      }),
    );
    expect(harness.publish).toHaveBeenCalledWith(
      'content.retry',
      'content.submitted.retry',
      message.content,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.properties.messageId,
        correlationId: message.properties.correlationId,
        type: message.properties.type,
        headers: {
          trace: 'safe',
          'x-retry-count': 3,
          'x-original-queue': 'moderation.content-submitted.v1',
        },
      },
    );
    await harness.service.onModuleDestroy();
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it('publishes persistent DLQ messages with bounded sanitized failure metadata', async () => {
    const harness = await createHarness();
    const message = createMessage();

    await harness.service.publishDeadLetter(
      message,
      new Error('Database postgresql://user:secret@localhost/db unavailable'),
    );

    const [exchange, routingKey, body, options] = harness.publish.mock.calls[0];
    expect(exchange).toBe(RABBITMQ_TOPOLOGY.contentSubmitted.deadLetterExchange.name);
    expect(routingKey).toBe('content.submitted.dead');
    expect(body).toBe(message.content);
    expect(options).toMatchObject({
      persistent: true,
      headers: {
        trace: 'safe',
        'x-original-queue': 'moderation.content-submitted.v1',
        'x-failure-reason': 'Database [REDACTED_URL] unavailable',
      },
    });
    await harness.service.onModuleDestroy();
  });
});
