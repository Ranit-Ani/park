import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { StatusBadge, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils';

const COLORS = { Booked: 'booked', Active: 'active', Completed: 'completed', Cancelled: 'cancelled' };

export default function AdminBookings() {
  const [all, setAll] = useState([]);
  const [fStatus, setFStatus] = useState('');
  const [fDate, setFDate] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    let url = '/staff/bookings/all?';
    if (fStatus) url += 'status=' + fStatus + '&';
    if (fDate) url += 'date=' + fDate;
    const d = await apiRequest(url);
    if (d && d.success) setAll(d.data);
  }, [fStatus, fDate]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { Booked: 0, Active: 0, Completed: 0, Cancelled: 0 };
    all.forEach((b) => { if (c[b.status] !== undefined) c[b.status]++; });
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return all;
    return all.filter((b) => b._id.toLowerCase().includes(q) || (b.userId?.name || '').toLowerCase().includes(q) || (b.slotId?.slotNumber || '').toLowerCase().includes(q));
  }, [all, search]);

  function clearF() { setFStatus(''); setFDate(''); setSearch(''); }

  return (
    <Layout title="Booking Registry" badge={false}>
      <div className="ag-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label className="ag-label">Status</label>
            <select className="ag-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All</option>
              <option value="Booked">Booked</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div><label className="ag-label">Date</label><input className="ag-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
          <div><label className="ag-label">Search</label><input className="ag-input" type="text" placeholder="Name, slot, ID..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button className="btn-ag ghost" onClick={clearF}><i className="bi bi-x-circle" /> Clear</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {Object.entries(counts).map(([s, c]) => (
          <span key={s} className={`ag-badge ${COLORS[s]}`}>{s}: {c}</span>
        ))}
      </div>

      <div className="table-card">
        <div className="tc-header"><h6>All Bookings <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({rows.length} results)</span></h6></div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>ID</th><th>User</th><th>Slot</th><th>Booked</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon="bi-inbox">No bookings found.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b._id.slice(-8).toUpperCase()}</span></td>
                  <td><strong>{b.userId?.name || '—'}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{b.userId?.email || ''}</small></td>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{b.slotId?.slotNumber || '—'}</strong><br /><small style={{ color: 'var(--text-dim)' }}>{b.slotId?.location || ''}</small></td>
                  <td>{formatDate(b.bookingTime)}</td>
                  <td>{b.checkInTime ? formatDateTime(b.checkInTime) : '—'}</td>
                  <td>{b.checkOutTime ? formatDateTime(b.checkOutTime) : '—'}</td>
                  <td>{b.totalHours ? b.totalHours + 'h' : '—'}</td>
                  <td>{b.totalAmount ? <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>₹{b.totalAmount}</span> : '—'}</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
