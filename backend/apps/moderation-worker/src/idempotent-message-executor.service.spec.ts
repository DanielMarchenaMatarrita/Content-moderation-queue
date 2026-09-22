import type { PrismaService } from '@app/database';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  IdempotentMessageExecutorService,
  type TransactionClient,
} from './idempotent-message-executor.service.js';

const eventId = '68191604-b060-4e20-ac85-d38456704f08';
const consumerName = 'moderation-worker.content-submitted.v1';

function knownPrismaError(code: string, target?: string[]) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '7.10.0',
    meta: target ? { target } : undefined,
  });
}

function createHarness(create: ReturnType<typeof vi.fn>) {
  const transaction = {
    processedMessage: { create },
  } as unknown as TransactionClient;
  const transactionMethod = vi
    .fn()
    .mockImplementation(
      async (callback: (tx: TransactionClient) => Promise<void>) =>
        callback(transaction),
    );
  const prisma = {
    $transaction: transactionMethod,
  } as unknown as PrismaService;

  return {
    service: new IdempotentMessageExecutorService(prisma),
    transaction,
    transactionMethod,
  };
}

describe('IdempotentMessageExecutorService', () => {
  it('inserts the marker and runs the callback in the same transaction', async () => {
    const create = vi.fn().mockResolvedValue({});
    const callback = vi.fn().mockResolvedValue(undefined);
    const harness = createHarness(create);

    await expect(
      harness.service.executeOnce(eventId, consumerName, callback),
    ).resolves.toBe('processed');

    expect(create).toHaveBeenCalledWith({ data: { eventId, consumerName } });
    expect(callback).toHaveBeenCalledWith(harness.transaction);
    expect(harness.transactionMethod).toHaveBeenCalledOnce();
  });

  it('propagates callback failure so the transaction can roll back', async () => {
    const create = vi.fn().mockResolvedValue({});
    const failure = new Error('moderation failed');
    const callback = vi.fn().mockRejectedValue(failure);
    const harness = createHarness(create);

    await expect(
      harness.service.executeOnce(eventId, consumerName, callback),
    ).rejects.toBe(failure);
  });

  it('classifies the compound unique violation as duplicate', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(
        knownPrismaError('P2002', ['eventId', 'consumerName']),
      );
    const callback = vi.fn().mockResolvedValue(undefined);
    const harness = createHarness(create);

    await expect(
      harness.service.executeOnce(eventId, consumerName, callback),
    ).resolves.toBe('duplicate');
    expect(callback).not.toHaveBeenCalled();
  });

  it('propagates non-duplicate database errors', async () => {
    const failure = knownPrismaError('P2024');
    const create = vi.fn().mockRejectedValue(failure);
    const callback = vi.fn().mockResolvedValue(undefined);
    const harness = createHarness(create);

    await expect(
      harness.service.executeOnce(eventId, consumerName, callback),
    ).rejects.toBe(failure);
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not treat another unique constraint as a processed duplicate', async () => {
    const failure = knownPrismaError('P2002', ['id']);
    const create = vi.fn().mockRejectedValue(failure);
    const callback = vi.fn().mockResolvedValue(undefined);
    const harness = createHarness(create);

    await expect(
      harness.service.executeOnce(eventId, consumerName, callback),
    ).rejects.toBe(failure);
  });
});
