import { Injectable } from '@nestjs/common';
import {
  ContentStatus,
  ModerationDecision,
  ModerationSource,
} from '../../../../generated/prisma/client.js';
import type { TransactionClient } from '../idempotent-message-executor.service.js';
import {
  DeterministicModerationEngine,
  type DeterministicModerationDecision,
  type ModerationEvaluation,
} from './deterministic-moderation-engine.js';

export type ContentModerationProcessingResult =
  | { status: 'moderated'; evaluation: ModerationEvaluation }
  | { status: 'already_finalized' };

export class ContentNotFoundError extends Error {
  constructor(contentId: string) {
    super(`Content ${contentId} was not found`);
    this.name = 'ContentNotFoundError';
  }
}

@Injectable()
export class ContentModerationProcessorService {
  constructor(private readonly engine: DeterministicModerationEngine) {}

  async process(
    transaction: TransactionClient,
    contentId: string,
  ): Promise<ContentModerationProcessingResult> {
    const content = await transaction.content.findUnique({
      where: { id: contentId },
      select: { body: true, status: true },
    });

    if (!content) {
      throw new ContentNotFoundError(contentId);
    }
    if (content.status !== ContentStatus.PENDING) {
      return { status: 'already_finalized' };
    }

    const evaluation = this.engine.evaluate(content.body);
    const finalStatus = statusForDecision(evaluation.decision);
    const transition = await transaction.content.updateMany({
      where: { id: contentId, status: ContentStatus.PENDING },
      data: { status: finalStatus },
    });

    if (transition.count === 0) {
      return { status: 'already_finalized' };
    }

    await transaction.moderationResult.create({
      data: {
        contentId,
        decision: decisionForPersistence(evaluation.decision),
        score: evaluation.score,
        reasons: evaluation.reasons,
        engineVersion: evaluation.engineVersion,
      },
    });
    await transaction.moderationHistory.create({
      data: {
        contentId,
        fromStatus: ContentStatus.PENDING,
        toStatus: finalStatus,
        source: ModerationSource.MODERATION_WORKER,
        actorUserId: null,
        reason: null,
      },
    });

    return { status: 'moderated', evaluation };
  }
}

function statusForDecision(
  decision: DeterministicModerationDecision,
): (typeof ContentStatus)[keyof typeof ContentStatus] {
  switch (decision) {
    case 'APPROVED':
      return ContentStatus.APPROVED;
    case 'REVIEW_REQUIRED':
      return ContentStatus.REVIEW_REQUIRED;
    case 'REJECTED':
      return ContentStatus.REJECTED;
  }
}

function decisionForPersistence(
  decision: DeterministicModerationDecision,
): (typeof ModerationDecision)[keyof typeof ModerationDecision] {
  switch (decision) {
    case 'APPROVED':
      return ModerationDecision.APPROVED;
    case 'REVIEW_REQUIRED':
      return ModerationDecision.REVIEW_REQUIRED;
    case 'REJECTED':
      return ModerationDecision.REJECTED;
  }
}
