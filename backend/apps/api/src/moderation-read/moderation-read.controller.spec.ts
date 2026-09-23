import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  ContentStatus,
  ModerationDecision,
  ModerationSource,
} from '../../../../generated/prisma/client.js';
import { ContentController } from '../content/content.controller.js';
import { ContentService } from '../content/content.service.js';
import { ModerationReadController } from './moderation-read.controller.js';
import { ModerationReadService } from './moderation-read.service.js';

const contentId = 'b436a766-e8fa-4800-824a-f1189eb32855';

describe('ModerationReadController HTTP contract', () => {
  let app: INestApplication<App>;
  const moderationReadService = {
    findResults: vi.fn(),
    findHistory: vi.fn(),
  };
  const contentService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    moderationReadService.findResults.mockResolvedValue([{ id: 'result-id' }]);
    moderationReadService.findHistory.mockResolvedValue([{ id: 'history-id' }]);
    contentService.findOne.mockResolvedValue({ id: contentId });

    const module = await Test.createTestingModule({
      controllers: [ModerationReadController, ContentController],
      providers: [
        { provide: ModerationReadService, useValue: moderationReadService },
        { provide: ContentService, useValue: contentService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('routes moderation results to their handler, not content detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`/contents/${contentId}/moderation-results`)
      .expect(200);

    expect(response.body).toEqual([{ id: 'result-id' }]);
    expect(moderationReadService.findResults).toHaveBeenCalledWith(contentId);
    expect(contentService.findOne).not.toHaveBeenCalled();
  });

  it('routes moderation history to its handler, not content detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`/contents/${contentId}/moderation-history`)
      .expect(200);

    expect(response.body).toEqual([{ id: 'history-id' }]);
    expect(moderationReadService.findHistory).toHaveBeenCalledWith(contentId);
    expect(contentService.findOne).not.toHaveBeenCalled();
  });

  it('keeps content detail routing distinct', async () => {
    await request(app.getHttpServer()).get(`/contents/${contentId}`).expect(200);

    expect(contentService.findOne).toHaveBeenCalledWith(contentId);
    expect(moderationReadService.findResults).not.toHaveBeenCalled();
    expect(moderationReadService.findHistory).not.toHaveBeenCalled();
  });

  it.each(['moderation-results', 'moderation-history'])(
    'rejects malformed UUIDs for %s',
    async (path) => {
      await request(app.getHttpServer()).get(`/contents/not-a-uuid/${path}`).expect(400);
      expect(moderationReadService.findResults).not.toHaveBeenCalled();
      expect(moderationReadService.findHistory).not.toHaveBeenCalled();
    },
  );

  it.each([
    { path: 'moderation-results', handler: moderationReadService.findResults },
    { path: 'moderation-history', handler: moderationReadService.findHistory },
  ])('returns 404 for missing content on $path', async ({ path, handler }) => {
    handler.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get(`/contents/${contentId}/${path}`)
      .expect(404);
  });

  it('documents both moderation operations, schemas, parameters, and errors', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const results = document.paths['/contents/{id}/moderation-results'].get;
    const history = document.paths['/contents/{id}/moderation-history'].get;

    expect(results?.tags).toContain('moderation');
    expect(history?.tags).toContain('moderation');
    expect(results?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          in: 'path',
          schema: expect.objectContaining({ format: 'uuid' }),
        }),
      ]),
    );
    expect(history?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          in: 'path',
          schema: expect.objectContaining({ format: 'uuid' }),
        }),
      ]),
    );
    expect(results?.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '400': expect.any(Object),
        '404': expect.any(Object),
      }),
    );
    expect(history?.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '400': expect.any(Object),
        '404': expect.any(Object),
      }),
    );
    expect(results?.responses?.['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: { $ref: '#/components/schemas/ModerationResultResponseDto' },
            },
          },
        },
      }),
    );
    expect(history?.responses?.['200']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: { $ref: '#/components/schemas/ModerationHistoryResponseDto' },
            },
          },
        },
      }),
    );
    expect(document.components?.schemas?.ModerationResultResponseDto).toEqual(
      expect.objectContaining({
        required: ['id', 'decision', 'score', 'reasons', 'engineVersion', 'createdAt'],
        properties: expect.objectContaining({
          id: expect.objectContaining({ type: 'string', format: 'uuid' }),
          decision: expect.objectContaining({ enum: Object.values(ModerationDecision) }),
          score: expect.objectContaining({ type: 'number', nullable: true }),
          reasons: expect.objectContaining({
            type: 'array',
            nullable: true,
            items: expect.objectContaining({ type: 'string' }),
          }),
          engineVersion: expect.objectContaining({ type: 'string' }),
          createdAt: expect.objectContaining({ type: 'string', format: 'date-time' }),
        }),
      }),
    );
    expect(
      Object.keys(
        document.components?.schemas?.ModerationResultResponseDto?.properties ?? {},
      ).sort(),
    ).toEqual(['id', 'decision', 'score', 'reasons', 'engineVersion', 'createdAt'].sort());
    expect(document.components?.schemas?.ModerationHistoryResponseDto).toEqual(
      expect.objectContaining({
        required: [
          'id',
          'fromStatus',
          'toStatus',
          'source',
          'actorUserId',
          'reason',
          'createdAt',
        ],
        properties: expect.objectContaining({
          id: expect.objectContaining({ type: 'string', format: 'uuid' }),
          fromStatus: expect.objectContaining({
            enum: Object.values(ContentStatus),
            nullable: true,
          }),
          toStatus: expect.objectContaining({ enum: Object.values(ContentStatus) }),
          source: expect.objectContaining({ enum: Object.values(ModerationSource) }),
          actorUserId: expect.objectContaining({
            type: 'string',
            format: 'uuid',
            nullable: true,
          }),
          reason: expect.objectContaining({ type: 'string', nullable: true }),
          createdAt: expect.objectContaining({ type: 'string', format: 'date-time' }),
        }),
      }),
    );
    expect(
      Object.keys(
        document.components?.schemas?.ModerationHistoryResponseDto?.properties ?? {},
      ).sort(),
    ).toEqual(
      ['id', 'fromStatus', 'toStatus', 'source', 'actorUserId', 'reason', 'createdAt'].sort(),
    );
  });
});
