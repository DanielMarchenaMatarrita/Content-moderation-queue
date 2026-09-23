import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../app/providers/ToastProvider';
import { diagnosticsQueryKeys, getOutboxEvent } from '../features/diagnostics/api';
import { Badge } from '../shared/components/Badge';
import { Button } from '../shared/components/Button';
import { ErrorState, LoadingState } from '../shared/components/DataStates';
import { JsonView } from '../shared/components/JsonView';
import { PageHeader } from '../shared/components/PageHeader';
import { copyText } from '../shared/lib/clipboard';
import { formatDateTime, getErrorMessage } from '../shared/lib/format';

function nullableDate(value: string | null) {
  return value ? <time dateTime={value} title={value}>{formatDateTime(value)}</time> : 'None';
}

export function OutboxEventDetailPage() {
  const { id = '' } = useParams();
  const { showToast } = useToast();
  const query = useQuery({ queryKey: diagnosticsQueryKeys.outboxDetail(id), queryFn: () => getOutboxEvent(id), enabled: Boolean(id) });

  return (
    <div className="page-stack">
      <PageHeader eyebrow="System / Outbox" title="Outbox event detail" description="Publication metadata and persisted event payload." backLink={<Link className="back-link" to="/system/outbox"><ArrowLeft size={16} aria-hidden="true" />Back to outbox events</Link>} />
      {query.isPending ? <LoadingState label="Loading outbox event" rows={6} /> : null}
      {query.isError ? <div className="state-wrap"><ErrorState message={getErrorMessage(query.error)} /><Button onClick={() => void query.refetch()}>Try again</Button></div> : null}
      {query.data ? (
        <>
          <section className="detail-card detail-card-body">
            <div className="detail-record-heading"><div><h3>{query.data.eventType}</h3><code>{query.data.id}</code></div><Badge tone={query.data.publishedAt ? 'success' : 'warning'}>{query.data.publishedAt ? 'Published' : 'Unpublished'}</Badge></div>
            <dl className="metadata-grid">
              <div><dt>Event ID</dt><dd><code>{query.data.eventId}</code></dd></div>
              <div><dt>Event version</dt><dd>{query.data.eventVersion}</dd></div>
              <div><dt>Aggregate</dt><dd>{query.data.aggregateType} / <code>{query.data.aggregateId}</code></dd></div>
              <div><dt>Correlation ID</dt><dd><code>{query.data.correlationId}</code></dd></div>
              <div><dt>Occurred</dt><dd>{nullableDate(query.data.occurredAt)}</dd></div>
              <div><dt>Created</dt><dd>{nullableDate(query.data.createdAt)}</dd></div>
              <div><dt>Published</dt><dd>{nullableDate(query.data.publishedAt)}</dd></div>
              <div><dt>Claimed</dt><dd>{nullableDate(query.data.claimedAt)}</dd></div>
              <div><dt>Claimed by</dt><dd>{query.data.claimedBy ?? 'None'}</dd></div>
              <div><dt>Retry count</dt><dd>{query.data.retryCount}</dd></div>
              <div><dt>Next attempt</dt><dd>{nullableDate(query.data.nextAttemptAt)}</dd></div>
              <div><dt>Last error</dt><dd>{query.data.lastError ?? 'None'}</dd></div>
            </dl>
          </section>
          <section className="detail-card">
            <div className="section-heading"><div><h3>Persisted payload</h3><p>Raw JSON returned by the detail endpoint.</p></div><Button size="sm" variant="secondary" onClick={() => void copyText(JSON.stringify(query.data.payload, null, 2)).then(() => showToast({ title: 'Payload copied', tone: 'success' }))}><Copy size={16} aria-hidden="true" />Copy JSON</Button></div>
            <div className="detail-card-body"><JsonView value={query.data.payload} /></div>
          </section>
          <aside className="architecture-note"><strong>Architecture explanation</strong><p>CMQ writes this event beside domain changes before asynchronous publication. This screen exposes persisted evidence; it is not a transaction trace or live health check.</p></aside>
        </>
      ) : null}
    </div>
  );
}
