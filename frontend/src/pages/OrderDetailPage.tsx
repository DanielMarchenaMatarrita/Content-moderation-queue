import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowClockwise, ArrowLeft, CheckCircle, ClockCountdown, CircleDashed, Warning, XCircle } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, ordersQueryKeys } from '../features/orders/api';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { formatDateTime, getErrorMessage } from '../shared/lib/format';
import { attemptLabel, deriveJourney, orderPresentation, processingOutcome, type JourneyState } from '../features/orders/presentation';
import { useToast } from '../app/providers/ToastProvider';
import type { PaymentOrderDetail } from '../shared/types/api';

const pollingInterval = 1_500;
const journeyIcon = (state: JourneyState) => state === 'completed' || state === 'terminal-success' ? CheckCircle : state === 'failed' || state === 'terminal-failed' ? XCircle : state === 'current' ? ClockCountdown : CircleDashed;

function useObservedOrderNotifications(order: PaymentOrderDetail | undefined) {
  const { showToast } = useToast();
  const initialized = useRef(false);
  const baselineOrderId = useRef<string | undefined>(undefined);
  const seenAttemptIds = useRef(new Set<string>());
  const seenTerminalStates = useRef(new Set<string>());

  useEffect(() => {
    if (!order) return;
    if (baselineOrderId.current !== order.id) {
      baselineOrderId.current = order.id;
      initialized.current = false;
      seenAttemptIds.current.clear();
      seenTerminalStates.current.clear();
    }
    const terminalKey = `${order.id}:${order.status}`;
    if (!initialized.current) {
      order.attempts.forEach((attempt) => seenAttemptIds.current.add(attempt.id));
      if (order.status === 'SUCCESS' || order.status === 'FAILED') seenTerminalStates.current.add(terminalKey);
      initialized.current = true;
      return;
    }
    order.attempts.forEach((attempt) => {
      if (seenAttemptIds.current.has(attempt.id)) return;
      seenAttemptIds.current.add(attempt.id);
      showToast({ title: `${attemptLabel(attempt.attemptNumber)} recorded`, description: `Persisted attempt shows ${attempt.status.toLowerCase()}.`, tone: attempt.status === 'SUCCESS' ? 'success' : 'error' });
    });
    if ((order.status === 'SUCCESS' || order.status === 'FAILED') && !seenTerminalStates.current.has(terminalKey)) {
      seenTerminalStates.current.add(terminalKey);
      showToast({ title: `Order ${order.status.toLowerCase()}`, description: 'New persisted terminal order state observed.', tone: order.status === 'SUCCESS' ? 'success' : 'error' });
    }
  }, [order, showToast]);
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ordersQueryKeys.detail(id), queryFn: () => getOrder(id), enabled: Boolean(id), refetchInterval: (result) => result.state.data?.status === 'PENDING' ? pollingInterval : false });
  useObservedOrderNotifications(query.data);
  if (query.isPending) return <div className="page-stack"><LoadingState label="Loading order detail" rows={6} /></div>;
  if (query.isError) return <div className="page-stack"><PageHeader title="Order detail" description="The requested order could not be loaded." backLink={<Link className="back-link" to="/orders"><ArrowLeft size={16} aria-hidden="true" />Back to orders</Link>} /><ErrorState message={getErrorMessage(query.error)} /><Button onClick={() => void query.refetch()}>Try again</Button></div>;
  const order = query.data;
  const active = order.status === 'PENDING';
  const journey = deriveJourney(order);
  return <div className="page-stack">
    <PageHeader eyebrow="Order detail" title="Payment order" description="Persisted order state and processing attempts." backLink={<Link className="back-link" to="/orders"><ArrowLeft size={16} aria-hidden="true" />Back to orders</Link>} action={<Button size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}><ArrowClockwise className={query.isFetching ? 'spin' : undefined} size={16} aria-hidden="true" />Manual refresh</Button>} />
    <section className="content-hero"><div className="content-hero-heading"><span>Order identity</span><StatusBadge status={order.status} /></div><dl className="metadata-grid"><div><dt>Order ID</dt><dd><code>{order.id}</code></dd></div><div><dt>Amount</dt><dd>{order.amount.toLocaleString()} {order.currency}</dd></div><div><dt>Scenario</dt><dd>{order.simulationScenario.replaceAll('_', ' ')}</dd></div><div><dt>Retry count</dt><dd>{order.retryCount}</dd></div><div><dt>Created</dt><dd><time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time></dd></div><div><dt>Last updated</dt><dd><time dateTime={order.updatedAt}>{formatDateTime(order.updatedAt)}</time></dd></div><div className="metadata-wide"><dt>Last error</dt><dd>{order.lastError ?? 'None'}</dd></div></dl><div className="order-outcome"><span>Processing outcome</span><strong>{processingOutcome(order)}</strong></div></section>
    {active ? <div className="polling-notice" role="status"><ClockCountdown className={query.isFetching ? 'spin' : 'pulse'} size={19} aria-hidden="true" /><div><strong>Processing payment order</strong><span>Auto-refresh is active while this order is pending, watching for newly persisted attempts and order updates.</span><span>{query.isFetching ? 'Refreshing persisted order evidence. ' : ''}Last updated from persisted evidence: <time dateTime={order.updatedAt}>{formatDateTime(order.updatedAt)}</time></span><span className="polling-cadence">Refresh interval: 1.5 seconds.</span></div></div> : null}
    <section className="detail-card journey-card" aria-labelledby="journey-title"><div className="section-heading"><div><h3 id="journey-title">Processing journey</h3><p>Summary safely derived from persisted order and attempt evidence.</p></div></div><ol className="processing-journey">{journey.map((step) => { const Icon = journeyIcon(step.state); return <li key={step.key} className={`journey-step journey-${step.state}`}><Icon size={20} weight={step.state === 'current' ? 'regular' : 'fill'} aria-hidden="true" /><div><strong>{step.label}</strong><span>{step.detail}</span></div></li>; })}</ol></section>
    <section className="detail-card" aria-labelledby="attempts-title"><div className="section-heading"><div><h3 id="attempts-title">Processing attempts</h3><p>{orderPresentation.persistedAttempts}</p></div></div>{order.attempts.length === 0 ? <EmptyState title="No attempts recorded yet" description="No persisted attempt evidence is available yet." /> : <ol className="attempt-list">{order.attempts.map((attempt) => <li key={attempt.id}><div><strong>{attemptLabel(attempt.attemptNumber)}</strong><span>Attempt {attempt.attemptNumber} · <time dateTime={attempt.createdAt}>{formatDateTime(attempt.createdAt)}</time></span>{attempt.errorDescription ? <p>{attempt.errorDescription}</p> : null}</div><StatusBadge status={attempt.status} /></li>)}</ol>}</section>
    {order.status === 'FAILED' ? <section className="failed-order-notice" aria-label="Terminal failure explanation"><Warning size={22} weight="fill" aria-hidden="true" /><div><strong>Retry limit exhausted after {order.retryCount} retries</strong><span>Last persisted error: {order.lastError ?? 'No error description returned.'}</span><p>{orderPresentation.explanatoryDeadLetter}</p></div></section> : null}
  </div>;
}
