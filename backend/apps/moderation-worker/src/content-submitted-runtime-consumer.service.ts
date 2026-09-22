import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { RabbitMqConnectionService } from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CONTENT_SUBMITTED_CONSUMER_CONFIG } from './content-submitted-consumer.constants.js';
import { ContentSubmittedConsumerService } from './content-submitted-consumer.service.js';
import { ContentSubmittedTopologyService } from './content-submitted-topology.service.js';

const SHUTDOWN_DRAIN_TIMEOUT_MS = 10_000;

@Injectable()
export class ContentSubmittedRuntimeConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(
    ContentSubmittedRuntimeConsumerService.name,
  );
  private channel?: ChannelWrapper;
  private deliveryChannel?: Channel;
  private consumerTag?: string;
  private readonly activeDeliveries = new Set<Promise<void>>();
  private stopping = false;

  constructor(
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly consumer: ContentSubmittedConsumerService,
    private readonly topology: ContentSubmittedTopologyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!CONTENT_SUBMITTED_CONSUMER_CONFIG.autoConsume) {
      return;
    }

    const channel = this.rabbitMq.getConnection().createChannel({
      name: 'moderation-content-submitted-consumer',
      confirm: false,
      setup: async (deliveryChannel) => {
        await this.topology.declare(deliveryChannel);
        await deliveryChannel.prefetch(
          CONTENT_SUBMITTED_CONSUMER_CONFIG.prefetch,
        );

        if (this.stopping) {
          return;
        }

        const result = await deliveryChannel.consume(
          CONTENT_SUBMITTED_CONSUMER_CONFIG.queueName,
          (message) => this.onDelivery(message, deliveryChannel),
          { noAck: false },
        );
        this.deliveryChannel = deliveryChannel;
        this.consumerTag = result.consumerTag;
      },
    });
    this.channel = channel;

    await channel.waitForConnect();
  }

  async handleDelivery(
    message: ConsumeMessage | null,
    deliveryChannel: Channel,
  ): Promise<void> {
    if (!message) {
      return;
    }

    await this.consumer.handleMessage(message, deliveryChannel);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    const channel = this.channel;
    if (!channel) {
      return;
    }

    if (this.deliveryChannel && this.consumerTag) {
      try {
        await this.deliveryChannel.cancel(this.consumerTag);
      } catch (error) {
        this.logger.warn('Consumer cancellation failed during shutdown', error);
      }
    }

    await this.drainActiveDeliveries();

    try {
      await channel.close();
    } finally {
      this.consumerTag = undefined;
      this.deliveryChannel = undefined;
      this.channel = undefined;
    }
  }

  private onDelivery(
    message: ConsumeMessage | null,
    deliveryChannel: Channel,
  ): void {
    const delivery = this.handleDelivery(message, deliveryChannel);
    this.activeDeliveries.add(delivery);
    void delivery
      .catch((error: unknown) => {
        this.logger.error('Unexpected ContentSubmitted delivery failure', error);
      })
      .finally(() => this.activeDeliveries.delete(delivery));
  }

  private async drainActiveDeliveries(): Promise<void> {
    if (this.activeDeliveries.size === 0) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const drained = await Promise.race([
      Promise.allSettled(this.activeDeliveries).then(() => true),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), SHUTDOWN_DRAIN_TIMEOUT_MS);
        timeout.unref();
      }),
    ]);

    if (timeout) {
      clearTimeout(timeout);
    }
    if (!drained) {
      this.logger.warn('Timed out draining ContentSubmitted deliveries');
    }
  }
}
