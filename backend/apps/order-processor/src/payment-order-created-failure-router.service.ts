import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { RABBITMQ_TOPOLOGY, RabbitMqConnectionService } from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage, Options } from 'amqplib';

@Injectable()
export class PaymentOrderCreatedFailureRouterService
  implements OnModuleInit, OnModuleDestroy
{
  private channel?: ChannelWrapper;

  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async onModuleInit(): Promise<void> {
    this.channel = this.rabbitMq.getConnection().createChannel({
      name: 'order-processor-payment-order-created-failure-router',
      confirm: true,
      publishTimeout:
        RABBITMQ_TOPOLOGY.paygrid.paymentOrderCreated.publishTimeoutMs,
      setup: async (channel) => {
        await channel.assertExchange(
          RABBITMQ_TOPOLOGY.paygrid.retryExchange.name,
          RABBITMQ_TOPOLOGY.paygrid.retryExchange.type,
          { durable: true },
        );
        await channel.assertExchange(
          RABBITMQ_TOPOLOGY.paygrid.deadLetterExchange.name,
          RABBITMQ_TOPOLOGY.paygrid.deadLetterExchange.type,
          { durable: true },
        );
      },
    });
    await this.channel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  async publishRetry(
    message: ConsumeMessage,
    retryCount: number,
  ): Promise<void> {
    const topology = RABBITMQ_TOPOLOGY.paygrid;
    await this.publish(
      topology.retryExchange.name,
      topology.paymentOrderCreated.retryQueue.routingKey,
      message,
      {
        [topology.paymentOrderCreated.retryHeader]: retryCount,
        'x-original-queue': topology.paymentOrderCreated.queueName,
      },
    );
  }

  async publishDeadLetter(
    message: ConsumeMessage,
    reason: unknown,
  ): Promise<void> {
    const topology = RABBITMQ_TOPOLOGY.paygrid;
    await this.publish(
      topology.deadLetterExchange.name,
      topology.paymentOrderCreated.deadLetterQueue.routingKey,
      message,
      {
        'x-original-queue': topology.paymentOrderCreated.queueName,
        'x-failure-reason': sanitizeReason(reason),
      },
    );
  }

  private async publish(
    exchange: string,
    routingKey: string,
    message: ConsumeMessage,
    addedHeaders: Record<string, string | number>,
  ): Promise<void> {
    if (!this.channel)
      throw new Error('Failure router channel has not been initialized');
    const headers = message.properties.headers;
    const preserved =
      typeof headers === 'object' && headers !== null && !Array.isArray(headers)
        ? Object.fromEntries(
            Object.entries(headers)
              .filter(
                ([key, value]) =>
                  key !== 'x-death' &&
                  (typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean'),
              )
              .slice(0, 20),
          )
        : {};
    const options: Options.Publish = {
      persistent: true,
      contentType: message.properties.contentType || 'application/json',
      messageId: message.properties.messageId,
      correlationId: message.properties.correlationId,
      type: message.properties.type,
      headers: { ...preserved, ...addedHeaders },
    };
    await this.channel.publish(exchange, routingKey, message.content, options);
  }
}

function sanitizeReason(reason: unknown): string {
  const value =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unknown processing failure';
  return value
    .replace(/(?:amqps?|postgres(?:ql)?):\/\/[^\s'"<>]+/gi, '[REDACTED_URL]')
    .slice(0, 256);
}
