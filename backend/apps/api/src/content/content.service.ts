import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CONTENT_SUBMITTED_EVENT } from '@app/contracts';
import { PrismaService } from '@app/database';
import {
  ContentStatus,
  ModerationSource,
  type Prisma,
} from '../../../../generated/prisma/client.js';
import type { CreateContentDto } from './dto/create-content.dto.js';
import type { ListContentsQueryDto } from './dto/list-contents-query.dto.js';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateContentDto) {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const submittedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException(`User ${input.userId} was not found`);
      }

      const content = await transaction.content.create({
        data: {
          userId: input.userId,
          body: input.body,
          status: ContentStatus.PENDING,
          createdAt: submittedAt,
        },
        select: {
          id: true,
          userId: true,
          body: true,
          status: true,
          createdAt: true,
        },
      });

      await transaction.moderationHistory.create({
        data: {
          contentId: content.id,
          fromStatus: null,
          toStatus: ContentStatus.PENDING,
          source: ModerationSource.SYSTEM,
          actorUserId: null,
          reason: 'CONTENT_SUBMITTED',
          createdAt: submittedAt,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          eventId,
          eventType: CONTENT_SUBMITTED_EVENT.type,
          eventVersion: CONTENT_SUBMITTED_EVENT.version,
          aggregateType: 'Content',
          aggregateId: content.id,
          payload: { contentId: content.id },
          correlationId,
          occurredAt: submittedAt,
          createdAt: submittedAt,
        },
      });

      return { ...content, submissionEventId: eventId, correlationId };
    });
  }

  async findOne(id: string) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        body: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        moderationResults: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            decision: true,
            score: true,
            reasons: true,
            engineVersion: true,
            createdAt: true,
          },
        },
        moderationHistory: {
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
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`Content ${id} was not found`);
    }
    return content;
  }

  async findAll(query: ListContentsQueryDto) {
    const where: Prisma.ContentWhereInput = {
      status: query.status,
      userId: query.userId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.content.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          userId: true,
          body: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return { items, page: query.page, limit: query.limit, total };
  }
}
