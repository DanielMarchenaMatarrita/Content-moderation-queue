import { ApiProperty } from '@nestjs/swagger';

export class OutboxEventListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty({ type: 'integer', format: 'int32' })
  eventVersion: number;

  @ApiProperty()
  aggregateType: string;

  @ApiProperty({ format: 'uuid' })
  aggregateId: string;

  @ApiProperty({ format: 'uuid' })
  correlationId: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  claimedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  claimedBy: string | null;

  @ApiProperty({ type: 'integer', format: 'int32' })
  retryCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  nextAttemptAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  lastError: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class OutboxEventDetailDto extends OutboxEventListItemDto {
  @ApiProperty({ type: Object, additionalProperties: true })
  payload: Record<string, unknown>;
}

export class OutboxEventListResponseDto {
  @ApiProperty({ type: () => OutboxEventListItemDto, isArray: true })
  items: OutboxEventListItemDto[];

  @ApiProperty({ type: 'integer', minimum: 1 })
  page: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  total: number;
}

export class ProcessedMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty()
  consumerName: string;

  @ApiProperty({ format: 'date-time' })
  processedAt: Date;
}

export class ProcessedMessageListResponseDto {
  @ApiProperty({ type: () => ProcessedMessageResponseDto, isArray: true })
  items: ProcessedMessageResponseDto[];

  @ApiProperty({ type: 'integer', minimum: 1 })
  page: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  total: number;
}
