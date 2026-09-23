import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { InternalDiagnosticsService } from './internal-diagnostics.service.js';
import { OutboxEventsController } from './outbox-events.controller.js';
import { ProcessedMessagesController } from './processed-messages.controller.js';

const outboxId = '0f069398-9ece-44b6-8390-b130da447e79';
const eventId = 'b436a766-e8fa-4800-824a-f1189eb32855';
const aggregateId = 'fd65ea0d-2807-4cdf-a53d-744bf9ca63db';
const processedId = '553ebae5-f477-488f-a129-97032239b09e';
const createdAt = new Date('2026-09-22T12:00:00.000Z');
const outboxListItem = {
  id: outboxId,
  eventId,
  eventType: 'content.submitted',
  eventVersion: 1,
  aggregateType: 'Content',
  aggregateId,
  correlationId: '80e94065-9222-4483-9e76-538031e2203c',
  occurredAt: createdAt,
  publishedAt: null,
  claimedAt: null,
  claimedBy: null,
  retryCount: 0,
  nextAttemptAt: null,
  lastError: null,
  createdAt,
};
const outboxDetail = { ...outboxListItem, payload: { contentId: aggregateId } };
const processedMessage = {
  id: processedId,
  eventId,
  consumerName: 'moderation-worker',
  processedAt: createdAt,
};

