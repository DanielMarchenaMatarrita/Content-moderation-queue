import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router-dom';
import { getUser, usersQueryKeys } from '../features/users/api';
import { Button } from '../shared/components/Button';
import { ErrorState, LoadingState } from '../shared/components/DataStates';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { formatDateTime, getErrorMessage } from '../shared/lib/format';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: usersQueryKeys.detail(id),
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });

  return (
    <div className="page-stack narrow-page">
      <PageHeader
        eyebrow="User detail"
        title={query.data?.displayName ?? 'User record'}
        description="Actor record returned by the Users API."
        backLink={<Link className="back-link" to="/users"><ArrowLeft size={16} aria-hidden="true" />Back to users</Link>}
      />
      {query.isPending ? <LoadingState label="Loading user" rows={4} /> : null}
      {query.isError ? <div className="state-wrap"><ErrorState message={getErrorMessage(query.error)} /><Button onClick={() => void query.refetch()}>Try again</Button></div> : null}
      {query.data ? (
        <section className="detail-card detail-card-body" aria-label="User details">
          <div className="detail-record-heading"><div><h3>{query.data.displayName}</h3><p>{query.data.email}</p></div><StatusBadge status={query.data.role} /></div>
          <dl className="metadata-list">
            <div><dt>User ID</dt><dd><code>{query.data.id}</code></dd></div>
            <div><dt>Email</dt><dd>{query.data.email}</dd></div>
            <div><dt>Role</dt><dd>{query.data.role}</dd></div>
            <div><dt>Created</dt><dd><time dateTime={query.data.createdAt} title={query.data.createdAt}>{formatDateTime(query.data.createdAt)}</time></dd></div>
            <div><dt>Updated</dt><dd><time dateTime={query.data.updatedAt} title={query.data.updatedAt}>{formatDateTime(query.data.updatedAt)}</time></dd></div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
