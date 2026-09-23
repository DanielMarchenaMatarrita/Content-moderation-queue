import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { Prisma } from '../../../../generated/prisma/client.js';

const moderationResultSelect = {
  id: true,
  decision: true,
  score: true,
  reasons: true,
  engineVersion: true,
  createdAt: true,
} satisfies Prisma.ModerationResultSelect;

const moderationHistorySelect = {
  id: true,
  fromStatus: true,
  toStatus: true,
  source: true,
  actorUserId: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.ModerationHistorySelect;

@Injectable()
export class ModerationReadService {
  constructor(private readonly prisma: PrismaService) {}

  async findResults(contentId: string) {
    await this.assertContentExists(contentId);

    return this.prisma.moderationResult.findMany({
      where: { contentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: moderationResultSelect,
    });
  }

  async findHistory(contentId: string) {
    await this.assertContentExists(contentId);

    return this.prisma.moderationHistory.findMany({
      where: { contentId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: moderationHistorySelect,
    });
  }

  private async assertContentExists(contentId: string) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true },
    });

    if (!content) {
      throw new NotFoundException(`Content ${contentId} was not found`);
    }
  }
}
