import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  connect,
  type AmqpConnectionManager,
  type ChannelWrapper,
} from 'amqp-connection-manager';
import { rabbitMqConfig } from './rabbitmq.config.js';
import { RABBITMQ_ENV, RABBITMQ_TOPOLOGY } from './rabbitmq.constants.js';

@Injectable()
export class RabbitMqConnectionService implements OnModuleInit, OnModuleDestroy {
  private connection?: AmqpConnectionManager;
  private topologyChannel?: ChannelWrapper;

  constructor(
    @Inject(rabbitMqConfig.KEY)
    private readonly config: ConfigType<typeof rabbitMqConfig>,
  ) {}

  onModuleInit(): void {
    const url = this.config.url?.trim();

    if (!url) {
      throw new Error(
        `${RABBITMQ_ENV.url} is required when RabbitMQ messaging is enabled`,
      );
    }

    this.connection = connect(url);
    this.topologyChannel = this.connection.createChannel({
      name: 'rabbitmq-topology',
      setup: async (channel) => {
        const exchange = RABBITMQ_TOPOLOGY.eventsExchange;
        await channel.assertExchange(exchange.name, exchange.type, {
          durable: exchange.durable,
        });
      },
    });
  }

  getConnection(): AmqpConnectionManager {
    if (!this.connection) {
      throw new Error('RabbitMQ connection has not been initialized');
    }

    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    await this.topologyChannel?.close();
    await this.connection?.close();
  }
}
