import { useQuery } from '@tanstack/react-query';
import { ArrowClockwise, ArrowLeft, ClockCountdown, Warning } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, ordersQueryKeys } from '../features/orders/api';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { formatDateTime, getErrorMessage } from '../shared/lib/format';

const pollingInterval = 1_500;
const attemptLabel = (number: number) => number === 1 ? 'Initial attempt' : `Retry ${number - 1}`;

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ordersQueryKeys.detail(id), queryFn: () => getOrder(id), enabled: Boolean(id), refetchInterval: (result) => result.state.data?.status === 'PENDING' ? pollingInterval : false });
  if (query.isPending) return <div className="page-stack"><LoadingState label="Loading order detail" rows={6} /></div>;
  if (query.isError) return <div className="page-stack"><PageHeader title="Order detail" description="The requested order could not be loaded." backLink={<Link className="back-link" to="/orders"><ArrowLeft size={16} aria-hidden="true" />Back to orders</Link>} /><ErrorState message={getErrorMessage(query.error)} /><Button onClick={() => void query.refetch()}>Try again</Button></div>;
  const order = query.data;
  const active = order.status === 'PENDING';
  return <div className="page-stack">
    <PageHeader eyebrow="Order detail" title="Payment order" description="Persisted order state and processing attempts." backLink={<Link className="back-link" to="/orders"><ArrowLeft size={16} aria-hidden="true" />Back to orders</Link>} action={<Button size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}><ArrowClockwise className={query.isFetching ? 'spin' : undefined} size={16} aria-hidden="true" />Manual refresh</Button>} />
    <section className="content-hero"><div className="content-hero-heading"><span>Current status</span><StatusBadge status={order.status} /></div><dl className="metadata-grid"><div><dt>Order ID</dt><dd><code>{order.id}</code></dd></div><div><dt>Amount</dt><dd>{order.amount.toLocaleString()} {order.currency}</dd></div><div><dt>Scenario</dt><dd>{order.simulationScenario.replaceAll('_', ' ')}</dd></div><div><dt>Retry count</dt><dd>{order.retryCount}</dd></div><div><dt>Created</dt><dd><time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time></dd></div><div><dt>Last updated</dt><dd><time dateTime={order.updatedAt}>{formatDateTime(order.updatedAt)}</time></dd></div><div className="metadata-wide"><dt>Last error</dt><dd>{order.lastError ?? 'None'}</dd></div></dl></section>
    {active ? <div className="polling-notice" role="status"><ClockCountdown className="pulse" size={19} aria-hidden="true" /><div><strong>Waiting for processing</strong><span>Order detail refreshes every 1.5 seconds while status is PENDING.</span></div></div> : null}
    {order.status === 'FAILED' ? <section className="failed-order-notice" aria-label="Failed order notice"><Warning size={22} weight="fill" aria-hidden="true" /><div><strong>Processing failed after retries exhausted</strong><span>This order has {order.retryCount} retries. Last error: {order.lastError ?? 'No error description returned.'} Retry limit exhausted. Routed to dead-letter queue workflow.</span></div></section> : null}
    <section className="detail-card" aria-labelledby="attempts-title"><div className="section-heading"><div><h3 id="attempts-title">Processing attempts</h3><p>Persisted attempts returned with this order, ordered by attempt number.</p></div></div>{order.attempts.length === 0 ? <EmptyState title="No attempts recorded yet" description="An attempt appears after the processor persists it." /> : <ol className="attempt-list">{order.attempts.map((attempt) => <li key={attempt.id}><div><strong>{attemptLabel(attempt.attemptNumber)}</strong><span>Attempt {attempt.attemptNumber} · {formatDateTime(attempt.createdAt)}</span>{attempt.errorDescription ? <p>{attempt.errorDescription}</p> : null}</div><StatusBadge status={attempt.status} /></li>)}</ol>}</section>
  </div>;
}
