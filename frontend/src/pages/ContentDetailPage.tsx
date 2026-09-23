import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowClockwise,
  ArrowLeft,
  CheckCircle,
  ClockCountdown,
  Database,
  Gear,
  Package,
  Queue,
} from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { useActivity } from '../app/providers/ActivityProvider';
import { useToast } from '../app/providers/ToastProvider';
import { contentsQueryKeys, getContent } from '../features/contents/api';
import {
  getModerationHistory,
  getModerationResults,
  moderationQueryKeys,
} from '../features/moderation/api';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { JsonView } from '../shared/components/JsonView';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import type { ContentStatus } from '../shared/types/api';
import { formatDateTime, getErrorMessage } from '../shared/lib/format';

const activeStatuses: ContentStatus[] = ['PENDING', 'PROCESSING'];
const pollingInterval = 2_500;
const journey = [
  { label: 'Submitted', detail: 'Content API', icon: CheckCircle },
  { label: 'Outbox', detail: 'Transactional event', icon: Database },
  { label: 'Queue', detail: 'RabbitMQ transport', icon: Queue },
  { label: 'Worker', detail: 'Moderation consumer', icon: Gear },
  { label: 'Decision', detail: 'Persisted outcome', icon: Package },
] as const;

export function ContentDetailPage() {
  const { id = '' } = useParams();
  const { showToast } = useToast();
  const { addActivity } = useActivity();
  const previousStatus = useRef<ContentStatus | undefined>(undefined);
  const contentQuery = useQuery({
    queryKey: contentsQueryKeys.detail(id),
    queryFn: () => getContent(id),
    enabled: Boolean(id),
    refetchInterval: (result) => {
      const status = result.state.data?.status;
      return status && activeStatuses.includes(status) ? pollingInterval : false;
    },
  });
  const active = contentQuery.data ? activeStatuses.includes(contentQuery.data.status) : false;
  const resultsQuery = useQuery({
    queryKey: moderationQueryKeys.results(id),
    queryFn: () => getModerationResults(id),
    enabled: Boolean(id) && contentQuery.isSuccess,
    refetchInterval: active ? pollingInterval : false,
  });
  const historyQuery = useQuery({
    queryKey: moderationQueryKeys.history(id),
    queryFn: () => getModerationHistory(id),
    enabled: Boolean(id) && contentQuery.isSuccess,
    refetchInterval: active ? pollingInterval : false,
  });

  useEffect(() => {
    const status = contentQuery.data?.status;
    if (!status) return;
    const previous = previousStatus.current;
    if (previous && activeStatuses.includes(previous) && !activeStatuses.includes(status)) {
      void Promise.all([resultsQuery.refetch(), historyQuery.refetch()]);
      showToast({ title: 'Moderation completed', description: `Content ${status.toLowerCase().replaceAll('_', ' ')}.`, tone: status === 'FAILED' ? 'error' : 'success' });
      addActivity({ title: 'Moderation transition observed', description: `Content ${id} changed from ${previous} to ${status}.`, tone: status === 'FAILED' ? 'error' : 'success' });
    }
    previousStatus.current = status;
  }, [addActivity, id, contentQuery.data?.status, showToast]);

  function refreshAll() {
    void Promise.all([
      contentQuery.refetch(),
      resultsQuery.refetch(),
      historyQuery.refetch(),
    ]);
  }

  if (contentQuery.isPending) {
    return <div className="page-stack"><LoadingState label="Loading content detail" rows={7} /></div>;
  }
  if (contentQuery.isError) {
    return (
      <div className="page-stack">
        <PageHeader title="Content detail" description="The requested content could not be loaded." backLink={<Link className="back-link" to="/contents"><ArrowLeft size={16} />Back to contents</Link>} />
        <ErrorState message={getErrorMessage(contentQuery.error)} />
        <Button onClick={() => void contentQuery.refetch()}>Try again</Button>
      </div>
    );
  }

  const content = contentQuery.data;
  const latestResult = resultsQuery.data?.[0];
  const refreshing = contentQuery.isFetching || resultsQuery.isFetching || historyQuery.isFetching;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Content detail"
        title="Submission inspection"
        description="Follow one submission from accepted content to its recorded moderation decision."
        backLink={<Link className="back-link" to="/contents"><ArrowLeft size={16} aria-hidden="true" />Back to contents</Link>}
        action={<Button size="sm" onClick={refreshAll} disabled={refreshing}><ArrowClockwise className={refreshing ? 'spin' : undefined} size={16} />Refresh</Button>}
      />

      <section className="content-hero">
        <div className="content-hero-heading"><span>Known API state</span><StatusBadge status={content.status} /></div>
        <p>{content.body}</p>
        <dl className="metadata-grid">
          <div><dt>Content ID</dt><dd><code>{content.id}</code></dd></div>
          <div><dt>User ID</dt><dd><Link className="text-link" to={`/users/${content.userId}`}><code>{content.userId}</code></Link></dd></div>
          <div><dt>Submitted</dt><dd><time dateTime={content.createdAt} title={content.createdAt}>{formatDateTime(content.createdAt)}</time></dd></div>
          <div><dt>Last updated</dt><dd><time dateTime={content.updatedAt} title={content.updatedAt}>{formatDateTime(content.updatedAt)}</time></dd></div>
        </dl>
      </section>

      {active ? (
        <div className="polling-notice" role="status">
          <ClockCountdown className="pulse" size={19} aria-hidden="true" />
          <div><strong>Waiting for moderation</strong><span>Status, result, and history refresh every 2.5 seconds while processing remains active.</span></div>
        </div>
      ) : null}

      <section className="detail-card" aria-labelledby="journey-title">
        <div className="section-heading"><div><h3 id="journey-title">Processing journey</h3><p>Architectural explanation. Nodes do not represent live step telemetry.</p></div><span className="live-disclaimer">Explanatory</span></div>
        <ol className="processing-journey">
          {journey.map((step) => {
            const Icon = step.icon;
            return <li key={step.label}><Icon size={18} aria-hidden="true" /><div><strong>{step.label}</strong><span>{step.detail}</span></div></li>;
          })}
        </ol>
        <div className="known-state"><strong>Known state</strong><span>Content API reports <code>{content.status}</code>{latestResult ? ` with decision ${latestResult.decision}` : ' with no moderation result returned yet'}.</span></div>
      </section>

      <div id="moderation" className="detail-grid">
        <section className="detail-card" aria-labelledby="moderation-result-title">
          <div className="section-heading"><div><h3 id="moderation-result-title">Moderation result</h3><p>Latest record from the moderation-results endpoint.</p></div></div>
          {resultsQuery.isPending ? <LoadingState label="Loading moderation result" rows={3} /> : null}
          {resultsQuery.isError ? <ErrorState message={getErrorMessage(resultsQuery.error)} /> : null}
          {latestResult ? (
            <div className="detail-card-body">
              <div className="decision-row"><StatusBadge status={latestResult.decision} />{latestResult.score !== null ? <span>Score {latestResult.score}</span> : null}</div>
              <dl className="metadata-list">
                <div><dt>Engine version</dt><dd>{latestResult.engineVersion}</dd></div>
                <div><dt>Recorded</dt><dd><time dateTime={latestResult.createdAt} title={latestResult.createdAt}>{formatDateTime(latestResult.createdAt)}</time></dd></div>
              </dl>
              <div><h4>Reasons</h4><JsonView value={latestResult.reasons} /></div>
            </div>
          ) : resultsQuery.isSuccess ? (
            <EmptyState title="Moderation result has not arrived yet" description="The endpoint returned an empty collection. This is expected while asynchronous processing is pending." />
          ) : null}
        </section>

        <section className="detail-card" aria-labelledby="history-title">
          <div className="section-heading"><div><h3 id="history-title">Moderation timeline</h3><p>Only transitions returned by moderation-history are shown.</p></div></div>
          {historyQuery.isPending ? <LoadingState label="Loading moderation history" rows={3} /> : null}
          {historyQuery.isError ? <ErrorState message={getErrorMessage(historyQuery.error)} /> : null}
          {historyQuery.data && historyQuery.data.length > 0 ? (
            <ol className="timeline">
              {historyQuery.data.map((entry) => (
                <li key={entry.id} className="timeline-item timeline-complete">
                  <CheckCircle size={19} weight="fill" aria-hidden="true" />
                  <div>
                    <strong>{entry.fromStatus ? `${entry.fromStatus.replaceAll('_', ' ')} to ` : ''}{entry.toStatus.replaceAll('_', ' ')}</strong>
                    <span>{entry.source.replaceAll('_', ' ')} / {formatDateTime(entry.createdAt)}</span>
                    {entry.actorUserId ? <p>Actor: <code>{entry.actorUserId}</code></p> : null}
                    {entry.reason ? <p>{entry.reason}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : historyQuery.isSuccess ? <EmptyState title="No moderation history" description="No transition records were returned for this content." /> : null}
        </section>
      </div>
    </div>
  );
}
