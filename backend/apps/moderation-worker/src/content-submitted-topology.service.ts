import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  RABBITMQ_TOPOLOGY,
  RabbitMqConnectionService,
} from '@app/messaging';
import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { CONTENT_SUBMITTED_CONSUMER_CONFIG } from './content-submitted-consumer.constants.js';

@Injectable()
export class ContentSubmittedTopologyService
  implements OnModuleInit, OnModuleDestroy
{
  private channel?: ChannelWrapper;

  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async onModuleInit(): Promise<void> {
    this.channel = this.rabbitMq.getConnection().createChannel({
      name: 'moderation-content-submitted-topology',
      setup: async (channel) => {
        const exchange = RABBITMQ_TOPOLOGY.eventsExchange;
        const queue = CONTENT_SUBMITTED_CONSUMER_CONFIG.queueName;

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
      },
    });

    await this.channel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }
}
