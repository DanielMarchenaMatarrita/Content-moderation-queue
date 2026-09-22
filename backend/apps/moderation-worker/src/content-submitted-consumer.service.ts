import { Injectable } from '@nestjs/common';
import {
  CONTENT_SUBMITTED_EVENT,
  type ContentSubmittedEvent,
} from '@app/contracts';
import type { Channel, ConsumeMessage } from 'amqplib';
import { CONTENT_SUBMITTED_CONSUMER_CONFIG } from './content-submitted-consumer.constants.js';
import { IdempotentMessageExecutorService } from './idempotent-message-executor.service.js';
import { ContentModerationProcessorService } from './moderation/content-moderation-processor.service.js';

export type ContentSubmittedConsumerResult =
  | { status: 'processed' | 'duplicate'; event: ContentSubmittedEvent }
  | { status: 'invalid'; reason: string }
  | { status: 'failed'; event: ContentSubmittedEvent; error: unknown };

type MessageAcknowledger = Pick<Channel, 'ack'>;

@Injectable()
export class ContentSubmittedConsumerService {
  constructor(
    private readonly executor: IdempotentMessageExecutorService,
    private readonly processor: ContentModerationProcessorService,
  ) {}

  async handleMessage(
    message: ConsumeMessage,
    channel: MessageAcknowledger,
  ): Promise<ContentSubmittedConsumerResult> {
    const parsed = this.parseMessage(message);
    if (!parsed.valid) {
      return { status: 'invalid', reason: parsed.reason };
    }

    const event = parsed.event;

    try {
      const status = await this.executor.executeOnce(
        event.eventId,
        CONTENT_SUBMITTED_CONSUMER_CONFIG.consumerName,
        async (transaction) => {
          await this.processor.process(transaction, event.payload.contentId);
        },
      );

      channel.ack(message);
      return { status, event };
    } catch (error) {
      return { status: 'failed', event, error };
    }
  }

  parseMessage(
    message: Pick<ConsumeMessage, 'content' | 'properties'>,
  ):
    | { valid: true; event: ContentSubmittedEvent }
    | { valid: false; reason: string } {
    let value: unknown;

    try {
      value = JSON.parse(message.content.toString('utf8'));
    } catch {
      return { valid: false, reason: 'Message body is not valid JSON' };
    }

    if (!isRecord(value)) {
      return { valid: false, reason: 'Event envelope must be an object' };
    }
    if (!isUuid(value.eventId)) {
      return { valid: false, reason: 'eventId must be a UUID' };
    }
    if (value.eventType !== CONTENT_SUBMITTED_EVENT.type) {
      return { valid: false, reason: 'Unsupported eventType' };
    }
    if (value.eventVersion !== CONTENT_SUBMITTED_EVENT.version) {
      return { valid: false, reason: 'Unsupported eventVersion' };
    }
    if (
      typeof value.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(value.occurredAt))
    ) {
      return { valid: false, reason: 'occurredAt must be a valid date string' };
    }
    if (!isUuid(value.correlationId)) {
      return { valid: false, reason: 'correlationId must be a UUID' };
    }
    if (!isRecord(value.payload) || !isUuid(value.payload.contentId)) {
      return { valid: false, reason: 'payload.contentId must be a UUID' };
    }

    const metadataError = validateMetadata(message.properties, value);
    if (metadataError) {
      return { valid: false, reason: metadataError };
    }

    return { valid: true, event: value as unknown as ContentSubmittedEvent };
  }
}

function validateMetadata(
  properties: Pick<ConsumeMessage['properties'], 'messageId' | 'correlationId' | 'type'>,
  event: Record<string, unknown>,
): string | undefined {
  if (properties.messageId != null && properties.messageId !== event.eventId) {
    return 'AMQP messageId does not match eventId';
  }
  if (
    properties.correlationId != null &&
    properties.correlationId !== event.correlationId
  ) {
    return 'AMQP correlationId does not match envelope correlationId';
  }
  if (properties.type != null && properties.type !== event.eventType) {
    return 'AMQP type does not match eventType';
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
