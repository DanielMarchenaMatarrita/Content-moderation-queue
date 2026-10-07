import type { ConsumeMessage } from 'amqplib';
import { PaymentOrderCreatedConsumerService } from './payment-order-created-consumer.service.js';

const event = {
  eventId: '68191604-b060-4e20-ac85-d38456704f08',
  eventType: 'payment-order.created',
  eventVersion: 1,
  occurredAt: '2026-10-04T00:00:00.000Z',
  correlationId: '53b604a6-f10d-42e2-a47e-25d9a641726e',
  payload: { orderId: '206eb712-8f3d-48d9-b95f-27624bc4f738' },
};
function message(body: unknown): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(body)),
    properties: {},
  } as ConsumeMessage;
}

describe('PaymentOrderCreatedConsumerService', () => {
  it.each([
    [{ ...event, eventType: 'payment-order.deleted' }],
    [{ ...event, eventVersion: 2 }],
    [{ ...event, payload: {} }],
    [{ ...event, payload: { orderId: event.payload.orderId, extra: true } }],
  ])('rejects invalid envelope or non-exact payload', (body) => {
    const service = new PaymentOrderCreatedConsumerService({
      process: vi.fn(),
    } as never);
    expect(service.parseMessage(message(body))).toEqual(
      expect.objectContaining({ valid: false }),
    );
  });
  it('passes valid event to processor using current retry count', async () => {
    const process = vi.fn().mockResolvedValue('processed');
    const service = new PaymentOrderCreatedConsumerService({
      process,
    } as never);
    await expect(
      service.handleMessage(message(event), 2),
    ).resolves.toMatchObject({ status: 'processed', event });
    expect(process).toHaveBeenCalledWith(
      event.eventId,
      event.payload.orderId,
      2,
    );
  });
});
