import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import type { RabbitMqConnectionService } from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CONTENT_SUBMITTED_CONSUMER_CONFIG } from './content-submitted-consumer.constants.js';
import { ContentSubmittedConsumerService } from './content-submitted-consumer.service.js';
import { ContentSubmittedRuntimeConsumerService } from './content-submitted-runtime-consumer.service.js';
import type { ContentSubmittedTopologyService } from './content-submitted-topology.service.js';
import type {
  IdempotentMessageExecutorService,
  TransactionClient,
} from './idempotent-message-executor.service.js';
import type { ContentModerationProcessorService } from './moderation/content-moderation-processor.service.js';

function createHarness(consumerOverride?: ContentSubmittedConsumerService) {
  const close = vi.fn().mockResolvedValue(undefined);
  const ack = vi.fn();
  const prefetch = vi.fn().mockResolvedValue(undefined);
  const cancel = vi.fn().mockResolvedValue(undefined);
  let delivery: ((message: ConsumeMessage | null) => void) | undefined;
  const consume = vi
    .fn()
    .mockImplementation(async (_queue, onMessage) => {
      delivery = onMessage;
      return { consumerTag: 'consumer-tag-1' };
    });
  const deliveryChannel = {
    ack,
    prefetch,
    consume,
    cancel,
  } as unknown as Channel;
  let setup: ((channel: Channel) => Promise<void>) | undefined;
  const waitForConnect = vi.fn().mockImplementation(async () => {
    await setup?.(deliveryChannel);
  });
  const channel = {
    waitForConnect,
    close,
  } as unknown as ChannelWrapper;
  const createChannel = vi.fn().mockImplementation((options) => {
    setup = options.setup;
    return channel;
  });
  const rabbitMq = {
    getConnection: () => ({ createChannel }),
  } as unknown as RabbitMqConnectionService;
  const handleMessage = vi.fn().mockResolvedValue({ status: 'processed' });
  const consumer =
    consumerOverride ??
    ({ handleMessage } as unknown as ContentSubmittedConsumerService);
  const declare = vi.fn().mockResolvedValue(undefined);
  const topology = { declare } as unknown as ContentSubmittedTopologyService;
  const service = new ContentSubmittedRuntimeConsumerService(
    rabbitMq,
    consumer,
    topology,
  );

  return {
    service,
    channel,
    deliveryChannel,
    waitForConnect,
    consume,
    prefetch,
    cancel,
    close,
    ack,
    declare,
    createChannel,
    handleMessage,
    getDelivery: () => delivery,
    runSetup: (nextChannel: Channel) => setup?.(nextChannel),
  };
}

