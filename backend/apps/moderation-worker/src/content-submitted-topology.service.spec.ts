import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import {
  RABBITMQ_TOPOLOGY,
  type RabbitMqConnectionService,
} from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { CONTENT_SUBMITTED_CONSUMER_CONFIG } from './content-submitted-consumer.constants.js';
import { ContentSubmittedTopologyService } from './content-submitted-topology.service.js';

describe('ContentSubmittedTopologyService', () => {
  it('declares and binds the durable ContentSubmitted queue', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const waitForConnect = vi.fn().mockResolvedValue(undefined);
    const wrapper = { close, waitForConnect } as unknown as ChannelWrapper;
    let setup: ((channel: Channel) => Promise<void>) | undefined;
    const createChannel = vi.fn().mockImplementation((options) => {
      setup = options.setup;
      return wrapper;
    });
    const rabbitMq = {
      getConnection: () => ({ createChannel }),
    } as unknown as RabbitMqConnectionService;
    const service = new ContentSubmittedTopologyService(rabbitMq);
    const assertExchange = vi.fn().mockResolvedValue(undefined);
    const assertQueue = vi.fn().mockResolvedValue(undefined);
    const bindQueue = vi.fn().mockResolvedValue(undefined);
    const channel = {
      assertExchange,
      assertQueue,
      bindQueue,
    } as unknown as Channel;

    const initialized = service.onModuleInit();
    expect(setup).toBeDefined();
    await setup!(channel);
    await initialized;

    const exchange = RABBITMQ_TOPOLOGY.eventsExchange;
    expect(assertExchange).toHaveBeenCalledWith(
      'content.events',
      exchange.type,
      { durable: true },
    );
    expect(assertQueue).toHaveBeenCalledWith(
      'moderation.content-submitted.v1',
      { durable: true, exclusive: false, autoDelete: false },
    );
    expect(bindQueue).toHaveBeenCalledWith(
      'moderation.content-submitted.v1',
      exchange.name,
      CONTENT_SUBMITTED_EVENT.routingKey,
    );
    expect(assertExchange).toHaveBeenCalledWith('content.retry', 'direct', {
      durable: true,
    });
    expect(assertQueue).toHaveBeenCalledWith(
      'moderation.content-submitted.retry.v1',
      {
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 5_000,
          'x-dead-letter-exchange': 'content.events',
          'x-dead-letter-routing-key': 'content.submitted',
        },
      },
    );
    expect(bindQueue).toHaveBeenCalledWith(
      'moderation.content-submitted.retry.v1',
      'content.retry',
      'content.submitted.retry',
    );
    expect(assertExchange).toHaveBeenCalledWith('content.dlx', 'direct', {
      durable: true,
    });
    expect(assertQueue).toHaveBeenCalledWith(
      'moderation.content-submitted.dlq.v1',
      { durable: true, exclusive: false, autoDelete: false },
    );
    expect(bindQueue).toHaveBeenCalledWith(
      'moderation.content-submitted.dlq.v1',
      'content.dlx',
      'content.submitted.dead',
    );
    expect(CONTENT_SUBMITTED_CONSUMER_CONFIG.queueName).toBe(
      'moderation.content-submitted.v1',
    );
    expect(waitForConnect).toHaveBeenCalledOnce();

    await service.onModuleDestroy();
    expect(close).toHaveBeenCalledOnce();
  });
});
