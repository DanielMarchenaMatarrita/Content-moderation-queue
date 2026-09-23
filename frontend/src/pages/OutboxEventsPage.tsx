import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FunnelSimple, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { diagnosticsQueryKeys, listOutboxEvents, type ListOutboxEventsParams } from '../features/diagnostics/api';
import { Badge } from '../shared/components/Badge';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { Input, Select } from '../shared/components/FormControls';
import { PageHeader } from '../shared/components/PageHeader';
import { PaginationControls } from '../shared/components/PaginationControls';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const pageSize = 20;

export function OutboxEventsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Pick<ListOutboxEventsParams, 'eventType' | 'aggregateId' | 'published'>>({});
  const [eventType, setEventType] = useState('');
  const [aggregateId, setAggregateId] = useState('');
  const [published, setPublished] = useState('');
  const params = { page, limit: pageSize, ...filters };
  const query = useQuery({ queryKey: diagnosticsQueryKeys.outboxList(params), queryFn: () => listOutboxEvents(params), placeholderData: keepPreviousData });
  const filtered = Boolean(filters.eventType || filters.aggregateId || filters.published !== undefined);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters({ eventType: eventType.trim() || undefined, aggregateId: aggregateId.trim() || undefined, published: published === '' ? undefined : published === 'true' });
  }
  function clearFilters() { setEventType(''); setAggregateId(''); setPublished(''); setFilters({}); setPage(1); }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="System" title="Outbox Events" description="Events persisted transactionally before asynchronous publication." />
      <form className="filter-toolbar" onSubmit={applyFilters}>
        <div className="filter-control"><label htmlFor="event-type">Event type</label><Input id="event-type" value={eventType} onChange={(event) => setEventType(event.target.value)} /></div>
        <div className="filter-control filter-grow"><label htmlFor="aggregate-id">Aggregate UUID</label><Input id="aggregate-id" value={aggregateId} onChange={(event) => setAggregateId(event.target.value)} /></div>
        <div className="filter-control"><label htmlFor="published-filter">Publication</label><Select id="published-filter" value={published} onChange={(event) => setPublished(event.target.value)}><option value="">All</option><option value="true">Published</option><option value="false">Unpublished</option></Select></div>
        <div className="filter-actions"><Button type="submit" size="sm"><FunnelSimple size={16} />Apply</Button>{filtered ? <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X size={16} />Clear</Button> : null}</div>
      </form>
      <section className="data-card" aria-label="Outbox event results">
        <div className="data-card-header"><div><h3>Publication ledger</h3>{query.data ? <span>{query.data.total} total</span> : null}</div></div>
        {query.isPending ? <LoadingState label="Loading outbox events" rows={6} /> : null}
        {query.isError ? <ErrorState message={getErrorMessage(query.error)} /> : null}
        {query.data && query.data.items.length === 0 ? <EmptyState title={filtered ? 'No events found' : 'No outbox events'} description={filtered ? 'No events match the active filters.' : 'The API returned an empty publication ledger.'} action={filtered ? <Button onClick={clearFilters}>Clear filters</Button> : undefined} /> : null}
        {query.data && query.data.items.length > 0 ? <><div className="desktop-table-wrap"><table className="data-table"><thead><tr><th>Event</th><th>Aggregate</th><th>Publication</th><th>Retries</th><th>Occurred</th></tr></thead><tbody>{query.data.items.map((event) => <tr key={event.id}><td><Link className="table-primary" to={`/system/outbox/${event.id}`}>{event.eventType}</Link><code>{formatCompactId(event.eventId)}</code></td><td><span>{event.aggregateType}</span><code title={event.aggregateId}>{formatCompactId(event.aggregateId)}</code></td><td><Badge tone={event.publishedAt ? 'success' : 'warning'}>{event.publishedAt ? 'Published' : 'Unpublished'}</Badge></td><td>{event.retryCount}</td><td><time dateTime={event.occurredAt} title={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></td></tr>)}</tbody></table></div><div className="mobile-card-list">{query.data.items.map((event) => <article key={event.id} className="mobile-data-card"><div className="mobile-card-heading"><Link className="table-primary" to={`/system/outbox/${event.id}`}>{event.eventType}</Link></div><Badge tone={event.publishedAt ? 'success' : 'warning'}>{event.publishedAt ? 'Published' : 'Unpublished'}</Badge><dl><div><dt>Aggregate</dt><dd>{event.aggregateType}</dd></div><div><dt>Occurred</dt><dd>{formatDateTime(event.occurredAt)}</dd></div><div><dt>Retries</dt><dd>{event.retryCount}</dd></div></dl></article>)}</div><PaginationControls page={query.data.page} limit={query.data.limit} total={query.data.total} disabled={query.isFetching} onPageChange={setPage} /></> : null}
      </section>
    </div>
  );
}
