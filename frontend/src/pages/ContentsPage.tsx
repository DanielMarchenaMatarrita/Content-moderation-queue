import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowClockwise, FilePlus, FunnelSimple, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import {
  contentsQueryKeys,
  listContents,
  type ListContentsParams,
} from '../features/contents/api';
import { ContentActionsMenu } from '../features/contents/components/ContentActionsMenu';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { Input, Select } from '../shared/components/FormControls';
import { PaginationControls } from '../shared/components/PaginationControls';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { contentStatuses, type ContentStatus } from '../shared/types/api';
import { contentPreview, formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const pageSize = 20;

export function ContentsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Pick<ListContentsParams, 'status' | 'userId'>>({});
  const [draftStatus, setDraftStatus] = useState('');
  const [draftUserId, setDraftUserId] = useState('');
  const params = { page, limit: pageSize, ...filters };
  const query = useQuery({
    queryKey: contentsQueryKeys.list(params),
    queryFn: () => listContents(params),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(filters.status || filters.userId);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters({
      status: draftStatus ? (draftStatus as ContentStatus) : undefined,
      userId: draftUserId.trim() || undefined,
    });
  }

  function clearFilters() {
    setDraftStatus('');
    setDraftUserId('');
    setFilters({});
    setPage(1);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Content Queue"
        description="Inspect submitted content, current moderation status, ownership, and creation time."
        action={
          <Link className="button button-primary" to="/contents/new">
            <FilePlus size={18} aria-hidden="true" />
            Submit content
          </Link>
        }
      />

      <form className="filter-toolbar" onSubmit={applyFilters}>
        <div className="filter-control">
          <label htmlFor="content-status-filter">Status</label>
          <Select id="content-status-filter" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
            <option value="">All statuses</option>
            {contentStatuses.map((status) => (
              <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
            ))}
          </Select>
        </div>
        <div className="filter-control filter-grow">
          <label htmlFor="content-user-filter">User UUID</label>
          <Input
            id="content-user-filter"
            value={draftUserId}
            onChange={(event) => setDraftUserId(event.target.value)}
            placeholder="Filter by exact user UUID"
          />
        </div>
        <div className="filter-actions">
          <Button type="submit" size="sm"><FunnelSimple size={16} aria-hidden="true" />Apply</Button>
          {filtered ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X size={16} aria-hidden="true" />Clear
            </Button>
          ) : null}
        </div>
      </form>

      <section className="data-card" aria-label="Contents results">
        <div className="data-card-header">
          <div>
            <h3>Content records</h3>
            {query.data ? <span>{query.data.total} total</span> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <ArrowClockwise className={query.isFetching ? 'spin' : undefined} size={16} aria-hidden="true" />
            {query.isFetching && !query.isPending ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>

        {query.isPending ? <LoadingState label="Loading contents" rows={6} /> : null}
        {query.isError ? (
          <div className="state-wrap">
            <ErrorState message={getErrorMessage(query.error)} />
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        ) : null}
        {query.data && query.data.items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No results found' : 'No content yet'}
            description={filtered ? 'No content matches the active filters.' : 'Submit the first content item to start the moderation flow.'}
            action={filtered ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Link className="button button-primary" to="/contents/new">Submit content</Link>
            )}
          />
        ) : null}

        {query.data && query.data.items.length > 0 ? (
          <>
            <div className="desktop-table-wrap">
              <table className="data-table">
                <thead><tr><th>Content</th><th>Status</th><th>User</th><th>Submitted</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {query.data.items.map((content) => (
                    <tr key={content.id}>
                      <td><Link className="table-primary" to={`/contents/${content.id}`}>{contentPreview(content.body)}</Link><code>{formatCompactId(content.id)}</code></td>
                      <td><StatusBadge status={content.status} /></td>
                      <td><code title={content.userId}>{formatCompactId(content.userId)}</code></td>
                      <td><time dateTime={content.createdAt}>{formatDateTime(content.createdAt)}</time></td>
                      <td className="cell-actions"><ContentActionsMenu contentId={content.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list">
              {query.data.items.map((content) => (
                <article key={content.id} className="mobile-data-card">
                  <div className="mobile-card-heading">
                    <Link to={`/contents/${content.id}`}>{contentPreview(content.body, 72)}</Link>
                    <ContentActionsMenu contentId={content.id} />
                  </div>
                  <StatusBadge status={content.status} />
                  <dl>
                    <div><dt>User</dt><dd><code>{formatCompactId(content.userId)}</code></dd></div>
                    <div><dt>Submitted</dt><dd>{formatDateTime(content.createdAt)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <PaginationControls
              page={query.data.page}
              limit={query.data.limit}
              total={query.data.total}
              disabled={query.isFetching}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
