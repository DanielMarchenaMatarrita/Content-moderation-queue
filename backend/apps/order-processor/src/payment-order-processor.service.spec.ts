import type { PrismaService } from '@app/database';
import { PaymentOrderProcessorService } from './payment-order-processor.service.js';

function harness(scenario: string) {
  const processingAttempt = { upsert: vi.fn().mockResolvedValue(undefined) };
  const paymentOrder = {
    findUnique: vi.fn().mockResolvedValue({ simulationScenario: scenario }),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const processedMessage = {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(undefined),
  };
  const tx = { processingAttempt, paymentOrder, processedMessage };
  const prisma = {
    paymentOrder,
    processedMessage,
    $transaction: vi.fn(async (callback) => callback(tx)),
  } as unknown as PrismaService;
  return {
    service: new PaymentOrderProcessorService(prisma),
    processingAttempt,
    paymentOrder,
    processedMessage,
    prisma,
  };
}
const eventId = '68191604-b060-4e20-ac85-d38456704f08';
const orderId = '206eb712-8f3d-48d9-b95f-27624bc4f738';

describe('PaymentOrderProcessorService', () => {
  it.each([
    ['SUCCESS', 0, 'processed'],
    ['FAIL_ONCE', 0, 'failed'],
    ['FAIL_ONCE', 1, 'processed'],
    ['FAIL_TWICE', 0, 'failed'],
    ['FAIL_TWICE', 1, 'failed'],
    ['FAIL_TWICE', 2, 'processed'],
    ['ALWAYS_FAIL', 3, 'failed'],
  ])('simulates %s at retry %i', async (scenario, retry, expected) => {
    const h = harness(scenario);
    await expect(h.service.process(eventId, orderId, retry)).resolves.toBe(
      expected,
    );
    expect(h.processingAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId_attemptNumber: { orderId, attemptNumber: retry + 1 } },
      }),
    );
  });
  it('persists success marker, SUCCESS attempt and successful order atomically', async () => {
    const h = harness('SUCCESS');
    await h.service.process(eventId, orderId, 0);
    expect(h.processedMessage.create).toHaveBeenCalledWith({
      data: {
        eventId,
        consumerName: 'order-processor.payment-order-created.v1',
      },
    });
    expect(h.processingAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    );
    expect(h.paymentOrder.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: { status: 'SUCCESS', retryCount: 0, lastError: null },
    });
  });
  it('persists retriable and terminal failures without processed marker', async () => {
    const h = harness('ALWAYS_FAIL');
    await h.service.process(eventId, orderId, 3);
    expect(h.processedMessage.create).not.toHaveBeenCalled();
    expect(h.processingAttempt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'ERROR' }),
      }),
    );
    expect(h.paymentOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', retryCount: 3 }),
      }),
    );
  });
  it('uses compound upsert for failed redelivery, avoiding a second attempt row', async () => {
    const h = harness('ALWAYS_FAIL');
    await h.service.process(eventId, orderId, 1);
    await h.service.process(eventId, orderId, 1);
    expect(h.processingAttempt.upsert).toHaveBeenCalledTimes(2);
    expect(h.processingAttempt.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { orderId_attemptNumber: { orderId, attemptNumber: 2 } },
      }),
    );
  });
  it('returns duplicate success after processed-message uniqueness conflict', async () => {
    const h = harness('SUCCESS');
    h.processedMessage.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), {
        code: 'P2002',
        meta: { target: ['eventId', 'consumerName'] },
      }),
    );
    await expect(h.service.process(eventId, orderId, 0)).resolves.toBe(
      'duplicate',
    );
  });
  it('returns duplicate with no order or attempt writes when marker already exists', async () => {
    const h = harness('SUCCESS');
    h.processedMessage.findUnique.mockResolvedValueOnce({ id: 'marker' });
    await expect(h.service.process(eventId, orderId, 0)).resolves.toBe(
      'duplicate',
    );
    expect(h.processingAttempt.upsert).not.toHaveBeenCalled();
    expect(h.paymentOrder.update).not.toHaveBeenCalled();
  });
});
