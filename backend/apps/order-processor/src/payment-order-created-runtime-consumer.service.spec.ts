import type { RabbitMqConnectionService } from '@app/messaging';
import type { Channel, ConsumeMessage } from 'amqplib';
import { PaymentOrderCreatedRuntimeConsumerService } from './payment-order-created-runtime-consumer.service.js';

function harness(result: unknown = { status: 'processed' }) {
  const ack = vi.fn();
  const prefetch = vi.fn().mockResolvedValue(undefined);
  const consume = vi.fn().mockResolvedValue({ consumerTag: 'tag' });
  const channel = {
    ack,
    prefetch,
    consume,
    cancel: vi.fn().mockResolvedValue(undefined),
  } as unknown as Channel;
  let setup: ((channel: Channel) => Promise<void>) | undefined;
  const wrapper = {
    waitForConnect: vi.fn(async () => setup?.(channel)),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const rabbit = {
    getConnection: () => ({
      createChannel: vi.fn((options) => {
        setup = options.setup;
        return wrapper;
      }),
    }),
  } as unknown as RabbitMqConnectionService;
  const consumer = { handleMessage: vi.fn().mockResolvedValue(result) };
  const failureRouter = {
    publishRetry: vi.fn().mockResolvedValue(undefined),
    publishDeadLetter: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: new PaymentOrderCreatedRuntimeConsumerService(
      rabbit,
      consumer as never,
      failureRouter as never,
    ),
    channel,
    ack,
    prefetch,
    consume,
    consumer,
    ...failureRouter,
  };
}
function message(retry?: number): ConsumeMessage {
  return {
    content: Buffer.from('{}'),
    properties: {
      headers: retry === undefined ? {} : { 'x-retry-count': retry },
    },
  } as ConsumeMessage;
}

describe('PaymentOrderCreatedRuntimeConsumerService', () => {
  it('uses manual ACK and small configured prefetch', async () => {
    const h = harness();
    await h.service.onApplicationBootstrap();
    expect(h.prefetch).toHaveBeenCalledWith(10);
    expect(h.consume).toHaveBeenCalledWith(
      'payment-orders.process.v1',
      expect.any(Function),
      { noAck: false },
    );
  });
  it('routes retry 0, 1, 2 with exact next header and ACKs after confirmed publication', async () => {
    for (const retry of [0, 1, 2]) {
      const h = harness({ status: 'failed' });
      const delivery = message(retry);
      await h.service.handleDelivery(delivery, h.channel);
      expect(h.publishRetry).toHaveBeenCalledWith(delivery, retry + 1);
      expect(h.ack).toHaveBeenCalledWith(delivery);
      expect(h.publishRetry.mock.invocationCallOrder[0]).toBeLessThan(
        h.ack.mock.invocationCallOrder[0],
      );
    }
  });
  it('routes retry 3 to DLQ without retry', async () => {
    const h = harness({ status: 'failed' });
    const delivery = message(3);
    await h.service.handleDelivery(delivery, h.channel);
    expect(h.publishRetry).not.toHaveBeenCalled();
    expect(h.publishDeadLetter).toHaveBeenCalledWith(
      delivery,
      expect.any(String),
    );
    expect(h.ack).toHaveBeenCalledWith(delivery);
  });
  it('routes retry header above maxRetries to DLQ without resetting it', async () => {
    const h = harness({ status: 'failed' });
    const delivery = message(4);
    await h.service.handleDelivery(delivery, h.channel);
    expect(h.consumer.handleMessage).toHaveBeenCalledWith(delivery, 4);
    expect(h.publishRetry).not.toHaveBeenCalled();
    expect(h.publishDeadLetter).toHaveBeenCalledWith(
      delivery,
      expect.any(String),
    );
    expect(h.ack).toHaveBeenCalledWith(delivery);
  });
  it('does not ACK after retry or DLQ confirmation failure', async () => {
    const retry = harness({ status: 'failed' });
    retry.publishRetry.mockRejectedValueOnce(new Error('confirm failed'));
    await expect(
      retry.service.handleDelivery(message(0), retry.channel),
    ).rejects.toThrow('confirm failed');
    expect(retry.ack).not.toHaveBeenCalled();
    const invalid = harness({ status: 'invalid', reason: 'bad' });
    invalid.publishDeadLetter.mockRejectedValueOnce(
      new Error('confirm failed'),
    );
    await expect(
      invalid.service.handleDelivery(message(), invalid.channel),
    ).rejects.toThrow('confirm failed');
    expect(invalid.ack).not.toHaveBeenCalled();
  });
  it('ACKs successful and duplicate results once without routing', async () => {
    for (const status of ['processed', 'duplicate']) {
      const h = harness({ status });
      await h.service.handleDelivery(message(), h.channel);
      expect(h.ack).toHaveBeenCalledOnce();
      expect(h.publishRetry).not.toHaveBeenCalled();
      expect(h.publishDeadLetter).not.toHaveBeenCalled();
    }
  });
});
