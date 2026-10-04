import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { getOrderStats, listOrders, ordersQueryKeys } from '../features/orders/api';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const flow = ['Order API', 'Transactional Outbox', 'RabbitMQ', 'Order Processor', 'Retry / DLQ', 'SUCCESS or FAILED'];

export function DashboardPage() {
  const statsQuery = useQuery({ queryKey: ordersQueryKeys.stats(), queryFn: getOrderStats });
  const recentQuery = useQuery({
    queryKey: ordersQueryKeys.list({ page: 1, limit: 5 }),
    queryFn: () => listOrders({ page: 1, limit: 5 }),
  });
  const stats = statsQuery.data;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Payment operations"
        title="PayGrid"
        description="Create payment orders and follow their asynchronous processing outcome."
        action={<Link className="button button-primary" to="/orders/new"><Plus size={18} aria-hidden="true" />Create order</Link>}
      />

      <section aria-label="Order statistics">
        {statsQuery.isPending ? <LoadingState label="Loading order statistics" rows={2} /> : null}
        {statsQuery.isError ? <ErrorState message={getErrorMessage(statsQuery.error)} /> : null}
        {stats ? <div className="stats-grid">
          <Stat label="Total" value={stats.total} />
          <Stat label="Successful" value={stats.successful} tone="success" />
          <Stat label="Failed" value={stats.failed} tone="danger" />
          <Stat label="Pending" value={stats.pending} tone="warning" />
          <Stat label="Retried" value={stats.retried} tone="info" />
        </div> : null}
      </section>

      <section className="pipeline-card" aria-labelledby="payment-flow-title">
        <div className="section-heading"><div><h3 id="payment-flow-title">Payment processing flow</h3><p>Architecture explanation. It is not live telemetry.</p></div><span className="live-disclaimer">Explanatory</span></div>
        <ol className="paygrid-flow">
          {flow.map((step, index) => <li key={step}><span>{step}</span>{index < flow.length - 1 ? <ArrowRight size={15} aria-hidden="true" /> : null}</li>)}
        </ol>
      </section>

      <section className="data-section" aria-labelledby="recent-orders-title">
        <div className="section-heading section-heading-borderless"><div><h3 id="recent-orders-title">Recent orders</h3><p>Latest five payment orders.</p></div><Link className="text-link" to="/orders">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
        {recentQuery.isPending ? <LoadingState label="Loading recent orders" rows={3} /> : null}
        {recentQuery.isError ? <ErrorState message={getErrorMessage(recentQuery.error)} /> : null}
        {recentQuery.data?.items.length === 0 ? <EmptyState title="No orders yet" description="Create first payment order to begin processing." action={<Link className="button button-primary button-sm" to="/orders/new">Create order</Link>} /> : null}
        {recentQuery.data && recentQuery.data.items.length > 0 ? <div className="recent-list">
          {recentQuery.data.items.map((order) => <Link key={order.id} className="recent-item" to={`/orders/${order.id}`}><div><strong>{formatCompactId(order.id)} · {order.amount.toLocaleString()} {order.currency}</strong><span>{formatDateTime(order.createdAt)}</span></div><StatusBadge status={order.status} /></Link>)}
        </div> : null}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <article className={`stat-card${tone ? ` stat-card-${tone}` : ''}`}><span>{label}</span><strong>{value.toLocaleString()}</strong></article>;
}
