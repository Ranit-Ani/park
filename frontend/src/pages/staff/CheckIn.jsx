import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils';

export default function CheckIn() {
  const [all, setAll] = useState([]);
  const [search, setSearch] = useState('');
  const [alert, setAlert] = useState({ message: '', type: 'info' });
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await apiRequest('/staff/bookings/all?status=Booked');
    if (d && d.success) setAll(d.data);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return all;
    return all.filter((b) => b._id.toLowerCase().includes(q) || (b.userId?.name || '').toLowerCase().includes(q) || (b.slotId?.slotNumber || '').toLowerCase().includes(q) || (b.vehicleNumber || '').toLowerCase().includes(q));
  }, [all, search]);

  async function confirmCheckIn() {
    if (!sel) return;
    setBusy(true);
    const d = await apiRequest('/staff/checkin/' + sel._id, { method: 'POST' });
    setBusy(false);
    setSel(null);
    if (d && d.success) load();
    else setAlert({ message: (d && d.message) || 'Check-in failed.', type: 'danger' });
  }

  return (
    <Layout title="Check-In Console" badge={`${all.length} pending`} badgeClass="booked">
      <Alert message={alert.message} type={alert.type} />
      <div className="ag-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div className="ag-input-icon"><i className="bi bi-search" /><input className="ag-input" type="text" placeholder="Search by name, slot, vehicle, ID..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="table-card">
        <div className="tc-header"><h6>Booked — Awaiting Check-In</h6><button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button></div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Booking ID</th><th>User</th><th>Vehicle</th><th>Slot</th><th>Location</th><th>Scheduled</th><th>Booked At</th><th>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon="bi-check-all">No pending check-ins.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b._id.slice(-8).toUpperCase()}</span></td>
                  <td><strong>{b.userId?.name || '—'}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{b.userId?.email || ''}</small></td>
                  <td>
                    <span className="font-mono" style={{ fontWeight: 700 }}>
                      {b.registrationPending ? <span className="ag-badge unverified">Pending</span> : (b.vehicleNumber || '—')}
                    </span>
                    <br /><small style={{ color: 'var(--text-muted)' }}>{b.vehicleCategory || ''}</small>
                  </td>
                  <td><span className="ag-badge available">{b.slotId?.slotNumber || '—'}</span></td>
                  <td>{b.slotId?.location || '—'}</td>
                  <td>{formatDate(b.scheduledDate)}</td>
                  <td>{formatDateTime(b.bookingTime)}</td>
                  <td><button className="btn-ag green sm" onClick={() => setSel(b)}><i className="bi bi-box-arrow-in-right" /> Check In</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        show={!!sel}
        onClose={() => setSel(null)}
        title="Confirm Check-In"
        icon="bi-box-arrow-in-right"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(0,255,157,0.12),rgba(0,136,255,0.08))' }}
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setSel(null)}>Cancel</button>
            <ActionButton busy={busy} busyLabel="Confirming..." className="btn-ag green" onClick={confirmCheckIn}>
              <i className="bi bi-check-circle" /> Confirm Check-In
            </ActionButton>
          </>
        )}
      >
        {sel && (
          <>
            <table className="bill-table">
              <tbody>
                <tr><td>User</td><td style={{ fontWeight: 700 }}>{sel.userId?.name}</td></tr>
                <tr><td>Vehicle</td><td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>{sel.vehicleCategory || '—'}</td></tr>
                <tr><td>Registration No.</td><td style={{ color: 'var(--neon-green)', fontWeight: 700, fontFamily: 'monospace' }}>{sel.registrationPending ? <span className="ag-badge unverified">Pending</span> : (sel.vehicleNumber || '—')}</td></tr>
                <tr><td>Slot</td><td style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>{sel.slotId?.slotNumber}</td></tr>
                <tr><td>Location</td><td>{sel.slotId?.location}</td></tr>
                <tr><td>Rate</td><td>₹{sel.slotId?.hourlyRate}/hour</td></tr>
                <tr><td>Check-In Time</td><td style={{ color: 'var(--neon-green)' }}>{new Date().toLocaleString('en-IN')}</td></tr>
              </tbody>
            </table>
            <div className="ag-alert info" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
              <i className="bi bi-arrow-right-circle" /> Status will change: Booked → Occupied
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}