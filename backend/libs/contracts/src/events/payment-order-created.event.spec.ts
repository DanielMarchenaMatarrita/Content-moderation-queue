import {
  PAYMENT_ORDER_CREATED_EVENT,
  type PaymentOrderCreatedEvent,
} from './payment-order-created.event.js';

describe('PaymentOrderCreatedEvent', () => {
  it('uses integration-event envelope and v1 payment-order payload', () => {
    const event: PaymentOrderCreatedEvent = {
      eventId: 'fa5c9d69-574d-4ea1-bb34-88c7d6e4c407',
      eventType: PAYMENT_ORDER_CREATED_EVENT.type,
      eventVersion: PAYMENT_ORDER_CREATED_EVENT.version,
      occurredAt: '2026-10-03T00:00:00.000Z',
      correlationId: '0711c8ba-e1f1-4ddf-857f-2a6c87bed69f',
      payload: { orderId: '3b66f5f0-7ddc-4f9f-9330-c89aa5cf67c4' },
    };

    expect(PAYMENT_ORDER_CREATED_EVENT).toEqual({
      type: 'payment-order.created',
      version: 1,
      routingKey: 'payment-order.created',
    });
    expect(event).toEqual({
      eventId: 'fa5c9d69-574d-4ea1-bb34-88c7d6e4c407',
      eventType: 'payment-order.created',
      eventVersion: 1,
      occurredAt: '2026-10-03T00:00:00.000Z',
      correlationId: '0711c8ba-e1f1-4ddf-857f-2a6c87bed69f',
      payload: { orderId: '3b66f5f0-7ddc-4f9f-9330-c89aa5cf67c4' },
    });
  });
});
