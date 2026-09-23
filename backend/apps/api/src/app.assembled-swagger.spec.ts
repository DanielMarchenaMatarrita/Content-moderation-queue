import { Module } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@app/database';
import { AppModule } from './app.module.js';
import { OutboxPublisherModule } from './outbox/outbox-publisher.module.js';

@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class PrismaTestModule {}

@Module({})
class RuntimeTestModule {}

const targetOperations = [
  ['/contents', 'post', 'contents'],
  ['/contents', 'get', 'contents'],
  ['/contents/{id}', 'get', 'contents'],
  ['/contents/{id}/moderation-results', 'get', 'moderation'],
  ['/contents/{id}/moderation-history', 'get', 'moderation'],
  ['/users', 'post', 'users'],
  ['/users', 'get', 'users'],
  ['/users/{id}', 'get', 'users'],
  ['/internal/outbox-events', 'get', 'internal diagnostics'],
  ['/internal/outbox-events/{id}', 'get', 'internal diagnostics'],
  ['/internal/processed-messages', 'get', 'internal diagnostics'],
  ['/internal/processed-messages/{id}', 'get', 'internal diagnostics'],
] as const;

describe('AppModule assembled Swagger', () => {
  it('documents all 12 target operations and their assembled contracts', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(PrismaModule)
      .useModule(PrismaTestModule)
      .overrideModule(OutboxPublisherModule)
      .useModule(RuntimeTestModule)
      .compile();
    const app = module.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Content Moderation Queue API').setVersion('1.0').build(),
      );

      expect(targetOperations).toHaveLength(12);
      for (const [path, method, tag] of targetOperations) {
        const operation = document.paths[path]?.[method];
        expect(operation).toBeDefined();
        expect(operation?.tags).toContain(tag);
        expect(operation?.responses).toHaveProperty(method === 'post' ? '201' : '200');
      }
      const assembledTags = new Set(
        targetOperations.flatMap(
          ([path, method]) => document.paths[path]?.[method]?.tags ?? [],
        ),
      );
      expect(assembledTags).toEqual(
        new Set(['contents', 'users', 'moderation', 'internal diagnostics']),
      );

      expect(document.paths['/contents'].post?.requestBody).toEqual(
        expect.objectContaining({
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateContentDto' },
            },
          },
        }),
      );
      expect(document.paths['/users'].post?.requestBody).toEqual(
        expect.objectContaining({
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserDto' },
            },
          },
        }),
      );

      expect(document.paths['/contents'].get?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'page', in: 'query' }),
          expect.objectContaining({ name: 'limit', in: 'query' }),
          expect.objectContaining({ name: 'status', in: 'query' }),
          expect.objectContaining({ name: 'userId', in: 'query' }),
        ]),
      );
      expect(document.paths['/users'].get?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'page', in: 'query' }),
          expect.objectContaining({ name: 'limit', in: 'query' }),
          expect.objectContaining({ name: 'role', in: 'query' }),
          expect.objectContaining({ name: 'q', in: 'query' }),
        ]),
      );
      expect(document.paths['/internal/outbox-events'].get?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'page', in: 'query' }),
          expect.objectContaining({ name: 'limit', in: 'query' }),
          expect.objectContaining({ name: 'eventType', in: 'query' }),
          expect.objectContaining({ name: 'aggregateId', in: 'query' }),
          expect.objectContaining({ name: 'published', in: 'query' }),
        ]),
      );
      expect(document.paths['/internal/processed-messages'].get?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'page', in: 'query' }),
          expect.objectContaining({ name: 'limit', in: 'query' }),
          expect.objectContaining({ name: 'eventId', in: 'query' }),
          expect.objectContaining({ name: 'consumerName', in: 'query' }),
        ]),
      );

      const detailOperations = [
        document.paths['/contents/{id}'].get,
        document.paths['/contents/{id}/moderation-results'].get,
        document.paths['/contents/{id}/moderation-history'].get,
        document.paths['/users/{id}'].get,
        document.paths['/internal/outbox-events/{id}'].get,
        document.paths['/internal/processed-messages/{id}'].get,
      ];
      for (const operation of detailOperations) {
        expect(operation?.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'id', in: 'path', required: true }),
          ]),
        );
      }

      expectJsonSchema(
        document.paths['/users'].post?.responses?.['201'],
        { $ref: '#/components/schemas/UserResponseDto' },
      );
      expectJsonSchema(
        document.paths['/users'].get?.responses?.['200'],
        { $ref: '#/components/schemas/UserListResponseDto' },
      );
      expectJsonSchema(
        document.paths['/users/{id}'].get?.responses?.['200'],
        { $ref: '#/components/schemas/UserResponseDto' },
      );
      expectJsonSchema(
        document.paths['/contents/{id}/moderation-results'].get?.responses?.['200'],
        {
          type: 'array',
          items: { $ref: '#/components/schemas/ModerationResultResponseDto' },
        },
      );
      expectJsonSchema(
        document.paths['/contents/{id}/moderation-history'].get?.responses?.['200'],
        {
          type: 'array',
          items: { $ref: '#/components/schemas/ModerationHistoryResponseDto' },
        },
      );
      expectJsonSchema(
        document.paths['/internal/outbox-events'].get?.responses?.['200'],
        { $ref: '#/components/schemas/OutboxEventListResponseDto' },
      );
      expectJsonSchema(
        document.paths['/internal/outbox-events/{id}'].get?.responses?.['200'],
        { $ref: '#/components/schemas/OutboxEventDetailDto' },
      );
      expectJsonSchema(
        document.paths['/internal/processed-messages'].get?.responses?.['200'],
        { $ref: '#/components/schemas/ProcessedMessageListResponseDto' },
      );
      expectJsonSchema(
        document.paths['/internal/processed-messages/{id}'].get?.responses?.['200'],
        { $ref: '#/components/schemas/ProcessedMessageResponseDto' },
      );

      const errorResponses = [
        [document.paths['/users'].post, ['400', '409']],
        [document.paths['/users'].get, ['400']],
        [document.paths['/users/{id}'].get, ['400', '404']],
        [document.paths['/contents/{id}/moderation-results'].get, ['400', '404']],
        [document.paths['/contents/{id}/moderation-history'].get, ['400', '404']],
        [document.paths['/internal/outbox-events'].get, ['400']],
        [document.paths['/internal/outbox-events/{id}'].get, ['400', '404']],
        [document.paths['/internal/processed-messages'].get, ['400']],
        [document.paths['/internal/processed-messages/{id}'].get, ['400', '404']],
      ] as const;
      for (const [operation, statuses] of errorResponses) {
        for (const status of statuses) {
          expect(operation?.responses).toHaveProperty(status);
        }
      }
    } finally {
      await app.close();
    }
  }, 30_000);
});

function expectJsonSchema(response: unknown, schema: object): void {
  expect(response).toEqual(
    expect.objectContaining({
      content: {
        'application/json': { schema },
      },
    }),
  );
}
