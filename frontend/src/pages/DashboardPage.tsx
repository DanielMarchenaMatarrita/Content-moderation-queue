import { useQuery } from '@tanstack/react-query';
import { ArrowClockwise, ArrowRight, CheckCircle, Info, Plus, Warning, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { ScenarioSimulator } from '../features/orders/components/ScenarioSimulator';
import { getOrderStats, listOrders, ordersQueryKeys } from '../features/orders/api';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import type { PaymentOrderStats } from '../shared/types/api';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const flow = [
  { label: 'Order API', detail: 'Accepts order' },
  { label: 'Transactional Outbox', detail: 'Records event with order', tip: 'Records event with order data for asynchronous publishing.' },
  { label: 'RabbitMQ', detail: 'Routes event' },
  { label: 'Order Processor', detail: 'Processes order' },
];

export function DashboardPage() {
  const statsQuery = useQuery({ queryKey: ordersQueryKeys.stats(), queryFn: getOrderStats });
  const recentQuery = useQuery({ queryKey: ordersQueryKeys.list({ page: 1, limit: 6 }), queryFn: () => listOrders({ page: 1, limit: 6 }) });
  const attentionQuery = useQuery({ queryKey: ordersQueryKeys.list({ page: 1, limit: 4, status: 'FAILED' }), queryFn: () => listOrders({ page: 1, limit: 4, status: 'FAILED' }) });
  const stats = statsQuery.data;

  return <div className="page-stack operations-dashboard">
    <PageHeader eyebrow="Payment operations" title="Operations center" description="Monitor current payment outcomes, submit controlled scenarios, and investigate orders that need attention." action={<Link className="button button-primary" to="/orders/new"><Plus size={18} aria-hidden="true" />Create order</Link>} />

    <section aria-label="Order statistics">
      {statsQuery.isPending ? <LoadingState label="Loading order statistics" rows={2} /> : null}
      {statsQuery.isError ? <ErrorState message={getErrorMessage(statsQuery.error)} /> : null}
      {stats ? <div className="operations-kpis"><Kpi label="Total orders" value={stats.total} /><Kpi label="Successful" value={stats.successful} tone="success" /><Kpi label="Failed" value={stats.failed} tone="danger" /><Kpi label="Pending" value={stats.pending} tone="warning" /><Kpi label="Retried" value={stats.retried} tone="info" /></div> : null}
    </section>

    <section className="operations-overview" aria-label="Order outcomes and action queue">
      <OutcomeChart stats={stats} loading={statsQuery.isPending} />
      <RequiresAttention query={attentionQuery} />
    </section>

    <section className="operations-workbench" aria-label="Operations actions">
      <ScenarioSimulator />
      <SystemFlow />
    </section>

    <section className="ops-card recent-orders-card" aria-labelledby="recent-orders-title">
      <div className="ops-card-heading"><div><span className="section-kicker">Current queue</span><h2 id="recent-orders-title">Recent orders</h2><p>Latest persisted payment orders and their current processing state.</p></div><Link className="text-link" to="/orders">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
      {recentQuery.isPending ? <LoadingState label="Loading recent orders" rows={4} /> : null}
      {recentQuery.isError ? <ErrorState message={getErrorMessage(recentQuery.error)} /> : null}
      {recentQuery.data?.items.length === 0 ? <EmptyState title="No orders yet" description="Create first payment order to begin processing." action={<Link className="button button-primary button-sm" to="/orders/new">Create order</Link>} /> : null}
      {recentQuery.data && recentQuery.data.items.length > 0 ? <div className="desktop-table-wrap"><table className="data-table operations-table"><thead><tr><th>Order</th><th>Scenario</th><th>Status</th><th>Retries</th><th>Updated</th></tr></thead><tbody>{recentQuery.data.items.map((order) => <tr key={order.id}><td><Link className="table-primary" to={`/orders/${order.id}`} aria-label={`View order ${order.id}`}>{formatCompactId(order.id)}<span>{order.amount.toLocaleString()} {order.currency}</span></Link></td><td>{order.simulationScenario.replaceAll('_', ' ')}</td><td><StatusBadge status={order.status} /></td><td>{order.retryCount} / 3</td><td><time dateTime={order.updatedAt}>{formatDateTime(order.updatedAt)}</time></td></tr>)}</tbody></table></div> : null}
    </section>
  </div>;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <article className={`operations-kpi${tone ? ` operations-kpi-${tone}` : ''}`}><span>{label}</span><strong>{value.toLocaleString()}</strong></article>;
}

function OutcomeChart({ stats, loading }: { stats?: PaymentOrderStats; loading: boolean }) {
  if (loading) return <section className="ops-card outcomes-card"><LoadingState label="Loading outcome distribution" rows={2} /></section>;
  if (!stats) return null;
  const total = stats.successful + stats.failed + stats.pending;
  const success = total ? (stats.successful / total) * 100 : 0;
  const failure = total ? (stats.failed / total) * 100 : 0;
  const gradient = `conic-gradient(var(--color-success) 0 ${success}%, var(--color-error) ${success}% ${success + failure}%, var(--color-warning) ${success + failure}% 100%)`;
  return <section className="ops-card outcomes-card" aria-labelledby="outcomes-title"><div className="ops-card-heading"><div><span className="section-kicker">Live API data</span><h2 id="outcomes-title">Order outcomes</h2><p>Distribution from current order statistics.</p></div></div><div className="outcomes-content"><div className="outcomes-donut" style={{ background: gradient }} role="img" aria-label={`${stats.successful} successful, ${stats.failed} failed, and ${stats.pending} pending orders`}><div><strong>{total.toLocaleString()}</strong><span>tracked</span></div></div><ul className="outcome-legend"><OutcomeLegend label="Successful" value={stats.successful} tone="success" /><OutcomeLegend label="Failed" value={stats.failed} tone="danger" /><OutcomeLegend label="Pending" value={stats.pending} tone="warning" /></ul></div></section>;
}

function OutcomeLegend({ label, value, tone }: { label: string; value: number; tone: string }) { return <li><span className={`legend-dot legend-dot-${tone}`} aria-hidden="true" /><span>{label}</span><strong>{value.toLocaleString()}</strong></li>; }

function RequiresAttention({ query }: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listOrders>>>> }) {
  return <section className="ops-card attention-card" aria-labelledby="attention-title"><div className="ops-card-heading"><div><span className="section-kicker">Action queue</span><h2 id="attention-title">Requires attention</h2><p>Failed orders from the supported order API.</p></div><Warning size={22} aria-hidden="true" /></div>{query.isPending ? <LoadingState label="Loading failed orders" rows={2} /> : null}{query.isError ? <ErrorState message={getErrorMessage(query.error)} /> : null}{query.data?.items.length === 0 ? <div className="attention-empty"><CheckCircle size={20} aria-hidden="true" /><span>No failed orders returned.</span></div> : null}{query.data?.items.length ? <ul className="attention-list">{query.data.items.map((order) => <li key={order.id}><Link to={`/orders/${order.id}`} aria-label={`View order ${order.id}`}><strong>{formatCompactId(order.id)}</strong><span>{order.retryCount} / 3 retries · {order.lastError ?? 'Processing failed'}</span></Link><StatusBadge status={order.status} /></li>)}</ul> : null}</section>;
}

