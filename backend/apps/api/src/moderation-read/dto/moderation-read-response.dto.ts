import { ApiProperty } from '@nestjs/swagger';
import {
  ContentStatus,
  ModerationDecision,
  ModerationSource,
} from '../../../../../generated/prisma/client.js';

export class ModerationResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ModerationDecision })
  decision: (typeof ModerationDecision)[keyof typeof ModerationDecision];

  @ApiProperty({ nullable: true, type: Number })
  score: number | null;

  @ApiProperty({ nullable: true, type: 'array', items: { type: 'string' } })
  reasons: string[] | null;

  @ApiProperty()
  engineVersion: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class ModerationHistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ContentStatus, nullable: true })
  fromStatus: (typeof ContentStatus)[keyof typeof ContentStatus] | null;

  @ApiProperty({ enum: ContentStatus })
  toStatus: (typeof ContentStatus)[keyof typeof ContentStatus];

  @ApiProperty({ enum: ModerationSource })
  source: (typeof ModerationSource)[keyof typeof ModerationSource];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  actorUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}
