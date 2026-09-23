import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@app/database';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './app.module.js';
import { ContentService } from './content/content.service.js';
import { InternalDiagnosticsService } from './internal/internal-diagnostics.service.js';
import { ModerationReadService } from './moderation-read/moderation-read.service.js';
import { OutboxPublisherModule } from './outbox/outbox-publisher.module.js';
import { UsersService } from './users/users.service.js';

const contentId = 'b436a766-e8fa-4800-824a-f1189eb32855';
const userId = '0f069398-9ece-44b6-8390-b130da447e79';
const eventId = 'fd65ea0d-2807-4cdf-a53d-744bf9ca63db';
const correlationId = '80e94065-9222-4483-9e76-538031e2203c';
const outboxId = '553ebae5-f477-488f-a129-97032239b09e';
const processedId = '9214e35d-35e4-4ad6-bf8b-579286b9362f';
const createdAt = '2026-09-22T12:00:00.000Z';

const submittedContent = {
  id: contentId,
  userId,
  body: 'Content submitted for moderation.',
  status: 'PENDING',
  createdAt,
  submissionEventId: eventId,
  correlationId,
};
const contentListItem = {
  id: contentId,
  userId,
  body: submittedContent.body,
  status: 'APPROVED',
  createdAt,
  updatedAt: createdAt,
};
const contentDetail = {
  ...contentListItem,
  moderationResults: [
    {
      id: eventId,
      decision: 'APPROVED',
      score: 0,
      reasons: [],
      engineVersion: 'deterministic-rules-v1',
      createdAt,
    },
  ],
  moderationHistory: [
    {
      id: correlationId,
      fromStatus: 'PENDING',
      toStatus: 'APPROVED',
      source: 'MODERATION_WORKER',
      actorUserId: null,
      reason: null,
      createdAt,
    },
  ],
};
const user = {
  id: userId,
  email: 'person@example.com',
  displayName: 'Ada Lovelace',
  role: 'USER',
  createdAt,
  updatedAt: createdAt,
};
const outboxEvent = {
  id: outboxId,
  eventId,
  eventType: 'content.submitted',
  eventVersion: 1,
  aggregateType: 'Content',
  aggregateId: contentId,
  correlationId,
  occurredAt: createdAt,
  publishedAt: createdAt,
  claimedAt: null,
  claimedBy: null,
  retryCount: 0,
  nextAttemptAt: null,
  lastError: null,
  createdAt,
};
const processedMessage = {
  id: processedId,
  eventId,
  consumerName: 'moderation-worker.content-submitted.v1',
  processedAt: createdAt,
};

const contentService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
};
const usersService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
};
const moderationReadService = {
  findResults: vi.fn(),
  findHistory: vi.fn(),
};
const diagnosticsService = {
  findOutboxEvents: vi.fn(),
  findOutboxEvent: vi.fn(),
  findProcessedMessages: vi.fn(),
  findProcessedMessage: vi.fn(),
};

@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class PrismaTestModule {}

@Module({})
class RuntimeTestModule {}

describe('AppModule assembled routing', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.resetAllMocks();
    contentService.create.mockResolvedValue(submittedContent);
    contentService.findAll.mockResolvedValue({
      items: [contentListItem],
      page: 1,
      limit: 20,
      total: 1,
    });
    contentService.findOne.mockResolvedValue(contentDetail);
    usersService.create.mockResolvedValue(user);
    usersService.findAll.mockResolvedValue({ items: [user], page: 1, limit: 20, total: 1 });
    usersService.findOne.mockResolvedValue(user);
    moderationReadService.findResults.mockResolvedValue(contentDetail.moderationResults);
    moderationReadService.findHistory.mockResolvedValue(contentDetail.moderationHistory);
    diagnosticsService.findOutboxEvents.mockResolvedValue({
      items: [outboxEvent],
      page: 1,
      limit: 20,
      total: 1,
    });
    diagnosticsService.findOutboxEvent.mockResolvedValue({
      ...outboxEvent,
      payload: { contentId },
    });
    diagnosticsService.findProcessedMessages.mockResolvedValue({
      items: [processedMessage],
      page: 1,
      limit: 20,
      total: 1,
    });
    diagnosticsService.findProcessedMessage.mockResolvedValue(processedMessage);

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(PrismaModule)
      .useModule(PrismaTestModule)
      .overrideModule(OutboxPublisherModule)
      .useModule(RuntimeTestModule)
      .overrideProvider(ContentService)
      .useValue(contentService)
      .overrideProvider(UsersService)
      .useValue(usersService)
      .overrideProvider(ModerationReadService)
      .useValue(moderationReadService)
      .overrideProvider(InternalDiagnosticsService)
      .useValue(diagnosticsService)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30_000);

  afterEach(async () => {
    await app.close();
  });

  it('assembles all three existing Content operations without changing responses', async () => {
    const submitted = await request(app.getHttpServer())
      .post('/contents')
      .send({ userId, body: submittedContent.body })
      .expect(201);
    const listed = await request(app.getHttpServer()).get('/contents').expect(200);
    const detailed = await request(app.getHttpServer())
      .get(`/contents/${contentId}`)
      .expect(200);

    expect(submitted.body).toEqual(submittedContent);
    expect(listed.body).toEqual({ items: [contentListItem], page: 1, limit: 20, total: 1 });
    expect(detailed.body).toEqual(contentDetail);
    expect(detailed.body).toHaveProperty('moderationResults');
    expect(detailed.body).toHaveProperty('moderationHistory');
  });

  it('keeps content detail, moderation results, and moderation history distinct', async () => {
    await request(app.getHttpServer()).get(`/contents/${contentId}`).expect(200);
    await request(app.getHttpServer())
      .get(`/contents/${contentId}/moderation-results`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/contents/${contentId}/moderation-history`)
      .expect(200);

    expect(contentService.findOne).toHaveBeenCalledTimes(1);
    expect(contentService.findOne).toHaveBeenCalledWith(contentId);
    expect(moderationReadService.findResults).toHaveBeenCalledTimes(1);
    expect(moderationReadService.findResults).toHaveBeenCalledWith(contentId);
    expect(moderationReadService.findHistory).toHaveBeenCalledTimes(1);
    expect(moderationReadService.findHistory).toHaveBeenCalledWith(contentId);
  });

  it('assembles all three Users operations', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: user.email,
        displayName: user.displayName,
        password: 'correct-horse-battery-staple',
      })
      .expect(201);
    await request(app.getHttpServer()).get('/users').expect(200);
    await request(app.getHttpServer()).get(`/users/${userId}`).expect(200);

    expect(usersService.create).toHaveBeenCalledTimes(1);
    expect(usersService.findAll).toHaveBeenCalledTimes(1);
    expect(usersService.findOne).toHaveBeenCalledWith(userId);
  });

  it('assembles all four read-only internal diagnostics operations', async () => {
    await request(app.getHttpServer()).get('/internal/outbox-events').expect(200);
    await request(app.getHttpServer())
      .get(`/internal/outbox-events/${outboxId}`)
      .expect(200);
    await request(app.getHttpServer()).get('/internal/processed-messages').expect(200);
    await request(app.getHttpServer())
      .get(`/internal/processed-messages/${processedId}`)
      .expect(200);

    expect(diagnosticsService.findOutboxEvents).toHaveBeenCalledTimes(1);
    expect(diagnosticsService.findOutboxEvent).toHaveBeenCalledWith(outboxId);
    expect(diagnosticsService.findProcessedMessages).toHaveBeenCalledTimes(1);
    expect(diagnosticsService.findProcessedMessage).toHaveBeenCalledWith(processedId);
  });
});
