import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from '@app/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { ModerationWorkerModule } from '../../moderation-worker/src/moderation-worker.module.js';

const FINAL_STATUS_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 100;

describe('content moderation distributed flow', () => {
  it('submits, publishes, consumes, and persists deterministic moderation', async () => {
    const fixtureId = randomUUID();
    const fixtureUserId = randomUUID();
    const database = new PrismaService();
    let api: INestApplication<App> | undefined;
    let worker: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;
    let contentId: string | undefined;
    let eventId: string | undefined;

    await database.onModuleInit();
    try {
      await database.user.create({
        data: {
          id: fixtureUserId,
          email: `e2e-${fixtureId}@example.test`,
          passwordHash: 'e2e-not-a-real-password-hash',
          displayName: `E2E ${fixtureId}`,
        },
      });

      worker = await NestFactory.createApplicationContext(
        ModerationWorkerModule,
        { logger: false },
      );
      api = await NestFactory.create(AppModule, { logger: false });
      api.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await api.init();

      const submission = await request(api.getHttpServer())
        .post('/contents')
        .send({ userId: fixtureUserId, body: 'Ordinary fixture text.' })
        .expect(201);
      expect(submission.body).toMatchObject({
        userId: fixtureUserId,
        body: 'Ordinary fixture text.',
        status: 'PENDING',
      });
      contentId = submission.body.id as string;
      eventId = submission.body.submissionEventId as string;

      const detail = await pollForFinalContent(api, contentId);
      expect(detail.status).toBe('APPROVED');
      expect(detail.moderationResults).toEqual([
        expect.objectContaining({ decision: 'APPROVED', score: 0 }),
      ]);
      expect(detail.moderationHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromStatus: null,
            toStatus: 'PENDING',
            reason: 'CONTENT_SUBMITTED',
          }),
          expect.objectContaining({
            fromStatus: 'PENDING',
            toStatus: 'APPROVED',
          }),
        ]),
      );

      await expect(
        database.outboxEvent.findUnique({ where: { eventId } }),
      ).resolves.toMatchObject({ publishedAt: expect.any(Date) });
      await expect(
        database.processedMessage.findUnique({
          where: {
            eventId_consumerName: {
              eventId,
              consumerName: 'moderation-worker.content-submitted.v1',
            },
          },
        }),
      ).resolves.toMatchObject({ eventId });
    } finally {
      await Promise.allSettled([api?.close(), worker?.close()]);
      try {
        if (contentId) {
          await database.moderationResult.deleteMany({ where: { contentId } });
          await database.moderationHistory.deleteMany({ where: { contentId } });
        }
        if (eventId) {
          await database.processedMessage.deleteMany({ where: { eventId } });
        }
        if (eventId || contentId) {
          await database.outboxEvent.deleteMany({
            where: {
              OR: [
                ...(eventId ? [{ eventId }] : []),
                ...(contentId ? [{ aggregateId: contentId }] : []),
              ],
            },
          });
        }
        if (contentId) {
          await database.content.deleteMany({ where: { id: contentId } });
        }
        await database.user.deleteMany({ where: { id: fixtureUserId } });
      } finally {
        await database.onModuleDestroy();
      }
    }
  }, 30_000);
});

async function pollForFinalContent(api: INestApplication<App>, contentId: string) {
  const deadline = Date.now() + FINAL_STATUS_TIMEOUT_MS;
  let latest: Record<string, unknown> | undefined;

  while (Date.now() < deadline) {
    const response = await request(api.getHttpServer())
      .get(`/contents/${contentId}`)
      .expect(200);
    latest = response.body as Record<string, unknown>;
    if (latest.status !== 'PENDING' && latest.status !== 'PROCESSING') {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for content ${contentId}; latest=${JSON.stringify(latest)}`,
  );
}
