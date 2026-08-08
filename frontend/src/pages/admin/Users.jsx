import { useCallback, useState } from 'react';
import Layout from '../../components/Layout';
import InfiniteSentinel from '../../components/InfiniteSentinel';
import { EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { useInfiniteList } from '../../lib/useInfiniteList';
import { formatDate } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { useAuth } from '../../context/AuthContext';

function RoleTable({ title, icon, rows, curUser, onRoleChange, onToggle, emptyText }) {
  return (
    <div className="table-card" style={{ marginBottom: '1.4rem' }}>
      <div className="tc-header"><h6><i className={`bi ${icon}`} style={{ marginRight: '0.4rem' }} />{title} ({rows.length})</h6></div>
      <div className="table-responsive">
        <table className="ag-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: 760 }}>
          <colgroup>
            <col style={{ width: '190px' }} />
            <col style={{ width: '210px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '140px' }} />
          </colgroup>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}><EmptyState icon="bi-people">{emptyText}</EmptyState></td></tr>
            ) : rows.map((u) => (
              <tr key={u._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--neon-blue),var(--neon-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                      {u.profilePhoto ? (
                        <img src={u.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, borderRadius: 'inherit' }} />
                      ) : (
                        u.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</strong>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                <td>
                  <select
                    className="ag-select"
                    style={{ width: 'auto', padding: '0.35rem 1.75rem 0.35rem 0.6rem', fontSize: '0.8rem' }}
                    value={u.role}
                    disabled={u._id === curUser.id}
                    onChange={(e) => onRoleChange(u._id, e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{u.isActive ? <span className="ag-badge available">Active</span> : <span className="ag-badge cancelled">Inactive</span>}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                <td>
                  {u._id !== curUser.id ? (
                    <button className={`btn-ag ${u.isActive ? 'orange' : 'green'} sm`} onClick={() => onToggle(u._id)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>You</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { user: curUser } = useAuth();

  const buildUrl = useCallback((page, limit) => `/admin/users?page=${page}&limit=${limit}`, []);

  // Users load a page at a time and grow as the admin scrolls, instead of
  // the (potentially large) user base loading all at once. Loaded users
  // are split into the Admins/Staff/Users sections below as they arrive.
  const { items: users, setItems: setUsers, loading, loadingMore, hasMore, loadMore, refresh, total } =
    useInfiniteList(buildUrl, [], 30);

  async function updateRole(id, role) {
    // optimistic UI: reflect selection immediately - this also moves the
    // row between the User / Staff sections since they're derived from
    // the same `users` state by filtering on `role`.
    setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, role } : u)));
    const d = await apiRequest('/admin/users/' + id + '/role', { method: 'PUT', body: { role } });
    if (d && d.success) showToast('Role updated: ' + role, 'success');
    else { showToast((d && d.message) || 'Failed.', 'danger'); refresh(); }
  }

  async function toggleUser(id) {
    const d = await apiRequest('/admin/users/' + id + '/toggle', { method: 'PUT' });
    if (d && d.success) {
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, isActive: d.data.isActive } : u)));
      showToast(d.message, 'warning');
    } else showToast((d && d.message) || 'Failed.', 'danger');
  }

  const adminUsers = users.filter((u) => u.role === 'admin');
  const staffUsers = users.filter((u) => u.role === 'staff');
  const regularUsers = users.filter((u) => u.role === 'user');

  return (
    <Layout title="User Management" badge={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{users.length} of {total} users loaded</span>
        <button className="btn-ag ghost sm" onClick={refresh}><i className="bi bi-arrow-clockwise" /> Refresh</button>
      </div>

      {users.length === 0 && loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading users...</div>
      ) : (
        <>
          <RoleTable
            title="Admins"
            icon="bi-shield-lock"
            rows={adminUsers}
            curUser={curUser}
            onRoleChange={updateRole}
            onToggle={toggleUser}
            emptyText="No admins found."
          />

          <RoleTable
            title="Staff"
            icon="bi-person-badge"
            rows={staffUsers}
            curUser={curUser}
            onRoleChange={updateRole}
            onToggle={toggleUser}
            emptyText="No staff members found."
          />

          <RoleTable
            title="Users"
            icon="bi-people"
            rows={regularUsers}
            curUser={curUser}
            onRoleChange={updateRole}
            onToggle={toggleUser}
            emptyText="No users found."
          />

          <InfiniteSentinel onVisible={loadMore} hasMore={hasMore} loading={loadingMore} />
        </>
      )}
    </Layout>
  );
}
