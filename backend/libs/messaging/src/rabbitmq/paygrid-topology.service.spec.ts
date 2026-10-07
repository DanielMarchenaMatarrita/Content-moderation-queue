import { PAYMENT_ORDER_CREATED_EVENT } from '@app/contracts';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import type { RabbitMqConnectionService } from './rabbitmq-connection.service.js';
import { RABBITMQ_TOPOLOGY } from './rabbitmq.constants.js';
import { PaygridTopologyService } from './paygrid-topology.service.js';

describe('PaygridTopologyService', () => {
  it('declares durable payment-order processing, retry, and dead-letter topology', async () => {
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
    const service = new PaygridTopologyService(rabbitMq);
    const assertExchange = vi.fn().mockResolvedValue(undefined);
    const assertQueue = vi.fn().mockResolvedValue(undefined);
    const bindQueue = vi.fn().mockResolvedValue(undefined);
    const channel = {
      assertExchange,
      assertQueue,
      bindQueue,
    } as unknown as Channel;

    const initialized = service.onModuleInit();
    await setup!(channel);
    await initialized;

    const topology = RABBITMQ_TOPOLOGY.paygrid;
    expect(assertExchange).toHaveBeenCalledWith('paygrid.events', 'topic', {
      durable: true,
    });
    expect(assertQueue).toHaveBeenCalledWith('payment-orders.process.v1', {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    expect(bindQueue).toHaveBeenCalledWith(
      'payment-orders.process.v1',
      topology.eventsExchange.name,
      PAYMENT_ORDER_CREATED_EVENT.routingKey,
    );
    expect(assertExchange).toHaveBeenCalledWith('paygrid.retry', 'direct', {
      durable: true,
    });
    expect(assertQueue).toHaveBeenCalledWith('payment-orders.retry.v1', {
      durable: true,
      exclusive: false,
      autoDelete: false,
      arguments: {
        'x-message-ttl': 5_000,
        'x-dead-letter-exchange': 'paygrid.events',
        'x-dead-letter-routing-key': 'payment-order.created',
      },
    });
    expect(bindQueue).toHaveBeenCalledWith(
      'payment-orders.retry.v1',
      'paygrid.retry',
      'payment-order.created.retry',
    );
    expect(assertExchange).toHaveBeenCalledWith('paygrid.dlx', 'direct', {
      durable: true,
    });
    expect(assertQueue).toHaveBeenCalledWith('payment-orders.dlq.v1', {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    expect(bindQueue).toHaveBeenCalledWith(
      'payment-orders.dlq.v1',
      'paygrid.dlx',
      'payment-order.created.dead',
    );
    expect(topology.paymentOrderCreated.maxRetries).toBe(3);
    expect(topology.paymentOrderCreated.retryHeader).toBe('x-retry-count');

    await service.onModuleDestroy();
    expect(close).toHaveBeenCalledOnce();
  });
});
