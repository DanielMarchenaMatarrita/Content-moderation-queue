import { apiRequest, buildQuery } from '../../shared/api/client';
import type {
  ContentDetail,
  ContentStatus,
  ContentSummary,
  CreateContentInput,
  CreateContentResponse,
  PageResponse,
} from '../../shared/types/api';

export interface ListContentsParams {
  page?: number;
  limit?: number;
  status?: ContentStatus;
  userId?: string;
}

export const contentsQueryKeys = {
  all: ['contents'] as const,
  lists: () => [...contentsQueryKeys.all, 'list'] as const,
  list: (params: ListContentsParams) =>
    [...contentsQueryKeys.lists(), params] as const,
  details: () => [...contentsQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...contentsQueryKeys.details(), id] as const,
};

export function listContents(
  params: ListContentsParams = {},
): Promise<PageResponse<ContentSummary>> {
  return apiRequest(`/contents${buildQuery({ ...params })}`);
}

export function getContent(id: string): Promise<ContentDetail> {
  return apiRequest(`/contents/${encodeURIComponent(id)}`);
}

export function createContent(
  input: CreateContentInput,
): Promise<CreateContentResponse> {
  return apiRequest('/contents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
