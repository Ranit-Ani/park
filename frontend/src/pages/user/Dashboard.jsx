import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { PageHeader } from '../../components/Layout';
import { StatCard, StatusBadge, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { useAuth } from '../../context/AuthContext';

export default function UserDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await apiRequest('/bookings');
    if (data && data.success) setBookings(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function cancelBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    const d = await apiRequest('/bookings/' + id, { method: 'DELETE' });
    if (d && d.success) { showToast('Booking cancelled.', 'warning'); load(); }
    else showToast(d?.message || 'Failed.', 'danger');
  }

  const active = bookings.filter((b) => ['Booked', 'Active'].includes(b.status));
  const completed = bookings.filter((b) => b.status === 'Completed');
  const spent = completed.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const recent = bookings.slice(0, 8);

  return (
    <Layout title="Mission Control">
      <PageHeader
        title={`Welcome, ${user?.name}!`}
        subtitle="Your parking mission overview"
        action={<Link to="/user/book" className="btn-ag primary sm"><i className="bi bi-plus-circle me-1" /> Book Slot</Link>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard color="cyan" label="Total Bookings" value={bookings.length} icon="bi-calendar2-check" />
        <StatCard color="green" label="Active Now" value={active.length} icon="bi-geo-alt-fill" />
        <StatCard color="orange" label="Completed" value={completed.length} icon="bi-check-circle-fill" />
        <StatCard color="purple" label="Total Spent" value={`₹${spent.toFixed(0)}`} icon="bi-currency-rupee" />
      </div>

      <div className="table-card">
        <div className="tc-header">
          <h6>Recent Missions</h6>
          <Link to="/user/bookings" className="btn-ag ghost sm">View All</Link>
        </div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Slot</th><th>Booked</th><th>Check-In</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading orbit data...</td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon="bi-calendar-x">No bookings yet. <Link to="/user/book" style={{ color: 'var(--neon-cyan)' }}>Book your first slot!</Link></EmptyState></td></tr>
              ) : recent.map((r) => (
                <tr key={r._id}>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{r.slotId?.slotNumber || '—'}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{r.slotId?.location || ''}</small></td>
                  <td>{formatDate(r.bookingTime)}</td>
                  <td>{r.checkInTime ? formatDateTime(r.checkInTime) : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                  <td>{r.totalAmount ? <span style={{ color: 'var(--neon-green)' }}>₹{r.totalAmount}</span> : '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.status === 'Booked' && <button className="btn-ag red sm" onClick={() => cancelBooking(r._id)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
