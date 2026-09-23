import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '@app/database';
import {
  ContentStatus,
  ModerationDecision,
  ModerationSource,
} from '../../../../generated/prisma/client.js';
import { ModerationReadService } from './moderation-read.service.js';

const contentId = 'b436a766-e8fa-4800-824a-f1189eb32855';
const createdAt = new Date('2026-09-22T12:00:00.000Z');
const result = {
  id: 'fd65ea0d-2807-4cdf-a53d-744bf9ca63db',
  decision: ModerationDecision.APPROVED,
  score: 98,
  reasons: { labels: [] },
  engineVersion: '1.0.0',
  createdAt,
};
const history = {
  id: '553ebae5-f477-488f-a129-97032239b09e',
  fromStatus: ContentStatus.PROCESSING,
  toStatus: ContentStatus.APPROVED,
  source: ModerationSource.MODERATION_WORKER,
  actorUserId: null,
  reason: null,
  createdAt,
};

function createHarness() {
  const writeSpies = Array.from({ length: 22 }, () => vi.fn());
  const writeMethods = (offset: number) => ({
    create: writeSpies[offset],
    createMany: writeSpies[offset + 1],
    update: writeSpies[offset + 2],
    updateMany: writeSpies[offset + 3],
    delete: writeSpies[offset + 4],
    deleteMany: writeSpies[offset + 5],
    upsert: writeSpies[offset + 6],
  });
  const content = {
    findUnique: vi.fn().mockResolvedValue({ id: contentId }),
    ...writeMethods(0),
  };
  const moderationResult = {
    findMany: vi.fn().mockResolvedValue([result]),
    ...writeMethods(7),
  };
  const moderationHistory = {
    findMany: vi.fn().mockResolvedValue([history]),
    ...writeMethods(14),
  };
  const prisma = {
    content,
    moderationResult,
    moderationHistory,
    $executeRaw: writeSpies[21],
  } as unknown as PrismaService;

  return {
    service: new ModerationReadService(prisma),
    content,
    moderationResult,
    moderationHistory,
    writeSpies,
  };
}

describe('ModerationReadService', () => {
  it('checks content then returns scoped, projected, newest-first results', async () => {
    const harness = createHarness();

    await expect(harness.service.findResults(contentId)).resolves.toEqual([result]);

    expect(harness.content.findUnique).toHaveBeenCalledWith({
      where: { id: contentId },
      select: { id: true },
    });
    expect(harness.content.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      harness.moderationResult.findMany.mock.invocationCallOrder[0],
    );
    expect(harness.moderationResult.findMany).toHaveBeenCalledWith({
      where: { contentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        decision: true,
        score: true,
        reasons: true,
        engineVersion: true,
        createdAt: true,
      },
    });
  });

  it('returns an empty results array for existing content', async () => {
    const harness = createHarness();
    harness.moderationResult.findMany.mockResolvedValueOnce([]);

    await expect(harness.service.findResults(contentId)).resolves.toEqual([]);
  });

  it('returns 404 before querying results when content does not exist', async () => {
    const harness = createHarness();
    harness.content.findUnique.mockResolvedValueOnce(null);

    await expect(harness.service.findResults(contentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(harness.moderationResult.findMany).not.toHaveBeenCalled();
  });

  it('checks content then returns scoped, projected, chronological history', async () => {
    const harness = createHarness();

    await expect(harness.service.findHistory(contentId)).resolves.toEqual([history]);

    expect(harness.content.findUnique).toHaveBeenCalledWith({
      where: { id: contentId },
      select: { id: true },
    });
    expect(harness.content.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      harness.moderationHistory.findMany.mock.invocationCallOrder[0],
    );
    expect(harness.moderationHistory.findMany).toHaveBeenCalledWith({
      where: { contentId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        source: true,
        actorUserId: true,
        reason: true,
        createdAt: true,
      },
    });
  });

  it('returns an empty history array for existing content', async () => {
    const harness = createHarness();
    harness.moderationHistory.findMany.mockResolvedValueOnce([]);

    await expect(harness.service.findHistory(contentId)).resolves.toEqual([]);
  });

  it('returns 404 before querying history when content does not exist', async () => {
    const harness = createHarness();
    harness.content.findUnique.mockResolvedValueOnce(null);

    await expect(harness.service.findHistory(contentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(harness.moderationHistory.findMany).not.toHaveBeenCalled();
  });

  it('performs no Prisma writes for either read operation', async () => {
    const harness = createHarness();

    await harness.service.findResults(contentId);
    await harness.service.findHistory(contentId);

    for (const write of harness.writeSpies) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});
