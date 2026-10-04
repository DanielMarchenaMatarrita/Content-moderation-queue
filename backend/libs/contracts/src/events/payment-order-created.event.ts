import type { IntegrationEvent } from './integration-event.js';

export const PAYMENT_ORDER_CREATED_EVENT = {
  type: 'payment-order.created',
  version: 1,
  routingKey: 'payment-order.created',
} as const;

export interface PaymentOrderCreatedPayload {
  orderId: string;
}

export type PaymentOrderCreatedEvent =
  IntegrationEvent<PaymentOrderCreatedPayload>;
