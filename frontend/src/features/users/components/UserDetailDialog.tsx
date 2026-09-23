import { useQuery } from '@tanstack/react-query';
import { getUser, usersQueryKeys } from '../api';
import { ErrorState, LoadingState } from '../../../shared/components/DataStates';
import { Modal } from '../../../shared/components/Modal';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { formatDateTime, getErrorMessage } from '../../../shared/lib/format';

export function UserDetailDialog({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({
    queryKey: usersQueryKeys.detail(userId ?? ''),
    queryFn: () => getUser(userId ?? ''),
    enabled: Boolean(userId),
  });

  return (
    <Modal open={Boolean(userId)} onOpenChange={onOpenChange} title="User detail" description="Record returned by GET /users/:id.">
      {query.isPending ? <LoadingState label="Loading user" rows={3} /> : null}
      {query.isError ? <ErrorState message={getErrorMessage(query.error)} /> : null}
      {query.data ? (
        <div className="detail-record">
          <div className="detail-record-heading"><div><h3>{query.data.displayName}</h3><p>{query.data.email}</p></div><StatusBadge status={query.data.role} /></div>
          <dl className="metadata-list">
            <div><dt>User ID</dt><dd><code>{query.data.id}</code></dd></div>
            <div><dt>Created</dt><dd>{formatDateTime(query.data.createdAt)}</dd></div>
            <div><dt>Updated</dt><dd>{formatDateTime(query.data.updatedAt)}</dd></div>
          </dl>
        </div>
      ) : null}
    </Modal>
  );
}
