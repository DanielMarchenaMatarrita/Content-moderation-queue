import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { Prisma } from '../../../../generated/prisma/client.js';
import type {
  ListOutboxEventsQueryDto,
  ListProcessedMessagesQueryDto,
} from './dto/internal-diagnostics-query.dto.js';

const outboxEventListSelect = {
  id: true,
  eventId: true,
  eventType: true,
  eventVersion: true,
  aggregateType: true,
  aggregateId: true,
  correlationId: true,
  occurredAt: true,
  publishedAt: true,
  claimedAt: true,
  claimedBy: true,
  retryCount: true,
  nextAttemptAt: true,
  lastError: true,
  createdAt: true,
} satisfies Prisma.OutboxEventSelect;

const outboxEventDetailSelect = {
  ...outboxEventListSelect,
  payload: true,
} satisfies Prisma.OutboxEventSelect;

const processedMessageSelect = {
  id: true,
  eventId: true,
  consumerName: true,
  processedAt: true,
} satisfies Prisma.ProcessedMessageSelect;

@Injectable()
export class InternalDiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOutboxEvents(query: ListOutboxEventsQueryDto) {
    const where: Prisma.OutboxEventWhereInput = {
      eventType: query.eventType,
      aggregateId: query.aggregateId,
      ...(query.published === undefined
        ? {}
        : { publishedAt: query.published ? { not: null } : null }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.outboxEvent.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: outboxEventListSelect,
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);

    return { items, page: query.page, limit: query.limit, total };
  }

  async findOutboxEvent(id: string) {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id },
      select: outboxEventDetailSelect,
    });

    if (!event) {
      throw new NotFoundException(`Outbox event ${id} was not found`);
    }
    return event;
  }

  async findProcessedMessages(query: ListProcessedMessagesQueryDto) {
    const where: Prisma.ProcessedMessageWhereInput = {
      eventId: query.eventId,
      consumerName: query.consumerName,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.processedMessage.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ processedAt: 'desc' }, { id: 'desc' }],
        select: processedMessageSelect,
      }),
      this.prisma.processedMessage.count({ where }),
    ]);

    return { items, page: query.page, limit: query.limit, total };
  }

  async findProcessedMessage(id: string) {
    const message = await this.prisma.processedMessage.findUnique({
      where: { id },
      select: processedMessageSelect,
    });

    if (!message) {
      throw new NotFoundException(`Processed message ${id} was not found`);
    }
    return message;
  }
}
