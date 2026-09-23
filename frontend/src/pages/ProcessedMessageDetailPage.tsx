import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { diagnosticsQueryKeys, getProcessedMessage } from '../features/diagnostics/api';
import { Badge } from '../shared/components/Badge';
import { Button } from '../shared/components/Button';
import { ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { formatDateTime, getErrorMessage } from '../shared/lib/format';

export function ProcessedMessageDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: diagnosticsQueryKeys.processedDetail(id), queryFn: () => getProcessedMessage(id), enabled: Boolean(id) });

  return (
    <div className="page-stack narrow-page">
      <PageHeader eyebrow="System / Idempotency" title="Processed message detail" description="Consumer marker returned by the diagnostics API." backLink={<Link className="back-link" to="/system/processed"><ArrowLeft size={16} aria-hidden="true" />Back to processed messages</Link>} />
      {query.isPending ? <LoadingState label="Loading processed message" rows={4} /> : null}
      {query.isError ? <div className="state-wrap"><ErrorState message={getErrorMessage(query.error)} /><Button onClick={() => void query.refetch()}>Try again</Button></div> : null}
      {query.data ? (
        <>
          <section className="detail-card detail-card-body">
            <div className="detail-record-heading"><div><h3>{query.data.consumerName}</h3><p>Recorded consumer marker</p></div><Badge tone="success">Processed</Badge></div>
            <dl className="metadata-list">
              <div><dt>Marker ID</dt><dd><code>{query.data.id}</code></dd></div>
              <div><dt>Event ID</dt><dd><code>{query.data.eventId}</code></dd></div>
              <div><dt>Consumer</dt><dd>{query.data.consumerName}</dd></div>
              <div><dt>Processed at</dt><dd><time dateTime={query.data.processedAt} title={query.data.processedAt}>{formatDateTime(query.data.processedAt)}</time></dd></div>
            </dl>
          </section>
          <aside className="architecture-note architecture-note-success"><ShieldCheck size={22} weight="fill" aria-hidden="true" /><div><strong>Why this matters</strong><p>This marker lets the consumer recognize an event it already processed and avoid applying that consumer effect again.</p></div></aside>
        </>
      ) : null}
    </div>
  );
}
