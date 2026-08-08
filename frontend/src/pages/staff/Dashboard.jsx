import { useCallback, useEffect, useState } from 'react';
import Layout, { PageHeader } from '../../components/Layout';
import Modal from '../../components/Modal';
import { StatCard, StatusBadge, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ Booked: '--', Occupied: '--', Available: '--', total: '--' });
  const [rows, setRows] = useState([]);
  const [bill, setBill] = useState(null);

  const load = useCallback(async () => {
    const [s, bk] = await Promise.all([apiRequest('/slots/stats'), apiRequest('/staff/bookings?limit=100')]);
    if (s && s.success) setStats(s.data);
    if (bk && bk.success) setRows(bk.data);
  }, []);

  useEffect(() => {
    load();

    // Live sync: a new booking from any user, or a check-in/out done by a
    // teammate on another device, updates this screen instantly.
    const socket = getSocket();
    const onNewBooking = () => { showToast('New booking placed by a user', 'info'); load(); };
    socket.on('slotUpdated', load);
    socket.on('slotDeleted', load);
    socket.on('bookingCreated', onNewBooking);
    socket.on('bookingUpdated', load);

    const t = setInterval(load, 60000); // safety-net poll
    return () => {
      clearInterval(t);
      socket.off('slotUpdated', load);
      socket.off('slotDeleted', load);
      socket.off('bookingCreated', onNewBooking);
      socket.off('bookingUpdated', load);
    };
  }, [load]);

  async function doCI(id) {
    if (!confirm('Confirm check-in?')) return;
    const d = await apiRequest('/staff/checkin/' + id, { method: 'POST' });
    if (d && d.success) { showToast('Check-in: Slot ' + d.data.slotId?.slotNumber, 'success'); load(); }
    else showToast(d?.message || 'Failed.', 'danger');
  }

  async function doCO(id) {
    if (!confirm('Confirm check-out?')) return;
    const d = await apiRequest('/staff/checkout/' + id, { method: 'POST' });
    if (d && d.success) setBill(d.data);
    else showToast(d?.message || 'Failed.', 'danger');
  }

  return (
    <Layout title="Operations Control" badge="Parking Staff">
      <PageHeader
        title={`Welcome, ${user?.name}!`}
        subtitle="Real-time parking management"
        action={<button className="btn-ag cyan sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard color="orange" label="Pending Check-In" value={stats.Booked} icon="bi-hourglass" />
        <StatCard color="red" label="Occupied Now" value={stats.Occupied} icon="bi-car-front-fill" />
        <StatCard color="green" label="Available Slots" value={stats.Available} icon="bi-check-circle-fill" />
        <StatCard color="cyan" label="Total Slots" value={stats.total} icon="bi-grid-3x3-gap" />
      </div>

      <div className="table-card">
        <div className="tc-header"><h6>Active Sessions &amp; Pending Check-Ins</h6></div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>ID</th><th>User</th><th>Slot</th><th>Booked At</th><th>Check-In</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon="bi-check-all">No pending operations.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b._id.slice(-6).toUpperCase()}</span></td>
                  <td><strong>{b.userId?.name || '—'}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{b.userId?.email || ''}</small></td>
                  <td><span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{b.slotId?.slotNumber}</span><br /><small style={{ color: 'var(--text-dim)' }}>{b.slotId?.location}</small></td>
                  <td>{formatDateTime(b.bookingTime)}</td>
                  <td>{b.checkInTime ? formatDateTime(b.checkInTime) : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    {b.status === 'Booked' && <button className="btn-ag green sm" onClick={() => doCI(b._id)}><i className="bi bi-box-arrow-in-right" /> Check In</button>}
                    {b.status === 'Active' && <button className="btn-ag red sm" onClick={() => doCO(b._id)}><i className="bi bi-box-arrow-right" /> Check Out</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        show={!!bill}
        onClose={() => { setBill(null); load(); }}
        title="Check-Out Complete"
        icon="bi-receipt-cutoff"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(0,255,157,0.15),rgba(0,136,255,0.1))' }}
        footer={<button className="btn-ag green full" onClick={() => { setBill(null); load(); }}><i className="bi bi-check-circle" /> Done</button>}
      >
        {bill && (
          <>
            <div className="bill-receipt">
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>TOTAL DUE</div>
              <div className="bill-amount">₹{bill.bill.totalAmount}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{bill.booking.slotId?.slotNumber} | {bill.booking.userId?.name}</div>
            </div>
            <table className="bill-table">
              <tbody>
                <tr><td>Duration</td><td>{bill.bill.breakdown.durationMinutes} min</td></tr>
                <tr><td>Billed Hours</td><td>{bill.bill.roundedHours}h {bill.bill.breakdown.minimumApplied && <span className="ag-badge active" style={{ fontSize: '0.6rem' }}>Min 1h</span>}</td></tr>
                <tr><td>Rate</td><td>₹{bill.bill.hourlyRate}/hr</td></tr>
                <tr><td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>Total</td><td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>₹{bill.bill.totalAmount}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </Layout>
  );
}