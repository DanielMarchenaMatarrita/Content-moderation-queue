export type DateTimeString = string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const contentStatuses = [
  'PENDING',
  'PROCESSING',
  'APPROVED',
  'REVIEW_REQUIRED',
  'REJECTED',
  'FAILED',
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const userRoles = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof userRoles)[number];

export type ModerationDecision =
  | 'APPROVED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export type ModerationSource =
  | 'SYSTEM'
  | 'MODERATION_WORKER'
  | 'MODERATOR'
  | 'ADMIN';

export interface PageResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export const paymentOrderStatuses = [
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
] as const;
export type PaymentOrderStatus = (typeof paymentOrderStatuses)[number];

export const simulationScenarios = [
  'SUCCESS',
  'FAIL_ONCE',
  'FAIL_TWICE',
  'ALWAYS_FAIL',
] as const;
export type SimulationScenario = (typeof simulationScenarios)[number];

export type ProcessingAttemptStatus = 'SUCCESS' | 'ERROR';

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  simulationScenario: SimulationScenario;
  retryCount: number;
  lastError: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface ProcessingAttempt {
  id: string;
  orderId: string;
  attemptNumber: number;
  status: ProcessingAttemptStatus;
  errorDescription: string | null;
  createdAt: DateTimeString;
}

export interface PaymentOrderDetail extends PaymentOrder {
  attempts: ProcessingAttempt[];
  reprocessScenario: SimulationScenario | null;
}

export interface ReprocessPaymentOrderInput {
  scenario: SimulationScenario;
}

export interface ReprocessedPaymentOrder extends PaymentOrder {
  reprocessEventId: string;
}

export interface CreatePaymentOrderInput {
  amount: number;
  currency: string;
  simulationScenario: SimulationScenario;
}

export interface CreatedPaymentOrder extends PaymentOrder {
  submissionEventId: string;
}

export interface PaymentOrderStats {
  total: number;
  pending: number;
  successful: number;
  failed: number;
  retried: number;
  totalAttempts: number;
}

export interface ContentSummary {
  id: string;
  userId: string;
  body: string;
  status: ContentStatus;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface CreateContentInput {
  userId: string;
  body: string;
}

export interface CreateContentResponse {
  id: string;
  userId: string;
  body: string;
  status: 'PENDING';
  createdAt: DateTimeString;
  submissionEventId: string;
  correlationId: string;
}

export interface ModerationResult {
  id: string;
  decision: ModerationDecision;
  score: number | null;
  reasons: string[] | null;
  engineVersion: string;
  createdAt: DateTimeString;
}

export interface ModerationHistoryEntry {
  id: string;
  fromStatus: ContentStatus | null;
  toStatus: ContentStatus;
  source: ModerationSource;
  actorUserId: string | null;
  reason: string | null;
  createdAt: DateTimeString;
}

export interface ContentDetail extends ContentSummary {
  moderationResults: ModerationResult[];
  moderationHistory: ModerationHistoryEntry[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  password: string;
}

export interface OutboxEvent {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  occurredAt: DateTimeString;
  publishedAt: DateTimeString | null;
  claimedAt: DateTimeString | null;
  claimedBy: string | null;
  retryCount: number;
  nextAttemptAt: DateTimeString | null;
  lastError: string | null;
  createdAt: DateTimeString;
}

export interface OutboxEventDetail extends OutboxEvent {
  payload: JsonValue;
}

export interface ProcessedMessage {
  id: string;
  eventId: string;
  consumerName: string;
  processedAt: DateTimeString;
}
