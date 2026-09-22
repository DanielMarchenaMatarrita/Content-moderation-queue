import {
  ContentStatus,
  ModerationDecision,
  ModerationSource,
} from '../../../../generated/prisma/client.js';
import type { TransactionClient } from '../idempotent-message-executor.service.js';
import {
  ContentModerationProcessorService,
  ContentNotFoundError,
} from './content-moderation-processor.service.js';
import {
  DeterministicModerationEngine,
  type ModerationEvaluation,
} from './deterministic-moderation-engine.js';

const contentId = '206eb712-8f3d-48d9-b95f-27624bc4f738';

function evaluation(
  overrides: Partial<ModerationEvaluation> = {},
): ModerationEvaluation {
  return {
    decision: 'APPROVED',
    score: 0,
    reasons: [],
    engineVersion: 'deterministic-rules-v1',
    ...overrides,
  };
}

function createHarness(options: {
  content?: { body: string; status: ContentStatus } | null;
  evaluation?: ModerationEvaluation;
  transitionCount?: number;
} = {}) {
  const findUnique = vi.fn().mockResolvedValue(
    options.content === undefined
      ? { body: 'Normal content', status: ContentStatus.PENDING }
      : options.content,
  );
  const updateMany = vi
    .fn()
    .mockResolvedValue({ count: options.transitionCount ?? 1 });
  const createResult = vi.fn().mockResolvedValue({});
  const createHistory = vi.fn().mockResolvedValue({});
  const nestedTransaction = vi.fn();
  const transaction = {
    content: { findUnique, updateMany },
    moderationResult: { create: createResult },
    moderationHistory: { create: createHistory },
    $transaction: nestedTransaction,
  } as unknown as TransactionClient;
  const evaluate = vi
    .fn()
    .mockReturnValue(options.evaluation ?? evaluation());
  const engine = { evaluate } as unknown as DeterministicModerationEngine;

  return {
    service: new ContentModerationProcessorService(engine),
    transaction,
    findUnique,
    updateMany,
    createResult,
    createHistory,
    nestedTransaction,
    evaluate,
  };
}

describe('ContentModerationProcessorService', () => {
  it('transitions PENDING content to APPROVED and records both effects', async () => {
    const harness = createHarness();

    await expect(
      harness.service.process(harness.transaction, contentId),
    ).resolves.toMatchObject({ status: 'moderated' });

    expect(harness.findUnique).toHaveBeenCalledWith({
      where: { id: contentId },
      select: { body: true, status: true },
    });
    expect(harness.updateMany).toHaveBeenCalledWith({
      where: { id: contentId, status: ContentStatus.PENDING },
      data: { status: ContentStatus.APPROVED },
    });
    expect(harness.createResult).toHaveBeenCalledWith({
      data: {
        contentId,
        decision: ModerationDecision.APPROVED,
        score: 0,
        reasons: [],
        engineVersion: 'deterministic-rules-v1',
      },
    });
    expect(harness.createHistory).toHaveBeenCalledWith({
      data: {
        contentId,
        fromStatus: ContentStatus.PENDING,
        toStatus: ContentStatus.APPROVED,
        source: ModerationSource.MODERATION_WORKER,
        actorUserId: null,
        reason: null,
      },
    });
  });

  it.each([
    [
      'REVIEW_REQUIRED',
      ContentStatus.REVIEW_REQUIRED,
      ModerationDecision.REVIEW_REQUIRED,
      40,
    ],
    ['REJECTED', ContentStatus.REJECTED, ModerationDecision.REJECTED, 80],
  ] as const)(
    'persists %s evaluation and status',
    async (decision, status, persistedDecision, score) => {
      const harness = createHarness({
        evaluation: evaluation({ decision, score }),
      });

      await harness.service.process(harness.transaction, contentId);

      expect(harness.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status } }),
      );
      expect(harness.createResult).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ decision: persistedDecision, score }),
        }),
      );
    },
  );

  it('throws a specific error when content does not exist', async () => {
    const harness = createHarness({ content: null });

    await expect(
      harness.service.process(harness.transaction, contentId),
    ).rejects.toBeInstanceOf(ContentNotFoundError);
    expect(harness.updateMany).not.toHaveBeenCalled();
    expect(harness.createResult).not.toHaveBeenCalled();
    expect(harness.createHistory).not.toHaveBeenCalled();
  });

  it.each([
    ContentStatus.PROCESSING,
    ContentStatus.APPROVED,
    ContentStatus.REVIEW_REQUIRED,
    ContentStatus.REJECTED,
    ContentStatus.FAILED,
  ])('does not duplicate effects when content is already %s', async (status) => {
    const harness = createHarness({
      content: { body: 'Already moderated', status },
    });

    await expect(
      harness.service.process(harness.transaction, contentId),
    ).resolves.toEqual({ status: 'already_finalized' });
    expect(harness.evaluate).not.toHaveBeenCalled();
    expect(harness.updateMany).not.toHaveBeenCalled();
    expect(harness.createResult).not.toHaveBeenCalled();
    expect(harness.createHistory).not.toHaveBeenCalled();
  });

  it('does not create effects when another transaction wins the claim', async () => {
    const harness = createHarness({ transitionCount: 0 });

    await expect(
      harness.service.process(harness.transaction, contentId),
    ).resolves.toEqual({ status: 'already_finalized' });
    expect(harness.createResult).not.toHaveBeenCalled();
    expect(harness.createHistory).not.toHaveBeenCalled();
  });

  it('propagates ModerationResult persistence failure', async () => {
    const harness = createHarness();
    const failure = new Error('result write failed');
    harness.createResult.mockRejectedValueOnce(failure);

    await expect(
      harness.service.process(harness.transaction, contentId),
    ).rejects.toBe(failure);
    expect(harness.createHistory).not.toHaveBeenCalled();
  });

  it('propagates ModerationHistory persistence failure', async () => {
    const harness = createHarness();
    const failure = new Error('history write failed');
    harness.createHistory.mockRejectedValueOnce(failure);

    await expect(
      harness.service.process(harness.transaction, contentId),
    ).rejects.toBe(failure);
  });

  it('uses only the caller transaction and opens no nested transaction', async () => {
    const harness = createHarness();

    await harness.service.process(harness.transaction, contentId);

    expect(harness.findUnique).toHaveBeenCalledOnce();
    expect(harness.updateMany).toHaveBeenCalledOnce();
    expect(harness.createResult).toHaveBeenCalledOnce();
    expect(harness.createHistory).toHaveBeenCalledOnce();
    expect(harness.nestedTransaction).not.toHaveBeenCalled();
  });
});
