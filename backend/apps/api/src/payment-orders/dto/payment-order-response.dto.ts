import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentOrderStatus,
  ProcessingAttemptStatus,
  SimulationScenario,
} from '../../../../../generated/prisma/client.js';

export class PaymentOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ minimum: 1 })
  amount: number;

  @ApiProperty({ pattern: '^[A-Z]{3}$' })
  currency: string;

  @ApiProperty({ enum: PaymentOrderStatus })
  status: (typeof PaymentOrderStatus)[keyof typeof PaymentOrderStatus];

  @ApiProperty({ enum: SimulationScenario })
  simulationScenario: (typeof SimulationScenario)[keyof typeof SimulationScenario];

  @ApiProperty({ enum: SimulationScenario, nullable: true })
  reprocessScenario: (typeof SimulationScenario)[keyof typeof SimulationScenario] | null;

  @ApiProperty({ minimum: 0 })
  retryCount: number;

  @ApiProperty({ nullable: true })
  lastError: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class CreatedPaymentOrderResponseDto extends PaymentOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  submissionEventId: string;
}

export class ReprocessedPaymentOrderResponseDto extends PaymentOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  reprocessEventId: string;
}

export class ProcessingAttemptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ minimum: 1 })
  attemptNumber: number;

  @ApiProperty({ enum: ProcessingAttemptStatus })
  status: (typeof ProcessingAttemptStatus)[keyof typeof ProcessingAttemptStatus];

  @ApiProperty({ nullable: true })
  errorDescription: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class PaymentOrderDetailResponseDto extends PaymentOrderResponseDto {
  @ApiProperty({ type: () => ProcessingAttemptResponseDto, isArray: true })
  attempts: ProcessingAttemptResponseDto[];
}

export class PaymentOrderStatsResponseDto {
  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 0 })
  pending: number;

  @ApiProperty({ minimum: 0 })
  successful: number;

  @ApiProperty({ minimum: 0 })
  failed: number;

  @ApiProperty({ minimum: 0 })
  retried: number;

  @ApiProperty({ minimum: 0 })
  totalAttempts: number;
}

export class PaymentOrderListResponseDto {
  @ApiProperty({ type: () => PaymentOrderResponseDto, isArray: true })
  items: PaymentOrderResponseDto[];

  @ApiProperty({ minimum: 1 })
  page: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ minimum: 0 })
  total: number;
}
