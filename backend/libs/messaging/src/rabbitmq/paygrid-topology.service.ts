import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PAYMENT_ORDER_CREATED_EVENT } from '@app/contracts';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { RabbitMqConnectionService } from './rabbitmq-connection.service.js';
import { RABBITMQ_TOPOLOGY } from './rabbitmq.constants.js';

@Injectable()
export class PaygridTopologyService implements OnModuleInit, OnModuleDestroy {
  private channel?: ChannelWrapper;

  constructor(private readonly rabbitMq: RabbitMqConnectionService) {}

  async onModuleInit(): Promise<void> {
    this.channel = this.rabbitMq.getConnection().createChannel({
      name: 'paygrid-topology',
      setup: (channel: Channel) => this.declare(channel),
    });

    await this.channel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
  }

  async declare(channel: Channel): Promise<void> {
    const topology = RABBITMQ_TOPOLOGY.paygrid;
    const paymentOrder = topology.paymentOrderCreated;

    await channel.assertExchange(
      topology.eventsExchange.name,
      topology.eventsExchange.type,
      { durable: topology.eventsExchange.durable },
    );
    await channel.assertQueue(paymentOrder.queueName, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    await channel.bindQueue(
      paymentOrder.queueName,
      topology.eventsExchange.name,
      PAYMENT_ORDER_CREATED_EVENT.routingKey,
    );

    await channel.assertExchange(
      topology.retryExchange.name,
      topology.retryExchange.type,
      { durable: topology.retryExchange.durable },
    );
    await channel.assertQueue(paymentOrder.retryQueue.name, {
      durable: true,
      exclusive: false,
      autoDelete: false,
      arguments: {
        'x-message-ttl': paymentOrder.retryQueue.delayMs,
        'x-dead-letter-exchange': topology.eventsExchange.name,
        'x-dead-letter-routing-key': PAYMENT_ORDER_CREATED_EVENT.routingKey,
      },
    });
    await channel.bindQueue(
      paymentOrder.retryQueue.name,
      topology.retryExchange.name,
      paymentOrder.retryQueue.routingKey,
    );

    await channel.assertExchange(
      topology.deadLetterExchange.name,
      topology.deadLetterExchange.type,
      { durable: topology.deadLetterExchange.durable },
    );
    await channel.assertQueue(paymentOrder.deadLetterQueue.name, {
      durable: true,
      exclusive: false,
      autoDelete: false,
    });
    await channel.bindQueue(
      paymentOrder.deadLetterQueue.name,
      topology.deadLetterExchange.name,
      paymentOrder.deadLetterQueue.routingKey,
    );
  }
}
