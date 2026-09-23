import { apiRequest } from '../../shared/api/client';
import type {
  ModerationHistoryEntry,
  ModerationResult,
} from '../../shared/types/api';

export const moderationQueryKeys = {
  all: ['moderation'] as const,
  results: (contentId: string) =>
    [...moderationQueryKeys.all, contentId, 'results'] as const,
  history: (contentId: string) =>
    [...moderationQueryKeys.all, contentId, 'history'] as const,
};

export function getModerationResults(
  contentId: string,
): Promise<ModerationResult[]> {
  return apiRequest(
    `/contents/${encodeURIComponent(contentId)}/moderation-results`,
  );
}

export function getModerationHistory(
  contentId: string,
): Promise<ModerationHistoryEntry[]> {
  return apiRequest(
    `/contents/${encodeURIComponent(contentId)}/moderation-history`,
  );
}
