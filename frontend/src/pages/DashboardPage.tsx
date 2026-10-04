import { useQuery } from '@tanstack/react-query';
import { ArrowClockwise, ArrowRight, CheckCircle, Info, Plus, Warning, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { getOrderStats, listOrders, ordersQueryKeys } from '../features/orders/api';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const flow = [
  { label: 'Order API', detail: 'Accepts order' },
  { label: 'Transactional Outbox', detail: 'Records event with order', tip: 'Records event with order data for asynchronous publishing.' },
  { label: 'RabbitMQ', detail: 'Routes event' },
  { label: 'Order Processor', detail: 'Processes order' },
];

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
        description="Create payment orders, review current outcomes, and understand processing flow."
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
        <div className="section-heading"><div><h3 id="payment-flow-title">System flow</h3><p>Explanatory architecture, not live system telemetry.</p></div><span className="live-disclaimer">Explanatory only</span></div>
        <ol className="paygrid-flow">
          {flow.map((step, index) => <li key={step.label} className="flow-stage"><FlowNode {...step} />{index < flow.length - 1 ? <ArrowRight size={15} aria-hidden="true" /> : null}</li>)}
          <li className="paygrid-flow-branches" aria-label="Order Processor outcome branches">
            <span className="flow-origin-note">Order Processor branches to one outcome</span>
            <div className="flow-fork">
              <div className="flow-outcome flow-outcome-success"><FlowNode label="Success" detail="Completes outcome" icon={CheckCircle} /></div>
              <div className="flow-outcome flow-outcome-retry">
                <FlowNode label="Retry" detail="Reprocesses on error" icon={ArrowClockwise} tip="Retries are explanatory workflow steps, not live attempt status." />
                <span className="flow-exhausted-note">retries exhausted</span>
                <div className="flow-outcome-down"><FlowNode label="Exhausted failure / DLQ" detail="Explained fallback" icon={Warning} tip="Dead-letter workflow is explanatory after retries exhaust, not broker evidence." /></div>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <section className="data-section" aria-labelledby="recent-orders-title">
        <div className="section-heading section-heading-borderless"><div><h3 id="recent-orders-title">Recent outcomes</h3><p>Latest five persisted orders and their current status.</p></div><Link className="text-link" to="/orders">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
        {recentQuery.isPending ? <LoadingState label="Loading recent orders" rows={3} /> : null}
        {recentQuery.isError ? <ErrorState message={getErrorMessage(recentQuery.error)} /> : null}
        {recentQuery.data?.items.length === 0 ? <EmptyState title="No orders yet" description="Create first payment order to begin processing." action={<Link className="button button-primary button-sm" to="/orders/new">Create order</Link>} /> : null}
        {recentQuery.data && recentQuery.data.items.length > 0 ? <div className="recent-list">
          {recentQuery.data.items.map((order) => <Link key={order.id} className="recent-item" to={`/orders/${order.id}`} aria-label={`View order ${order.id}`}><div><strong>{formatCompactId(order.id)} · {order.amount.toLocaleString()} {order.currency}</strong><span>Updated {formatDateTime(order.updatedAt)}</span></div><StatusBadge status={order.status} /></Link>)}
        </div> : null}
      </section>
    </div>
  );
}

function FlowNode({ label, detail, tip, icon: Icon }: { label: string; detail: string; tip?: string; icon?: PhosphorIcon }) {
  const tooltipId = `flow-tip-${label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`;
  return <span className="flow-node">{Icon ? <Icon className="flow-node-icon" size={16} aria-hidden="true" /> : null}<strong>{label}</strong><small>{detail}</small>{tip ? <span className="flow-tooltip-wrap"><button type="button" className="flow-tip-trigger" aria-describedby={tooltipId} aria-label={`More about ${label}`}><Info size={13} aria-hidden="true" /></button><span id={tooltipId} role="tooltip" className="flow-tooltip">{tip}</span></span> : null}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <article className={`stat-card${tone ? ` stat-card-${tone}` : ''}`}><span>{label}</span><strong>{value.toLocaleString()}</strong></article>;
}
