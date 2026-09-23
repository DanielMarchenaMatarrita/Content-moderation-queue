import { apiRequest, buildQuery } from '../../shared/api/client';
import type {
  OutboxEvent,
  OutboxEventDetail,
  PageResponse,
  ProcessedMessage,
} from '../../shared/types/api';

export interface ListOutboxEventsParams {
  page?: number;
  limit?: number;
  eventType?: string;
  aggregateId?: string;
  published?: boolean;
}

export interface ListProcessedMessagesParams {
  page?: number;
  limit?: number;
  eventId?: string;
  consumerName?: string;
}

export const diagnosticsQueryKeys = {
  all: ['diagnostics'] as const,
  outboxLists: () => [...diagnosticsQueryKeys.all, 'outbox', 'list'] as const,
  outboxList: (params: ListOutboxEventsParams) =>
    [...diagnosticsQueryKeys.outboxLists(), params] as const,
  outboxDetail: (id: string) =>
    [...diagnosticsQueryKeys.all, 'outbox', 'detail', id] as const,
  processedLists: () =>
    [...diagnosticsQueryKeys.all, 'processed', 'list'] as const,
  processedList: (params: ListProcessedMessagesParams) =>
    [...diagnosticsQueryKeys.processedLists(), params] as const,
  processedDetail: (id: string) =>
    [...diagnosticsQueryKeys.all, 'processed', 'detail', id] as const,
};

export function listOutboxEvents(
  params: ListOutboxEventsParams = {},
): Promise<PageResponse<OutboxEvent>> {
  return apiRequest(`/internal/outbox-events${buildQuery({ ...params })}`);
}

export function getOutboxEvent(id: string): Promise<OutboxEventDetail> {
  return apiRequest(`/internal/outbox-events/${encodeURIComponent(id)}`);
}

export function listProcessedMessages(
  params: ListProcessedMessagesParams = {},
): Promise<PageResponse<ProcessedMessage>> {
  return apiRequest(`/internal/processed-messages${buildQuery({ ...params })}`);
}

export function getProcessedMessage(id: string): Promise<ProcessedMessage> {
  return apiRequest(
    `/internal/processed-messages/${encodeURIComponent(id)}`,
  );
}
