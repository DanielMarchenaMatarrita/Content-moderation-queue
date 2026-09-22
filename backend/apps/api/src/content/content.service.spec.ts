import { NotFoundException } from '@nestjs/common';
import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import type { PrismaService } from '@app/database';
import { ContentStatus, ModerationSource } from '../../../../generated/prisma/client.js';
import { ContentService } from './content.service.js';

const userId = '0f069398-9ece-44b6-8390-b130da447e79';
const contentId = 'b436a766-e8fa-4800-824a-f1189eb32855';
const createdAt = new Date('2026-09-22T12:00:00.000Z');

function createHarness() {
  const transaction = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: userId }) },
    content: {
      create: vi.fn().mockResolvedValue({
        id: contentId,
        userId,
        body: 'Normal text',
        status: ContentStatus.PENDING,
        createdAt,
      }),
    },
    moderationHistory: { create: vi.fn().mockResolvedValue({}) },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const content = {
    findUnique: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  };
  const $transaction = vi.fn().mockImplementation(async (input) =>
    typeof input === 'function' ? input(transaction) : Promise.all(input),
  );
  const prisma = { $transaction, content } as unknown as PrismaService;

  return {
    service: new ContentService(prisma),
    transaction,
    content,
    $transaction,
  };
}

describe('ContentService', () => {
  it('atomically creates PENDING content, initial history, and contract outbox event', async () => {
    const harness = createHarness();

    const result = await harness.service.create({ userId, body: 'Normal text' });

    expect(result).toMatchObject({
      id: contentId,
      userId,
      body: 'Normal text',
      status: ContentStatus.PENDING,
      submissionEventId: expect.any(String),
      correlationId: expect.any(String),
    });
    expect(harness.$transaction).toHaveBeenCalledOnce();
    expect(harness.transaction.content.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId, body: 'Normal text', status: 'PENDING' }),
      select: expect.any(Object),
    });
    expect(harness.transaction.moderationHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentId,
        fromStatus: null,
        toStatus: ContentStatus.PENDING,
        source: ModerationSource.SYSTEM,
        actorUserId: null,
        reason: 'CONTENT_SUBMITTED',
      }),
    });
    expect(harness.transaction.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: result.submissionEventId,
        eventType: CONTENT_SUBMITTED_EVENT.type,
        eventVersion: CONTENT_SUBMITTED_EVENT.version,
        aggregateType: 'Content',
        aggregateId: contentId,
        payload: { contentId },
        correlationId: result.correlationId,
      }),
    });
    expect(result.submissionEventId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('uses one logical timestamp for content, history, and event occurrence', async () => {
    const harness = createHarness();
    await harness.service.create({ userId, body: 'Normal text' });

    const contentTime = harness.transaction.content.create.mock.calls[0][0].data.createdAt;
    const historyTime =
      harness.transaction.moderationHistory.create.mock.calls[0][0].data.createdAt;
    const outboxData = harness.transaction.outboxEvent.create.mock.calls[0][0].data;
    expect(historyTime).toBe(contentTime);
    expect(outboxData.occurredAt).toBe(contentTime);
    expect(outboxData.createdAt).toBe(contentTime);
  });

  it('throws NotFound before writes when user does not exist', async () => {
    const harness = createHarness();
    harness.transaction.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      harness.service.create({ userId, body: 'Normal text' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.transaction.content.create).not.toHaveBeenCalled();
    expect(harness.transaction.moderationHistory.create).not.toHaveBeenCalled();
    expect(harness.transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('propagates transaction failures', async () => {
    const harness = createHarness();
    const failure = new Error('transaction rolled back');
    harness.$transaction.mockRejectedValueOnce(failure);

    await expect(
      harness.service.create({ userId, body: 'Normal text' }),
    ).rejects.toBe(failure);
  });

  it('returns detail with chronological history and moderation results', async () => {
    const harness = createHarness();
    const detail = {
      id: contentId,
      moderationResults: [{ decision: 'APPROVED' }],
      moderationHistory: [{ toStatus: 'PENDING' }, { toStatus: 'APPROVED' }],
    };
    harness.content.findUnique.mockResolvedValueOnce(detail);

    await expect(harness.service.findOne(contentId)).resolves.toBe(detail);
    expect(harness.content.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: contentId },
        select: expect.objectContaining({
          moderationResults: expect.objectContaining({
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
          moderationHistory: expect.objectContaining({
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          }),
        }),
      }),
    );
  });

  it('throws NotFound for missing detail', async () => {
    const harness = createHarness();
    harness.content.findUnique.mockResolvedValueOnce(null);
    await expect(harness.service.findOne(contentId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('paginates a lightweight newest-first list', async () => {
    const harness = createHarness();
    harness.content.findMany.mockResolvedValueOnce([{ id: contentId }]);
    harness.content.count.mockResolvedValueOnce(41);

    await expect(
      harness.service.findAll({ page: 3, limit: 20 }),
    ).resolves.toEqual({
      items: [{ id: contentId }],
      page: 3,
      limit: 20,
      total: 41,
    });
    expect(harness.content.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20, orderBy: expect.any(Array) }),
    );
  });

  it('applies status and user filters to list and count', async () => {
    const harness = createHarness();
    await harness.service.findAll({
      page: 1,
      limit: 20,
      status: ContentStatus.APPROVED,
      userId,
    });

    const where = { status: ContentStatus.APPROVED, userId };
    expect(harness.content.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(harness.content.count).toHaveBeenCalledWith({ where });
  });
});
