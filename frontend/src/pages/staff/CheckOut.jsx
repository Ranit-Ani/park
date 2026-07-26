import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

function dur(ci) {
  const ms = Date.now() - new Date(ci);
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
function est(ci, r) {
  const ms = Date.now() - new Date(ci);
  const h = Math.max(Math.ceil(ms / 3600000), 1);
  return `₹${(h * r).toFixed(0)} est.`;
}

export default function CheckOut() {
  const [all, setAll] = useState([]);
  const [search, setSearch] = useState('');
  const [alert, setAlert] = useState({ message: '', type: 'info' });
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState(null);

  const load = useCallback(async () => {
    const d = await apiRequest('/staff/bookings/all?status=Active');
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
    return all.filter((b) => b._id.toLowerCase().includes(q) || (b.userId?.name || '').toLowerCase().includes(q) || (b.slotId?.slotNumber || '').toLowerCase().includes(q));
  }, [all, search]);

  async function confirmCheckOut() {
    if (!sel) return;
    setBusy(true);
    const d = await apiRequest('/staff/checkout/' + sel._id, { method: 'POST' });
    setBusy(false);
    setSel(null);
    if (d && d.success) setBill(d.data);
    else setAlert({ message: (d && d.message) || 'Check-out failed.', type: 'danger' });
  }

  return (
    <Layout title="Check-Out Console" badge={`${all.length} active`} badgeClass="occupied">
      <Alert message={alert.message} type={alert.type} />
      <div className="ag-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div className="ag-input-icon"><i className="bi bi-search" /><input className="ag-input" type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="table-card">
        <div className="tc-header"><h6>Active Sessions — Parked Now</h6><button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button></div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Booking ID</th><th>User</th><th>Slot</th><th>Location</th><th>Check-In</th><th>Duration</th><th>Est. Bill</th><th>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon="bi-car-front">No active sessions.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b._id.slice(-8).toUpperCase()}</span></td>
                  <td><strong>{b.userId?.name || '—'}</strong></td>
                  <td><span className="ag-badge occupied">{b.slotId?.slotNumber || '—'}</span></td>
                  <td>{b.slotId?.location || '—'}</td>
                  <td>{formatDateTime(b.checkInTime)}</td>
                  <td><span className="ag-badge active">{dur(b.checkInTime)}</span></td>
                  <td style={{ color: 'var(--neon-green)', fontWeight: 600 }}>{est(b.checkInTime, b.slotId?.hourlyRate)}</td>
                  <td><button className="btn-ag red sm" onClick={() => setSel(b)}><i className="bi bi-box-arrow-right" /> Check Out</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        show={!!sel}
        onClose={() => setSel(null)}
        title="Confirm Check-Out"
        icon="bi-box-arrow-right"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(255,45,85,0.12),rgba(255,107,53,0.08))' }}
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setSel(null)}>Cancel</button>
            <ActionButton busy={busy} busyLabel="Processing..." className="btn-ag red" onClick={confirmCheckOut}>
              <i className="bi bi-box-arrow-right" /> Confirm &amp; Generate Bill
            </ActionButton>
          </>
        )}
      >
        {sel && (
          <>
            <table className="bill-table">
              <tbody>
                <tr><td>User</td><td style={{ fontWeight: 700 }}>{sel.userId?.name}</td></tr>
                <tr><td>Slot</td><td style={{ color: 'var(--neon-orange)', fontWeight: 700 }}>{sel.slotId?.slotNumber}</td></tr>
                <tr><td>Check-In</td><td>{formatDateTime(sel.checkInTime)}</td></tr>
                <tr><td>Check-Out</td><td style={{ color: 'var(--neon-red)', fontWeight: 700 }}>{new Date().toLocaleString('en-IN')}</td></tr>
              </tbody>
            </table>
            <div className="ag-alert warning" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
              <i className="bi bi-calculator" /> Final bill calculated after confirm. Min 1h applies.
            </div>
          </>
        )}
      </Modal>

      <Modal
        show={!!bill}
        onClose={() => { setBill(null); load(); }}
        title="Bill Generated"
        icon="bi-receipt-cutoff"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(0,255,157,0.15),rgba(0,136,255,0.1))' }}
        footer={<button className="btn-ag green full" onClick={() => { setBill(null); load(); }}><i className="bi bi-check-circle" /> Done</button>}
      >
        {bill && (
          <>
            <div className="bill-receipt">
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>TOTAL CHARGED</div>
              <div className="bill-amount">₹{bill.bill.totalAmount}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{bill.booking.slotId?.slotNumber} | {bill.booking.userId?.name}</div>
            </div>
            <table className="bill-table">
              <tbody>
                <tr><td>Duration</td><td>{bill.bill.breakdown.durationMinutes} min</td></tr>
                <tr><td>Billed Hours</td><td>{bill.bill.roundedHours}h</td></tr>
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
