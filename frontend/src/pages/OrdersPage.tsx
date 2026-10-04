import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowClockwise, Plus } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { listOrders, ordersQueryKeys } from '../features/orders/api';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { PaginationControls } from '../shared/components/PaginationControls';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import type { PaymentOrderStatus } from '../shared/types/api';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const filters: Array<{ label: string; status?: PaymentOrderStatus }> = [{ label: 'All' }, { label: 'Pending', status: 'PENDING' }, { label: 'Success', status: 'SUCCESS' }, { label: 'Failed', status: 'FAILED' }];

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentOrderStatus>();
  const params = { page, limit: 20, status };
  const query = useQuery({ queryKey: ordersQueryKeys.list(params), queryFn: () => listOrders(params), placeholderData: keepPreviousData });
  function selectFilter(next?: PaymentOrderStatus) { setStatus(next); setPage(1); }

  return <div className="page-stack">
    <PageHeader title="Orders" description="Inspect payment orders, retries, errors, and processing outcome." action={<Link className="button button-primary" to="/orders/new"><Plus size={18} aria-hidden="true" />Create order</Link>} />
    <div className="order-filters" role="group" aria-label="Filter orders by status">{filters.map((filter) => <Button key={filter.label} size="sm" variant={status === filter.status ? 'primary' : 'secondary'} onClick={() => selectFilter(filter.status)}>{filter.label}</Button>)}</div>
    <section className="data-card" aria-label="Payment orders">
      <div className="data-card-header"><div><h3>Payment orders</h3>{query.data ? <span>{query.data.total} total</span> : null}</div><Button variant="ghost" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}><ArrowClockwise className={query.isFetching ? 'spin' : undefined} size={16} aria-hidden="true" />Refresh</Button></div>
      {query.isPending ? <LoadingState label="Loading orders" rows={6} /> : null}
      {query.isError ? <div className="state-wrap"><ErrorState message={getErrorMessage(query.error)} /><Button onClick={() => void query.refetch()}>Try again</Button></div> : null}
      {query.data?.items.length === 0 ? <EmptyState title="No orders found" description="No payment orders match this filter." action={<Link className="button button-primary" to="/orders/new">Create order</Link>} /> : null}
      {query.data && query.data.items.length > 0 ? <><div className="desktop-table-wrap"><table className="data-table"><thead><tr><th>Order</th><th className="amount-cell">Amount</th><th>Status</th><th>Scenario</th><th>Retries</th><th>Last error</th><th>Updated</th></tr></thead><tbody>{query.data.items.map((order) => <tr key={order.id}><td><Link className="table-primary order-id" to={`/orders/${order.id}`} aria-label={`View order ${order.id}`} title={order.id}>{formatCompactId(order.id)}</Link></td><td className="amount-cell">{formatAmount(order.amount, order.currency)}</td><td><StatusBadge status={order.status} /></td><td><span className="scenario-label">{order.simulationScenario.replaceAll('_', ' ')}</span></td><td><RetryIndicator retryCount={order.retryCount} /></td><td><span className="technical-error">{order.lastError ?? '—'}</span></td><td><time dateTime={order.updatedAt}>{formatDateTime(order.updatedAt)}</time></td></tr>)}</tbody></table></div><div className="mobile-card-list">{query.data.items.map((order) => <article key={order.id} className="mobile-data-card"><div className="mobile-card-heading"><Link className="table-primary order-id" to={`/orders/${order.id}`} aria-label={`View order ${order.id}`} title={order.id}>{formatCompactId(order.id)}</Link><StatusBadge status={order.status} /></div><dl><div><dt>Amount</dt><dd className="amount-cell">{formatAmount(order.amount, order.currency)}</dd></div><div><dt>Updated</dt><dd><time dateTime={order.updatedAt}>{formatDateTime(order.updatedAt)}</time></dd></div><div><dt>Scenario</dt><dd><span className="scenario-label">{order.simulationScenario.replaceAll('_', ' ')}</span></dd></div><div><dt>Retries</dt><dd><RetryIndicator retryCount={order.retryCount} /></dd></div><div className="error-evidence"><dt>Last error</dt><dd className="technical-error">{order.lastError ?? '—'}</dd></div></dl></article>)}</div><PaginationControls page={query.data.page} limit={query.data.limit} total={query.data.total} disabled={query.isFetching} onPageChange={setPage} /></> : null}
    </section>
  </div>;
}

function RetryIndicator({ retryCount }: { retryCount: number }) {
  return <span className="retry-indicator" aria-label={`${retryCount} of 3 retries recorded`}>{retryCount} / 3</span>;
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString()} ${currency}`;
}
