import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import InfiniteSentinel from '../../components/InfiniteSentinel';
import { StatusBadge, EmptyState } from '../../components/Bits';
import { useInfiniteList } from '../../lib/useInfiniteList';
import { formatDate, formatDateTime } from '../../lib/utils';
import { getSocket } from '../../lib/socket';

const COLORS = { Booked: 'booked', Active: 'active', Completed: 'completed', Cancelled: 'cancelled', Expired: 'expired' };

export default function StaffBookings() {
  const [fStatus, setFStatus] = useState('');
  const [fDate, setFDate] = useState('');
  const [search, setSearch] = useState('');
  const [alert] = useState({ message: '', type: 'info' });

  const buildUrl = useCallback((page, limit) => {
    let url = `/staff/bookings/all?page=${page}&limit=${limit}`;
    if (fStatus) url += '&status=' + fStatus;
    if (fDate) url += '&date=' + fDate;
    return url;
  }, [fStatus, fDate]);

  // Bookings load a page at a time (status/date filtered server-side) and
  // grow as the user scrolls, instead of the registry loading everything.
  const { items: all, loading, loadingMore, hasMore, loadMore, refresh, total } =
    useInfiniteList(buildUrl, [fStatus, fDate], 30);

  useEffect(() => {
    const socket = getSocket();
    socket.on('bookingCreated', refresh);
    socket.on('bookingUpdated', refresh);
    socket.on('bookingCancelled', refresh);
    return () => {
      socket.off('bookingCreated', refresh);
      socket.off('bookingUpdated', refresh);
      socket.off('bookingCancelled', refresh);
    };
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { Booked: 0, Active: 0, Completed: 0, Cancelled: 0, Expired: 0 };
    all.forEach((b) => { if (c[b.status] !== undefined) c[b.status]++; });
    return c;
  }, [all]);

  // Search filters the rows already loaded into memory. Since results load
  // incrementally, a search term may not match rows further down that
  // haven't been fetched yet — scroll down (or clear the search) to pull
  // in more before searching if you don't see what you expect.
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return all;
    return all.filter((b) => b._id.toLowerCase().includes(q) || (b.userId?.name || '').toLowerCase().includes(q) || (b.slotId?.slotNumber || '').toLowerCase().includes(q) || (b.vehicleNumber || '').toLowerCase().includes(q));
  }, [all, search]);

  function clearF() { setFStatus(''); setFDate(''); setSearch(''); }

  return (
    <Layout title="Booking Registry">
      <Alert message={alert.message} type={alert.type} />
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
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div><label className="ag-label">Date</label><input className="ag-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
          <div><label className="ag-label">Search</label><input className="ag-input" type="text" placeholder="Name, slot..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <button className="btn-ag ghost" onClick={clearF}><i className="bi bi-x-circle" /> Clear</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {Object.entries(counts).map(([s, c]) => (
          <span key={s} className={`ag-badge ${COLORS[s]}`}>{s}: {c}</span>
        ))}
      </div>

      <div className="table-card">
        <div className="tc-header">
          <h6>Bookings <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-orbit,monospace)', fontSize: '0.7rem' }}>({rows.length}/{total})</span></h6>
          <button className="btn-ag ghost sm" onClick={refresh}><i className="bi bi-arrow-clockwise" /> Refresh</button>
        </div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>ID</th><th>User</th><th>Vehicle</th><th>Slot</th><th>Booked</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.length === 0 && loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading bookings...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11}><EmptyState icon="bi-inbox">No bookings found.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b._id.slice(-8).toUpperCase()}</span></td>
                  <td><strong>{b.userId?.name || '—'}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{b.userId?.email || ''}</small></td>
                  <td>
                    <span className="font-mono" style={{ fontWeight: 700 }}>
                      {b.registrationPending ? <span className="ag-badge unverified">Pending</span> : (b.vehicleNumber || '—')}
                    </span>
                    <br /><small style={{ color: 'var(--text-muted)' }}>{b.vehicleCategory || ''}</small>
                  </td>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{b.slotId?.slotNumber || '—'}</strong><br /><small style={{ color: 'var(--text-dim)' }}>{b.slotId?.location || ''}</small></td>
                  <td>{formatDate(b.bookingTime)}</td>
                  <td>{b.checkInTime ? formatDateTime(b.checkInTime) : '—'}</td>
                  <td>{b.checkOutTime ? formatDateTime(b.checkOutTime) : '—'}</td>
                  <td>{b.totalHours ? b.totalHours + 'h' : '—'}</td>
                  <td>{b.totalAmount ? <span style={{ color: 'var(--neon-green)' }}>₹{b.totalAmount}</span> : '—'}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    {b.status === 'Booked' && <Link to="/staff/checkin" className="btn-ag green sm"><i className="bi bi-box-arrow-in-right" /></Link>}
                    {b.status === 'Active' && <Link to="/staff/checkout" className="btn-ag red sm"><i className="bi bi-box-arrow-right" /></Link>}
                    {!['Booked', 'Active'].includes(b.status) && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <InfiniteSentinel onVisible={loadMore} hasMore={hasMore} loading={loadingMore} />
        )}
      </div>
    </Layout>
  );
}