describe('ContentSubmittedRuntimeConsumerService', () => {
  it('registers the queue consumer with manual ACK and configured prefetch', async () => {
    const harness = createHarness();

    await harness.service.onApplicationBootstrap();

    expect(CONTENT_SUBMITTED_CONSUMER_CONFIG.autoConsume).toBe(true);
    expect(harness.createChannel).toHaveBeenCalledWith({
      name: 'moderation-content-submitted-consumer',
      confirm: false,
      setup: expect.any(Function),
    });
    expect(harness.waitForConnect).toHaveBeenCalledOnce();
    expect(harness.declare).toHaveBeenCalledWith(harness.deliveryChannel);
    expect(harness.prefetch).toHaveBeenCalledWith(10);
    expect(harness.consume).toHaveBeenCalledWith(
      'moderation.content-submitted.v1',
      expect.any(Function),
      { noAck: false },
    );
    expect(harness.declare.mock.invocationCallOrder[0]).toBeLessThan(
      harness.prefetch.mock.invocationCallOrder[0],
    );
    expect(harness.prefetch.mock.invocationCallOrder[0]).toBeLessThan(
      harness.consume.mock.invocationCallOrder[0],
    );
  });

  it('delegates with the delivery channel and never ACKs in the runtime layer', async () => {
    const harness = createHarness();
    const message = { content: Buffer.from('{}') } as ConsumeMessage;

    await harness.service.onApplicationBootstrap();
    harness.getDelivery()!(message);
    await vi.waitFor(() => expect(harness.handleMessage).toHaveBeenCalledOnce());

    expect(harness.handleMessage).toHaveBeenCalledWith(
      message,
      harness.deliveryChannel,
    );
    expect(harness.ack).not.toHaveBeenCalled();
  });

  it('redeclares topology and binds delivery handling to a reconnected channel', async () => {
    const harness = createHarness();
    const secondAck = vi.fn();
    const secondPrefetch = vi.fn().mockResolvedValue(undefined);
    let secondDelivery: ((message: ConsumeMessage | null) => void) | undefined;
    const secondConsume = vi
      .fn()
      .mockImplementation(async (_queue, onMessage) => {
        secondDelivery = onMessage;
        return { consumerTag: 'consumer-tag-2' };
      });
    const secondChannel = {
      ack: secondAck,
      prefetch: secondPrefetch,
      consume: secondConsume,
      cancel: vi.fn().mockResolvedValue(undefined),
    } as unknown as Channel;
    const message = { content: Buffer.from('{}') } as ConsumeMessage;

    await harness.service.onApplicationBootstrap();
    await harness.runSetup(secondChannel);
    secondDelivery!(message);
    await vi.waitFor(() => expect(harness.handleMessage).toHaveBeenCalledOnce());

    expect(harness.declare).toHaveBeenLastCalledWith(secondChannel);
    expect(secondPrefetch).toHaveBeenCalledWith(10);
    expect(secondConsume).toHaveBeenCalledWith(
      'moderation.content-submitted.v1',
      expect.any(Function),
      { noAck: false },
    );
    expect(harness.handleMessage).toHaveBeenCalledWith(message, secondChannel);
    expect(secondAck).not.toHaveBeenCalled();
  });

  it('preserves the real processor transaction path and ACKs exactly once', async () => {
    const transaction = {} as TransactionClient;
    const executeOnce = vi
      .fn()
      .mockImplementation(async (_eventId, _consumerName, callback) => {
        await callback(transaction);
        return 'processed';
      });
    const process = vi.fn().mockResolvedValue({ status: 'moderated' });
    const consumer = new ContentSubmittedConsumerService(
      { executeOnce } as unknown as IdempotentMessageExecutorService,
      { process } as unknown as ContentModerationProcessorService,
    );
    const harness = createHarness(consumer);
    const event = {
      eventId: '68191604-b060-4e20-ac85-d38456704f08',
      eventType: CONTENT_SUBMITTED_EVENT.type,
      eventVersion: CONTENT_SUBMITTED_EVENT.version,
      occurredAt: '2026-09-22T12:00:00.000Z',
      correlationId: '53b604a6-f10d-42e2-a47e-25d9a641726e',
      payload: { contentId: '206eb712-8f3d-48d9-b95f-27624bc4f738' },
    };
    const message = {
      content: Buffer.from(JSON.stringify(event)),
      properties: {
        messageId: event.eventId,
        correlationId: event.correlationId,
        type: event.eventType,
      },
    } as unknown as ConsumeMessage;

    await harness.service.onApplicationBootstrap();
    harness.getDelivery()!(message);
    await vi.waitFor(() => expect(harness.ack).toHaveBeenCalledOnce());

    expect(process).toHaveBeenCalledWith(transaction, event.payload.contentId);
    expect(harness.ack).toHaveBeenCalledTimes(1);
    expect(harness.ack).toHaveBeenCalledWith(message);
  });

  it('ignores null deliveries', async () => {
    const harness = createHarness();

    await harness.service.onApplicationBootstrap();
    await harness.service.handleDelivery(null, harness.deliveryChannel);

    expect(harness.handleMessage).not.toHaveBeenCalled();
    expect(harness.ack).not.toHaveBeenCalled();
  });

  it('cancels the consumer and closes only its wrapper on shutdown', async () => {
    const harness = createHarness();

    await harness.service.onApplicationBootstrap();
    await harness.service.onModuleDestroy();

    expect(harness.cancel).toHaveBeenCalledWith('consumer-tag-1');
    expect(harness.close).toHaveBeenCalledOnce();
    expect(harness.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      harness.close.mock.invocationCallOrder[0],
    );
  });

  it('drains an in-flight delivery before closing its wrapper', async () => {
    let completeDelivery!: () => void;
    const activeDelivery = new Promise<void>((resolve) => {
      completeDelivery = resolve;
    });
    const handleMessage = vi.fn().mockReturnValue(activeDelivery);
    const consumer = {
      handleMessage,
    } as unknown as ContentSubmittedConsumerService;
    const harness = createHarness(consumer);
    const message = { content: Buffer.from('{}') } as ConsumeMessage;

    await harness.service.onApplicationBootstrap();
    harness.getDelivery()!(message);
    await vi.waitFor(() => expect(handleMessage).toHaveBeenCalledOnce());

    const shutdown = harness.service.onModuleDestroy();
    await vi.waitFor(() => expect(harness.cancel).toHaveBeenCalledOnce());
    expect(harness.close).not.toHaveBeenCalled();

    completeDelivery();
    await shutdown;
    expect(harness.close).toHaveBeenCalledOnce();
  });
});
