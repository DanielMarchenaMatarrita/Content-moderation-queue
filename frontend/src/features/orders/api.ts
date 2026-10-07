import { apiRequest, buildQuery } from '../../shared/api/client';
import type {
  CreatePaymentOrderInput,
  CreatedPaymentOrder,
  PageResponse,
  PaymentOrder,
  PaymentOrderDetail,
  PaymentOrderStats,
  PaymentOrderStatus,
  ReprocessPaymentOrderInput,
  ReprocessedPaymentOrder,
} from '../../shared/types/api';

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: PaymentOrderStatus;
}

export const ordersQueryKeys = {
  all: ['orders'] as const,
  lists: () => [...ordersQueryKeys.all, 'list'] as const,
  list: (params: ListOrdersParams) => [...ordersQueryKeys.lists(), params] as const,
  stats: () => [...ordersQueryKeys.all, 'stats'] as const,
  details: () => [...ordersQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...ordersQueryKeys.details(), id] as const,
};

export function listOrders(params: ListOrdersParams = {}): Promise<PageResponse<PaymentOrder>> {
  return apiRequest(`/orders${buildQuery({
    page: params.page,
    limit: params.limit,
    status: params.status,
  })}`);
}

export function getOrder(id: string): Promise<PaymentOrderDetail> {
  return apiRequest(`/orders/${encodeURIComponent(id)}`);
}

export function getOrderStats(): Promise<PaymentOrderStats> {
  return apiRequest('/orders/stats');
}

export function createOrder(input: CreatePaymentOrderInput): Promise<CreatedPaymentOrder> {
  return apiRequest('/orders', { method: 'POST', body: JSON.stringify(input) });
}

export function reprocessOrder(id: string, input: ReprocessPaymentOrderInput): Promise<ReprocessedPaymentOrder> {
  return apiRequest(`/payment-orders/${encodeURIComponent(id)}/reprocess`, { method: 'POST', body: JSON.stringify(input) });
}
