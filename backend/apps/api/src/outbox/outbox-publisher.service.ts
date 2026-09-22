import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  CONTENT_SUBMITTED_EVENT,
  type ContentSubmittedEvent,
  type ContentSubmittedPayload,
} from '@app/contracts';
import { PrismaService } from '@app/database';
import {
  RabbitMqConnectionService,
  RABBITMQ_TOPOLOGY,
} from '@app/messaging';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { OutboxEvent } from '../../../../generated/prisma/client.js';
import { OUTBOX_PUBLISHER_CONFIG } from './outbox-publisher.constants.js';

interface EventRoute {
  routingKey: string;
  payload: ContentSubmittedPayload;
}

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly instanceId = randomUUID();
  private publisherChannel?: ChannelWrapper;
  private pollTimer?: NodeJS.Timeout;
  private activeCycle?: Promise<void>;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  onModuleInit(): void {
    const exchange = RABBITMQ_TOPOLOGY.eventsExchange;

    this.publisherChannel = this.rabbitMq.getConnection().createChannel({
      name: 'outbox-publisher',
      confirm: true,
      publishTimeout: OUTBOX_PUBLISHER_CONFIG.publishTimeoutMs,
      setup: async (channel) => {
        await channel.assertExchange(exchange.name, exchange.type, {
          durable: exchange.durable,
        });
      },
    });

    this.scheduleNextCycle(0);
  }

  async publishPendingBatch(): Promise<void> {
    const events = await this.claimPendingEvents();

    for (const event of events) {
      try {
        await this.publishEvent(event);
      } catch (error) {
        try {
          await this.markFailed(event, error);
        } catch (persistenceError) {
          this.logger.error(
            `Could not persist outbox failure: ${this.sanitizeError(persistenceError)}`,
          );
        }
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    await this.activeCycle;
    await this.publisherChannel?.close();
  }

  private async claimPendingEvents(): Promise<OutboxEvent[]> {
    const { batchSize, claimTtlMs } = OUTBOX_PUBLISHER_CONFIG;

    return this.prisma.$queryRaw<OutboxEvent[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE "publishedAt" IS NULL
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
          AND (
            "claimedAt" IS NULL
            OR "claimedAt" <= NOW() - (${claimTtlMs} * INTERVAL '1 millisecond')
          )
        ORDER BY "createdAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE "OutboxEvent" AS outbox
      SET
        "claimedAt" = NOW(),
        "claimedBy" = ${this.instanceId}
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING outbox.*
    `;
  }

  private async publishEvent(event: OutboxEvent): Promise<void> {
    if (!this.publisherChannel) {
      throw new Error('Outbox publisher channel has not been initialized');
    }

    const route = this.resolveRoute(event);
    const envelope: ContentSubmittedEvent = {
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      occurredAt: event.occurredAt.toISOString(),
      correlationId: event.correlationId,
      payload: route.payload,
    };

    await this.publisherChannel.publish(
      RABBITMQ_TOPOLOGY.eventsExchange.name,
      route.routingKey,
      JSON.stringify(envelope),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        correlationId: event.correlationId,
        type: event.eventType,
      },
    );

    await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        claimedBy: this.instanceId,
        publishedAt: null,
      },
      data: {
        publishedAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        nextAttemptAt: null,
        lastError: null,
      },
    });
  }

  private resolveRoute(event: OutboxEvent): EventRoute {
    if (event.eventType !== CONTENT_SUBMITTED_EVENT.type) {
      throw new Error(`Unsupported event type: ${event.eventType}`);
    }

    if (event.eventVersion !== CONTENT_SUBMITTED_EVENT.version) {
      throw new Error(
        `Unsupported ${CONTENT_SUBMITTED_EVENT.type} version: ${event.eventVersion}`,
      );
    }

    if (!this.isContentSubmittedPayload(event.payload)) {
      throw new Error(`Invalid ${CONTENT_SUBMITTED_EVENT.type} payload`);
    }

    return {
      routingKey: CONTENT_SUBMITTED_EVENT.routingKey,
      payload: event.payload,
    };
  }

  private isContentSubmittedPayload(
    payload: unknown,
  ): payload is ContentSubmittedPayload {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return false;
    }

    const record = payload as Record<string, unknown>;
    return (
      Object.keys(record).length === 1 &&
      typeof record.contentId === 'string' &&
      record.contentId.trim().length > 0
    );
  }

  private async markFailed(event: OutboxEvent, error: unknown): Promise<void> {
    const retryDelay = Math.min(
      OUTBOX_PUBLISHER_CONFIG.retryBaseMs * 2 ** event.retryCount,
      OUTBOX_PUBLISHER_CONFIG.retryMaxMs,
    );

    await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        claimedBy: this.instanceId,
        publishedAt: null,
      },
      data: {
        retryCount: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + retryDelay),
        lastError: this.sanitizeError(error),
        claimedAt: null,
        claimedBy: null,
      },
    });
  }

  private sanitizeError(error: unknown): string {
    let message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown outbox publisher error';

    for (const key of ['RABBITMQ_URL', 'DATABASE_URL', 'DIRECT_URL']) {
      const secret = process.env[key];
      if (secret) {
        message = message.replaceAll(secret, '[REDACTED]');

        try {
          const url = new URL(secret);
          const credentials = [
            url.username,
            url.password,
            decodeURIComponent(url.username),
            decodeURIComponent(url.password),
          ];

          for (const credential of credentials) {
            if (credential) {
              message = message.replaceAll(credential, '[REDACTED]');
            }
          }
        } catch {
          // Non-URL configuration values are already redacted by exact match.
        }
      }
    }

    return message
      .replace(/(?:amqps?|postgres(?:ql)?):\/\/[^\s'"<>]+/gi, '[REDACTED_URL]')
      .slice(0, OUTBOX_PUBLISHER_CONFIG.lastErrorMaxLength);
  }

  private scheduleNextCycle(delayMs: number): void {
    if (this.stopping) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined;
      const cycle = this.runCycle();
      this.activeCycle = cycle;

      void cycle.finally(() => {
        if (this.activeCycle === cycle) {
          this.activeCycle = undefined;
        }

        this.scheduleNextCycle(OUTBOX_PUBLISHER_CONFIG.pollIntervalMs);
      });
    }, delayMs);
  }

  private async runCycle(): Promise<void> {
    try {
      await this.publishPendingBatch();
    } catch (error) {
      this.logger.error(`Outbox cycle failed: ${this.sanitizeError(error)}`);
    }
  }
}