describe('Internal diagnostics HTTP contract', () => {
  let app: INestApplication<App>;
  const diagnosticsService = {
    findOutboxEvents: vi.fn(),
    findOutboxEvent: vi.fn(),
    findProcessedMessages: vi.fn(),
    findProcessedMessage: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    diagnosticsService.findOutboxEvents.mockResolvedValue({
      items: [outboxListItem],
      page: 1,
      limit: 20,
      total: 1,
    });
    diagnosticsService.findOutboxEvent.mockResolvedValue(outboxDetail);
    diagnosticsService.findProcessedMessages.mockResolvedValue({
      items: [processedMessage],
      page: 1,
      limit: 20,
      total: 1,
    });
    diagnosticsService.findProcessedMessage.mockResolvedValue(processedMessage);

    const module = await Test.createTestingModule({
      controllers: [OutboxEventsController, ProcessedMessagesController],
      providers: [{ provide: InternalDiagnosticsService, useValue: diagnosticsService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists outbox events through HTTP with transformed filters', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/internal/outbox-events?page=2&limit=10&eventType=content.submitted&aggregateId=${aggregateId}&published=false`,
      )
      .expect(200);

    expect(response.body.items[0]).not.toHaveProperty('payload');
    expect(diagnosticsService.findOutboxEvents).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      eventType: 'content.submitted',
      aggregateId,
      published: false,
    });
  });

  it('gets outbox detail through HTTP with payload', async () => {
    const response = await request(app.getHttpServer())
      .get(`/internal/outbox-events/${outboxId}`)
      .expect(200);

    expect(response.body.payload).toEqual({ contentId: aggregateId });
    expect(diagnosticsService.findOutboxEvent).toHaveBeenCalledWith(outboxId);
  });

  it('lists processed messages through HTTP with transformed pagination', async () => {
    await request(app.getHttpServer())
      .get(`/internal/processed-messages?page=2&limit=10&eventId=${eventId}&consumerName=moderation-worker`)
      .expect(200);

    expect(diagnosticsService.findProcessedMessages).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      eventId,
      consumerName: 'moderation-worker',
    });
  });

  it('gets processed-message detail through HTTP', async () => {
    const response = await request(app.getHttpServer())
      .get(`/internal/processed-messages/${processedId}`)
      .expect(200);

    expect(Object.keys(response.body).sort()).toEqual(
      ['id', 'eventId', 'consumerName', 'processedAt'].sort(),
    );
    expect(diagnosticsService.findProcessedMessage).toHaveBeenCalledWith(processedId);
  });

  it.each([
    '/internal/outbox-events?page=0',
    '/internal/outbox-events?limit=101',
    '/internal/outbox-events?aggregateId=not-a-uuid',
    '/internal/outbox-events?published=yes',
    '/internal/processed-messages?page=0',
    '/internal/processed-messages?limit=101',
    '/internal/processed-messages?eventId=not-a-uuid',
  ])('returns 400 for invalid list query %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(400);
  });

  it.each([
    ['/internal/outbox-events/not-a-uuid', diagnosticsService.findOutboxEvent],
    [
      '/internal/processed-messages/not-a-uuid',
      diagnosticsService.findProcessedMessage,
    ],
  ])('returns 400 before service invocation for %s', async (path, handler) => {
    await request(app.getHttpServer()).get(path).expect(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    [`/internal/outbox-events/${outboxId}`, diagnosticsService.findOutboxEvent],
    [
      `/internal/processed-messages/${processedId}`,
      diagnosticsService.findProcessedMessage,
    ],
  ])('maps missing detail to 404 for %s', async (path, handler) => {
    handler.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer()).get(path).expect(404);
  });

  it('exposes no diagnostics write route', async () => {
    await request(app.getHttpServer()).post('/internal/outbox-events').expect(404);
    await request(app.getHttpServer())
      .delete(`/internal/processed-messages/${processedId}`)
      .expect(404);
  });

  it('documents exactly four GET operations and their contracts', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const paths = [
      '/internal/outbox-events',
      '/internal/outbox-events/{id}',
      '/internal/processed-messages',
      '/internal/processed-messages/{id}',
    ];

    expect(Object.keys(document.paths).sort()).toEqual(paths.sort());
    for (const path of paths) {
      expect(Object.keys(document.paths[path])).toEqual(['get']);
      expect(document.paths[path].get?.tags).toEqual(['internal diagnostics']);
    }

    const outboxList = document.paths['/internal/outbox-events'].get;
    const outboxDetailOperation = document.paths['/internal/outbox-events/{id}'].get;
    const processedList = document.paths['/internal/processed-messages'].get;
    const processedDetailOperation =
      document.paths['/internal/processed-messages/{id}'].get;

    expect(outboxList?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'page',
          in: 'query',
          schema: expect.objectContaining({ type: 'integer', default: 1, minimum: 1 }),
        }),
        expect.objectContaining({
          name: 'limit',
          in: 'query',
          schema: expect.objectContaining({
            type: 'integer',
            default: 20,
            minimum: 1,
            maximum: 100,
          }),
        }),
        expect.objectContaining({
          name: 'eventType',
          in: 'query',
          schema: expect.objectContaining({ type: 'string' }),
        }),
        expect.objectContaining({
          name: 'aggregateId',
          in: 'query',
          schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
        }),
        expect.objectContaining({
          name: 'published',
          in: 'query',
          schema: expect.objectContaining({ type: 'boolean' }),
        }),
      ]),
    );
    expect(processedList?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'page',
          in: 'query',
          schema: expect.objectContaining({ type: 'integer', default: 1, minimum: 1 }),
        }),
        expect.objectContaining({
          name: 'limit',
          in: 'query',
          schema: expect.objectContaining({
            type: 'integer',
            default: 20,
            minimum: 1,
            maximum: 100,
          }),
        }),
        expect.objectContaining({
          name: 'eventId',
          in: 'query',
          schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
        }),
        expect.objectContaining({
          name: 'consumerName',
          in: 'query',
          schema: expect.objectContaining({ type: 'string' }),
        }),
      ]),
    );
    for (const operation of [outboxDetailOperation, processedDetailOperation]) {
      expect(operation?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            in: 'path',
            schema: expect.objectContaining({ format: 'uuid' }),
          }),
        ]),
      );
    }
    for (const operation of [outboxList, processedList]) {
      expect(operation?.responses).toEqual(
        expect.objectContaining({ '200': expect.any(Object), '400': expect.any(Object) }),
      );
    }
    for (const operation of [outboxDetailOperation, processedDetailOperation]) {
      expect(operation?.responses).toEqual(
        expect.objectContaining({
          '200': expect.any(Object),
          '400': expect.any(Object),
          '404': expect.any(Object),
        }),
      );
    }
    expect(outboxList?.responses?.['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OutboxEventListResponseDto' },
          },
        },
      }),
    );
    expect(outboxDetailOperation?.responses?.['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OutboxEventDetailDto' },
          },
        },
      }),
    );
    expect(processedList?.responses?.['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProcessedMessageListResponseDto' },
          },
        },
      }),
    );
    expect(processedDetailOperation?.responses?.['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ProcessedMessageResponseDto' },
          },
        },
      }),
    );

    const schemas = document.components?.schemas;
    const outboxListProperties = schemas?.OutboxEventListItemDto?.properties ?? {};
    const outboxDetailProperties = schemas?.OutboxEventDetailDto?.properties ?? {};
    const processedProperties = schemas?.ProcessedMessageResponseDto?.properties ?? {};
    const outboxListFields = [
      'id',
      'eventId',
      'eventType',
      'eventVersion',
      'aggregateType',
      'aggregateId',
      'correlationId',
      'occurredAt',
      'publishedAt',
      'claimedAt',
      'claimedBy',
      'retryCount',
      'nextAttemptAt',
      'lastError',
      'createdAt',
    ];

    expect(Object.keys(outboxListProperties).sort()).toEqual(outboxListFields.sort());
    expect(outboxListProperties).not.toHaveProperty('payload');
    expect(Object.keys(outboxDetailProperties).sort()).toEqual(
      [...outboxListFields, 'payload'].sort(),
    );
    expect(outboxDetailProperties).toHaveProperty('payload');
    expect(Object.keys(processedProperties).sort()).toEqual(
      ['id', 'eventId', 'consumerName', 'processedAt'].sort(),
    );
    expect(schemas?.OutboxEventListResponseDto).toEqual(
      expect.objectContaining({
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OutboxEventListItemDto' },
          },
          page: expect.objectContaining({ type: 'integer', minimum: 1 }),
          limit: expect.objectContaining({ type: 'integer', minimum: 1, maximum: 100 }),
          total: expect.objectContaining({ type: 'integer', minimum: 0 }),
        },
      }),
    );
    expect(schemas?.ProcessedMessageListResponseDto).toEqual(
      expect.objectContaining({
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProcessedMessageResponseDto' },
          },
          page: expect.objectContaining({ type: 'integer', minimum: 1 }),
          limit: expect.objectContaining({ type: 'integer', minimum: 1, maximum: 100 }),
          total: expect.objectContaining({ type: 'integer', minimum: 0 }),
        },
      }),
    );
    expect(outboxListProperties).toEqual(
      expect.objectContaining({
        publishedAt: expect.objectContaining({
          type: 'string',
          format: 'date-time',
          nullable: true,
        }),
        claimedAt: expect.objectContaining({
          type: 'string',
          format: 'date-time',
          nullable: true,
        }),
        claimedBy: expect.objectContaining({ type: 'string', nullable: true }),
        nextAttemptAt: expect.objectContaining({
          type: 'string',
          format: 'date-time',
          nullable: true,
        }),
        lastError: expect.objectContaining({ type: 'string', nullable: true }),
      }),
    );
  });
});