function SystemFlow() { return <section className="ops-card system-flow-card" aria-labelledby="payment-flow-title"><div className="ops-card-heading"><div><span className="section-kicker">Explanatory flow</span><h2 id="payment-flow-title">How payment processing works</h2><p>Architecture explanation, not live system telemetry.</p></div><Link className="text-link" to="/architecture">View architecture <ArrowRight size={15} aria-hidden="true" /></Link></div><ol className="paygrid-flow">{flow.map((step, index) => <li key={step.label} className="flow-stage"><FlowNode {...step} />{index < flow.length - 1 ? <ArrowRight size={15} aria-hidden="true" /> : null}</li>)}<li className="paygrid-flow-branches" aria-label="Order Processor outcome branches"><span className="flow-origin-note">Order Processor branches to one outcome</span><div className="flow-fork"><div className="flow-outcome flow-outcome-success"><FlowNode label="Success" detail="Completes outcome" icon={CheckCircle} /></div><div className="flow-outcome flow-outcome-retry"><FlowNode label="Retry" detail="Reprocesses on error" icon={ArrowClockwise} tip="Retries are explanatory workflow steps, not live attempt status." /><span className="flow-exhausted-note">retries exhausted</span><div className="flow-outcome-down"><FlowNode label="Exhausted failure / DLQ" detail="Explained fallback" icon={Warning} tip="Dead-letter workflow is explanatory after retries exhaust, not broker evidence." /></div></div></div></li></ol></section>; }

function FlowNode({ label, detail, tip, icon: Icon }: { label: string; detail: string; tip?: string; icon?: PhosphorIcon }) { const tooltipId = `flow-tip-${label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`; return <span className="flow-node">{Icon ? <Icon className="flow-node-icon" size={16} aria-hidden="true" /> : null}<strong>{label}</strong><small>{detail}</small>{tip ? <span className="flow-tooltip-wrap"><button type="button" className="flow-tip-trigger" aria-describedby={tooltipId} aria-label={`More about ${label}`}><Info size={13} aria-hidden="true" /></button><span id={tooltipId} role="tooltip" className="flow-tooltip">{tip}</span></span> : null}</span>; }
