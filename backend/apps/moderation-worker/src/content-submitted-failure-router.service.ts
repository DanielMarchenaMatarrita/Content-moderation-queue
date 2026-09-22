import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { RabbitMqConnectionService, RABBITMQ_TOPOLOGY } from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage, Options } from 'amqplib';

const FAILURE_REASON_MAX_LENGTH = 256;
const MAX_PRESERVED_HEADERS = 20;
const HEADER_STRING_MAX_LENGTH = 512;

@Injectable()
export class ContentSubmittedFailureRouterService
  implements OnModuleInit, OnModuleDestroy
{
  private channel?: ChannelWrapper;
  private readonly activePublishes = new Set<Promise<void>>();
  private stopping = false;

  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async onModuleInit(): Promise<void> {
    this.channel = this.rabbitMq.getConnection().createChannel({
      name: 'moderation-content-submitted-failure-router',
      confirm: true,
      publishTimeout: RABBITMQ_TOPOLOGY.contentSubmitted.publishTimeoutMs,
      setup: async (channel) => {
        const topology = RABBITMQ_TOPOLOGY.contentSubmitted;
        await channel.assertExchange(
          topology.retryExchange.name,
          topology.retryExchange.type,
          { durable: topology.retryExchange.durable },
        );
        await channel.assertExchange(
          topology.deadLetterExchange.name,
          topology.deadLetterExchange.type,
          { durable: topology.deadLetterExchange.durable },
        );
      },
    });

    await this.channel.waitForConnect();
  }

  async publishRetry(message: ConsumeMessage, retryCount: number): Promise<void> {
    const topology = RABBITMQ_TOPOLOGY.contentSubmitted;
    await this.trackPublish(() =>
      this.publish(
        topology.retryExchange.name,
        topology.retryQueue.routingKey,
        message,
        {
          [topology.retryHeader]: retryCount,
          'x-original-queue': topology.queueName,
        },
      ),
    );
  }

  async publishDeadLetter(
    message: ConsumeMessage,
    reason: unknown,
  ): Promise<void> {
    const topology = RABBITMQ_TOPOLOGY.contentSubmitted;
    await this.trackPublish(() =>
      this.publish(
        topology.deadLetterExchange.name,
        topology.deadLetterQueue.routingKey,
        message,
        {
          'x-original-queue': topology.queueName,
          'x-failure-reason': sanitizeReason(reason),
        },
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await Promise.allSettled(this.activePublishes);
    await this.channel?.close();
  }

  private async trackPublish(publish: () => Promise<void>): Promise<void> {
    if (this.stopping) {
      throw new Error('Failure router is stopping');
    }
    const publication = publish();
    this.activePublishes.add(publication);
    try {
      await publication;
    } finally {
      this.activePublishes.delete(publication);
    }
  }

  private async publish(
    exchange: string,
    routingKey: string,
    message: ConsumeMessage,
    addedHeaders: Record<string, string | number>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Failure router channel has not been initialized');
    }

    const properties = message.properties;
    const options: Options.Publish = {
      persistent: true,
      contentType: properties.contentType || 'application/json',
      messageId: properties.messageId,
      correlationId: properties.correlationId,
      type: properties.type,
      headers: {
        ...safeHeaders(properties.headers),
        ...addedHeaders,
      },
    };

    await this.channel.publish(exchange, routingKey, message.content, options);
  }
}

function safeHeaders(headers: unknown): Record<string, string | number | boolean> {
  if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
    return {};
  }

  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(headers).slice(
    0,
    MAX_PRESERVED_HEADERS,
  )) {
    if (key === 'x-death') {
      continue;
    }
    if (typeof value === 'string') {
      safe[key] = value.slice(0, HEADER_STRING_MAX_LENGTH);
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

function sanitizeReason(reason: unknown): string {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unknown processing failure';

  return message
    .replace(/(?:amqps?|postgres(?:ql)?):\/\/[^\s'"<>]+/gi, '[REDACTED_URL]')
    .slice(0, FAILURE_REASON_MAX_LENGTH);
}
