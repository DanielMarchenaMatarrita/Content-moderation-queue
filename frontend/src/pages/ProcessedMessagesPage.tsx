import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FunnelSimple, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { diagnosticsQueryKeys, listProcessedMessages, type ListProcessedMessagesParams } from '../features/diagnostics/api';
import { Badge } from '../shared/components/Badge';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { Input } from '../shared/components/FormControls';
import { PageHeader } from '../shared/components/PageHeader';
import { PaginationControls } from '../shared/components/PaginationControls';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const pageSize = 20;

export function ProcessedMessagesPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Pick<ListProcessedMessagesParams, 'eventId' | 'consumerName'>>({});
  const [eventId, setEventId] = useState('');
  const [consumerName, setConsumerName] = useState('');
  const params = { page, limit: pageSize, ...filters };
  const query = useQuery({ queryKey: diagnosticsQueryKeys.processedList(params), queryFn: () => listProcessedMessages(params), placeholderData: keepPreviousData });
  const filtered = Boolean(filters.eventId || filters.consumerName);

  function applyFilters(event: FormEvent) { event.preventDefault(); setPage(1); setFilters({ eventId: eventId.trim() || undefined, consumerName: consumerName.trim() || undefined }); }
  function clearFilters() { setEventId(''); setConsumerName(''); setFilters({}); setPage(1); }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="System" title="Processed Messages" description="Messages recorded by consumers to enforce idempotent processing." />
      <form className="filter-toolbar" onSubmit={applyFilters}>
        <div className="filter-control filter-grow"><label htmlFor="processed-event-id">Event UUID</label><Input id="processed-event-id" value={eventId} onChange={(event) => setEventId(event.target.value)} /></div>
        <div className="filter-control filter-grow"><label htmlFor="consumer-name">Consumer name</label><Input id="consumer-name" value={consumerName} onChange={(event) => setConsumerName(event.target.value)} /></div>
        <div className="filter-actions"><Button type="submit" size="sm"><FunnelSimple size={16} />Apply</Button>{filtered ? <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X size={16} />Clear</Button> : null}</div>
      </form>
      <section className="data-card" aria-label="Processed message results">
        <div className="data-card-header"><div><h3>Consumer ledger</h3>{query.data ? <span>{query.data.total} total</span> : null}</div></div>
        {query.isPending ? <LoadingState label="Loading processed messages" rows={6} /> : null}
        {query.isError ? <ErrorState message={getErrorMessage(query.error)} /> : null}
        {query.data && query.data.items.length === 0 ? <EmptyState title={filtered ? 'No messages found' : 'No processed messages'} description={filtered ? 'No markers match the active filters.' : 'The API returned an empty consumer ledger.'} action={filtered ? <Button onClick={clearFilters}>Clear filters</Button> : undefined} /> : null}
        {query.data && query.data.items.length > 0 ? <><div className="desktop-table-wrap"><table className="data-table"><thead><tr><th>Event ID</th><th>Consumer</th><th>Processed</th></tr></thead><tbody>{query.data.items.map((message) => <tr key={message.id}><td><Link className="table-primary" to={`/system/processed/${message.id}`}>{formatCompactId(message.eventId)}</Link><code>{message.eventId}</code></td><td><Badge tone="info">{message.consumerName}</Badge></td><td><time dateTime={message.processedAt} title={message.processedAt}>{formatDateTime(message.processedAt)}</time></td></tr>)}</tbody></table></div><div className="mobile-card-list">{query.data.items.map((message) => <article key={message.id} className="mobile-data-card"><div className="mobile-card-heading"><Link className="table-primary" to={`/system/processed/${message.id}`}>{formatCompactId(message.eventId)}</Link></div><Badge tone="info">{message.consumerName}</Badge><dl><div><dt>Processed</dt><dd>{formatDateTime(message.processedAt)}</dd></div><div><dt>Marker ID</dt><dd><code>{formatCompactId(message.id)}</code></dd></div></dl></article>)}</div><PaginationControls page={query.data.page} limit={query.data.limit} total={query.data.total} disabled={query.isFetching} onPageChange={setPage} /></> : null}
      </section>
    </div>
  );
}
