import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  RABBITMQ_TOPOLOGY,
  RabbitMqConnectionService,
} from '@app/messaging';
import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';

@Injectable()
export class ContentSubmittedTopologyService
  implements OnModuleInit, OnModuleDestroy
{
  private channel?: ChannelWrapper;

  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async onModuleInit(): Promise<void> {
    this.channel = this.rabbitMq.getConnection().createChannel({
      name: 'moderation-content-submitted-topology',
      setup: (channel: Channel) => this.declare(channel),
    });

    await this.channel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  async declare(channel: Channel): Promise<void> {
    const exchange = RABBITMQ_TOPOLOGY.eventsExchange;
    const topology = RABBITMQ_TOPOLOGY.contentSubmitted;
    const queue = topology.queueName;

    await channel.assertExchange(exchange.name, exchange.type, {
      durable: exchange.durable,
    });
    await channel.assertQueue(queue, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    await channel.bindQueue(
      queue,
      exchange.name,
      CONTENT_SUBMITTED_EVENT.routingKey,
    );

    await channel.assertExchange(
      topology.retryExchange.name,
      topology.retryExchange.type,
      { durable: topology.retryExchange.durable },
    );
    await channel.assertQueue(topology.retryQueue.name, {
      durable: true,
      exclusive: false,
      autoDelete: false,
      arguments: {
        'x-message-ttl': topology.retryQueue.delayMs,
        'x-dead-letter-exchange': exchange.name,
        'x-dead-letter-routing-key': CONTENT_SUBMITTED_EVENT.routingKey,
      },
    });
    await channel.bindQueue(
      topology.retryQueue.name,
      topology.retryExchange.name,
      topology.retryQueue.routingKey,
    );

    await channel.assertExchange(
      topology.deadLetterExchange.name,
      topology.deadLetterExchange.type,
      { durable: topology.deadLetterExchange.durable },
    );
    await channel.assertQueue(topology.deadLetterQueue.name, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    await channel.bindQueue(
      topology.deadLetterQueue.name,
      topology.deadLetterExchange.name,
      topology.deadLetterQueue.routingKey,
    );
  }
}
