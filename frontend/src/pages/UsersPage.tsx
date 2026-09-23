import { useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Copy, FunnelSimple, Plus, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { listUsers, usersQueryKeys, type ListUsersParams } from '../features/users/api';
import { useToast } from '../app/providers/ToastProvider';
import { ActionMenu } from '../shared/components/ActionMenu';
import { Button } from '../shared/components/Button';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/DataStates';
import { Input, Select } from '../shared/components/FormControls';
import { PaginationControls } from '../shared/components/PaginationControls';
import { PageHeader } from '../shared/components/PageHeader';
import { StatusBadge } from '../shared/components/StatusBadge';
import { userRoles, type UserRole } from '../shared/types/api';
import { copyText } from '../shared/lib/clipboard';
import { formatCompactId, formatDateTime, getErrorMessage } from '../shared/lib/format';

const pageSize = 20;

export function UsersPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Pick<ListUsersParams, 'q' | 'role'>>({});
  const [draftQuery, setDraftQuery] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const params = { page, limit: pageSize, ...filters };
  const query = useQuery({
    queryKey: usersQueryKeys.list(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(filters.q || filters.role);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters({ q: draftQuery.trim() || undefined, role: draftRole ? (draftRole as UserRole) : undefined });
  }

  function clearFilters() {
    setDraftQuery('');
    setDraftRole('');
    setFilters({});
    setPage(1);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Users"
        description="Browse and create the actors accepted by the current Users API. Role assignment remains server controlled."
        action={<Link className="button button-primary" to="/users/new"><Plus size={18} aria-hidden="true" />Create user</Link>}
      />
      <form className="filter-toolbar" onSubmit={applyFilters}>
        <div className="filter-control filter-grow"><label htmlFor="user-search">Search</label><Input id="user-search" value={draftQuery} placeholder="Email or display name" onChange={(event) => setDraftQuery(event.target.value)} /></div>
        <div className="filter-control"><label htmlFor="role-filter">Role</label><Select id="role-filter" value={draftRole} onChange={(event) => setDraftRole(event.target.value)}><option value="">All roles</option>{userRoles.map((role) => <option key={role} value={role}>{role}</option>)}</Select></div>
        <div className="filter-actions"><Button type="submit" size="sm"><FunnelSimple size={16} />Apply</Button>{filtered ? <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X size={16} />Clear</Button> : null}</div>
      </form>
      <section className="data-card" aria-label="Users results">
        <div className="data-card-header"><div><h3>User directory</h3>{query.data ? <span>{query.data.total} total</span> : null}</div></div>
        {query.isPending ? <LoadingState label="Loading users" rows={6} /> : null}
        {query.isError ? <ErrorState message={getErrorMessage(query.error)} /> : null}
        {query.data && query.data.items.length === 0 ? <EmptyState title={filtered ? 'No users found' : 'No users yet'} description={filtered ? 'No users match the active filters.' : 'Create the first user to enable content submission.'} action={filtered ? <Button onClick={clearFilters}>Clear filters</Button> : <Link className="button button-primary" to="/users/new">Create user</Link>} /> : null}
        {query.data && query.data.items.length > 0 ? (
          <>
            <div className="desktop-table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Role</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{query.data.items.map((user) => (
               <tr key={user.id}><td><Link className="table-primary" to={`/users/${user.id}`}>{user.displayName}</Link><span>{user.email}</span></td><td><StatusBadge status={user.role} /></td><td><time dateTime={user.createdAt}>{formatDateTime(user.createdAt)}</time></td><td className="cell-actions"><ActionMenu label="Open user actions" items={[{ label: 'Copy ID', icon: <Copy size={17} />, onSelect: () => { void copyText(user.id).then(() => showToast({ title: 'User ID copied', tone: 'success' })); } }]} /></td></tr>
            ))}</tbody></table></div>
            <div className="mobile-card-list">{query.data.items.map((user) => (
               <article key={user.id} className="mobile-data-card"><div className="mobile-card-heading"><Link className="table-primary" to={`/users/${user.id}`}>{user.displayName}</Link><ActionMenu items={[{ label: 'Copy ID', icon: <Copy size={17} />, onSelect: () => { void copyText(user.id); } }]} /></div><p>{user.email}</p><StatusBadge status={user.role} /><dl><div><dt>ID</dt><dd><code>{formatCompactId(user.id)}</code></dd></div><div><dt>Created</dt><dd>{formatDateTime(user.createdAt)}</dd></div></dl></article>
            ))}</div>
            <PaginationControls page={query.data.page} limit={query.data.limit} total={query.data.total} disabled={query.isFetching} onPageChange={setPage} />
          </>
        ) : null}
      </section>
    </div>
  );
}
