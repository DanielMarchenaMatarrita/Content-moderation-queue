import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { RABBITMQ_TOPOLOGY, RabbitMqConnectionService } from '@app/messaging';
import { logApplicationEvent } from '@app/observability';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { PAYMENT_ORDER_CREATED_CONSUMER_CONFIG } from './payment-order-created.constants.js';
import { PaymentOrderCreatedConsumerService } from './payment-order-created-consumer.service.js';
import { PaymentOrderCreatedFailureRouterService } from './payment-order-created-failure-router.service.js';

@Injectable()
export class PaymentOrderCreatedRuntimeConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private channel?: ChannelWrapper;
  private deliveryChannel?: Channel;
  private consumerTag?: string;

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly consumer: PaymentOrderCreatedConsumerService,
    private readonly failureRouter: PaymentOrderCreatedFailureRouterService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.channel = this.rabbitMq.getConnection().createChannel({
      name: 'order-processor-payment-order-created-consumer',
      confirm: false,
      setup: async (channel) => {
        await channel.prefetch(PAYMENT_ORDER_CREATED_CONSUMER_CONFIG.prefetch);
        const result = await channel.consume(
          PAYMENT_ORDER_CREATED_CONSUMER_CONFIG.queueName,
          (message) => {
            void this.handleDelivery(message, channel).catch(() =>
              logApplicationEvent('order-processor', 'error', {
                event: 'payment_order_delivery_failed',
              }),
            );
          },
          { noAck: false },
        );
        this.deliveryChannel = channel;
        this.consumerTag = result.consumerTag;
      },
    });
    await this.channel.waitForConnect();
  }

  async handleDelivery(
    message: ConsumeMessage | null,
    channel: Channel,
  ): Promise<void> {
    if (!message) return;
    const retryCount = readRetryCount(message);
    const result = await this.consumer.handleMessage(message, retryCount);
    if (result.status === 'processed' || result.status === 'duplicate') {
      channel.ack(message);
      return;
    }
    if (result.status === 'invalid') {
      await this.failureRouter.publishDeadLetter(message, result.reason);
      logApplicationEvent('order-processor', 'error', {
        event: 'payment_order_dlq_published',
        result: 'invalid',
        retryCount,
      });
      channel.ack(message);
      return;
    }
    if (retryCount >= PAYMENT_ORDER_CREATED_CONSUMER_CONFIG.maxRetries) {
      await this.failureRouter.publishDeadLetter(
        message,
        'Payment order processing exhausted retries',
      );
      logApplicationEvent('order-processor', 'error', {
        event: 'payment_order_dlq_published',
        orderId: result.event?.payload.orderId,
        result: 'failed',
        retryCount,
      });
    } else {
      await this.failureRouter.publishRetry(message, retryCount + 1);
      logApplicationEvent('order-processor', 'warn', {
        event: 'payment_order_retry_published',
        orderId: result.event?.payload.orderId,
        result: 'retrying',
        retryCount: retryCount + 1,
      });
    }
    channel.ack(message);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.deliveryChannel && this.consumerTag)
      await this.deliveryChannel.cancel(this.consumerTag);
    await this.channel?.close();
  }
}

function readRetryCount(message: ConsumeMessage): number {
  const value =
    message.properties.headers?.[
      RABBITMQ_TOPOLOGY.paygrid.paymentOrderCreated.retryHeader
    ];
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : 0;
}
