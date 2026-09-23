import { apiRequest, buildQuery } from '../../shared/api/client';
import type {
  CreateUserInput,
  PageResponse,
  User,
  UserRole,
} from '../../shared/types/api';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  q?: string;
}

export const usersQueryKeys = {
  all: ['users'] as const,
  lists: () => [...usersQueryKeys.all, 'list'] as const,
  list: (params: ListUsersParams) =>
    [...usersQueryKeys.lists(), params] as const,
  details: () => [...usersQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersQueryKeys.details(), id] as const,
};

export function listUsers(
  params: ListUsersParams = {},
): Promise<PageResponse<User>> {
  return apiRequest(`/users${buildQuery({ ...params })}`);
}

export function getUser(id: string): Promise<User> {
  return apiRequest(`/users/${encodeURIComponent(id)}`);
}

export function createUser(input: CreateUserInput): Promise<User> {
  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
