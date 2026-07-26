import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsers() {
  const { user: curUser } = useAuth();
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    const d = await apiRequest('/admin/users');
    if (d && d.success) setUsers(d.users);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateRole(id, role) {
    // optimistic UI: reflect selection immediately
    setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, role } : u)));
    const d = await apiRequest('/admin/users/' + id + '/role', { method: 'PUT', body: { role } });
    if (d && d.success) showToast('Role updated: ' + role, 'success');
    else { showToast((d && d.message) || 'Failed.', 'danger'); load(); }
  }

  async function toggleUser(id) {
    const d = await apiRequest('/admin/users/' + id + '/toggle', { method: 'PUT' });
    if (d && d.success) { showToast(d.message, 'warning'); load(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  return (
    <Layout title="User Management" badge={false}>
      <div className="table-card">
        <div className="tc-header"><h6>User Registry</h6><button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button></div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon="bi-people">No users found.</EmptyState></td></tr>
              ) : users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--neon-blue),var(--neon-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <strong>{u.name}</strong>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{u.email}</td>
                  <td>
                    <select
                      className="ag-select"
                      style={{ width: 'auto', padding: '0.35rem 1.75rem 0.35rem 0.6rem', fontSize: '0.8rem' }}
                      value={u.role}
                      disabled={u._id === curUser.id}
                      onChange={(e) => updateRole(u._id, e.target.value)}
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
                      <button className={`btn-ag ${u.isActive ? 'orange' : 'green'} sm`} onClick={() => toggleUser(u._id)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
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
    </Layout>
  );
}
