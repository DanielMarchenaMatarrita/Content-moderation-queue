import { Injectable } from '@nestjs/common';
import {
  PAYMENT_ORDER_CREATED_EVENT,
  type PaymentOrderCreatedEvent,
} from '@app/contracts';
import type { ConsumeMessage } from 'amqplib';
import {
  PaymentOrderProcessorService,
  type PaymentOrderExecution,
} from './payment-order-processor.service.js';

export type PaymentOrderConsumerResult =
  | { status: PaymentOrderExecution; event: PaymentOrderCreatedEvent }
  | { status: 'invalid'; reason: string };

@Injectable()
export class PaymentOrderCreatedConsumerService {
  constructor(private readonly processor: PaymentOrderProcessorService) {}

  async handleMessage(
    message: ConsumeMessage,
    retryCount: number,
  ): Promise<PaymentOrderConsumerResult> {
    const parsed = this.parseMessage(message);
    if (!parsed.valid) return parsed;
    try {
      return {
        status: await this.processor.process(
          parsed.event.eventId,
          parsed.event.payload.orderId,
          retryCount,
        ),
        event: parsed.event,
      };
    } catch {
      return { status: 'failed', event: parsed.event };
    }
  }

  parseMessage(
    message: Pick<ConsumeMessage, 'content' | 'properties'>,
  ):
    | { valid: true; event: PaymentOrderCreatedEvent }
    | { valid: false; reason: string } {
    let value: unknown;
    try {
      value = JSON.parse(message.content.toString('utf8'));
    } catch {
      return { valid: false, reason: 'Message body is not valid JSON' };
    }
    if (
      !isRecord(value) ||
      !isUuid(value.eventId) ||
      value.eventType !== PAYMENT_ORDER_CREATED_EVENT.type ||
      value.eventVersion !== PAYMENT_ORDER_CREATED_EVENT.version ||
      typeof value.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(value.occurredAt)) ||
      !isUuid(value.correlationId)
    )
      return { valid: false, reason: 'Invalid payment-order.created envelope' };
    if (
      !isRecord(value.payload) ||
      Object.keys(value.payload).length !== 1 ||
      !isUuid(value.payload.orderId)
    )
      return {
        valid: false,
        reason: 'payload must exactly contain orderId UUID',
      };
    if (
      (message.properties.messageId != null &&
        message.properties.messageId !== value.eventId) ||
      (message.properties.correlationId != null &&
        message.properties.correlationId !== value.correlationId) ||
      (message.properties.type != null &&
        message.properties.type !== value.eventType)
    )
      return { valid: false, reason: 'AMQP metadata does not match envelope' };
    return { valid: true, event: value as PaymentOrderCreatedEvent };
  }
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
