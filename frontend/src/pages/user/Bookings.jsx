import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import InfiniteSentinel from '../../components/InfiniteSentinel';
import { StatusBadge, EmptyState } from '../../components/Bits';
import { apiRequest, downloadFile } from '../../lib/api';
import { useInfiniteList } from '../../lib/useInfiniteList';
import { formatDate, formatDateTime } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

const FILTERS = [
  { key: 'all', label: 'All', cls: 'primary' },
  { key: 'Booked', label: 'Upcoming', cls: 'ghost' },
  { key: 'Active', label: 'Active', cls: 'cyan' },
  { key: 'Completed', label: 'Completed', cls: 'green' },
  { key: 'Cancelled', label: 'Cancelled', cls: 'ghost' },
  { key: 'Expired', label: 'Expired', cls: 'ghost' },
];

export default function UserBookings() {
  const [filter, setFilter] = useState('all');
  const [alert, setAlert] = useState({ message: '', type: 'info' });
  const [bill, setBill] = useState(null);

  const buildUrl = useCallback((page, limit) => {
    let url = `/bookings?page=${page}&limit=${limit}`;
    if (filter !== 'all') url += `&status=${encodeURIComponent(filter)}`;
    return url;
  }, [filter]);

  // Bookings are fetched a page at a time (server-side filtered by status)
  // and grow as the user scrolls, instead of loading the entire history.
  const { items: rows, loading, loadingMore, hasMore, loadMore, refresh } =
    useInfiniteList(buildUrl, [filter], 20);

  useEffect(() => {
    const socket = getSocket();
    socket.on('bookingUpdated', refresh);
    socket.on('bookingCancelled', refresh);
    return () => {
      socket.off('bookingUpdated', refresh);
      socket.off('bookingCancelled', refresh);
    };
  }, [refresh]);

  async function cancel(id) {
    if (!confirm('Cancel booking?')) return;
    const d = await apiRequest('/bookings/' + id, { method: 'DELETE' });
    if (d && d.success) { showToast('Cancelled.', 'warning'); refresh(); }
    else showToast(d?.message || 'Failed.', 'danger');
  }

  async function downloadReceipt(booking) {
    const filename = `receipt-${booking._id.slice(-8).toUpperCase()}.pdf`;
    const res = await downloadFile(`/bookings/${booking._id}/receipt`, filename);
    if (!res.success) showToast(res.message || 'Could not download receipt.', 'danger');
  }

  return (
    <Layout title="Mission Log">
      <Alert message={alert.message} type={alert.type} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`btn-ag ${filter === f.key ? f.cls : 'ghost'} sm`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="table-card">
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Slot</th><th>Vehicle</th><th>Location</th><th>Booked</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading bookings...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10}><EmptyState icon="bi-calendar-x">No bookings found.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{b.slotId?.slotNumber || '—'}</strong></td>
                  <td>
                    <span className="font-mono">
                      {b.registrationPending ? <span className="ag-badge unverified">Pending</span> : (b.vehicleNumber || '—')}
                    </span>
                    <br /><small style={{ color: 'var(--text-muted)' }}>{b.vehicleCategory || ''}</small>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{b.slotId?.location || '—'}</td>
                  <td>{formatDate(b.bookingTime)}</td>
                  <td>{b.checkInTime ? formatDateTime(b.checkInTime) : '—'}</td>
                  <td>{b.checkOutTime ? formatDateTime(b.checkOutTime) : '—'}</td>
                  <td>{b.totalHours ? b.totalHours + 'h' : '—'}</td>
                  <td>{b.totalAmount ? <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>₹{b.totalAmount}</span> : '—'}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    {b.status === 'Booked' && <button className="btn-ag red sm" onClick={() => cancel(b._id)}>Cancel</button>}
                    {b.status === 'Completed' && (
                      <button className="btn-ag ghost sm" onClick={() => setBill(b)}><i className="bi bi-receipt" /></button>
                    )}
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

      <Modal
        show={!!bill}
        onClose={() => setBill(null)}
        title="Billing Receipt"
        icon="bi-receipt"
        footer={bill && <button className="btn-ag cyan full" onClick={() => downloadReceipt(bill)}><i className="bi bi-file-earmark-pdf" /> Download PDF</button>}
      >
        {bill && (
          <>
            <div className="bill-receipt">
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>TOTAL CHARGED</div>
              <div className="bill-amount">₹{bill.totalAmount}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{bill.slotId?.slotNumber} | {bill.slotId?.location}</div>
            </div>
            <table className="bill-table">
              <tbody>
                <tr><td>Vehicle</td><td>{bill.vehicleCategory || '—'}</td></tr>
                <tr><td>Registration No.</td><td>{bill.registrationPending ? <span className="ag-badge unverified">Pending</span> : (bill.vehicleNumber || '—')}</td></tr>
                <tr><td>Check-In</td><td>{formatDateTime(bill.checkInTime)}</td></tr>
                <tr><td>Check-Out</td><td>{formatDateTime(bill.checkOutTime)}</td></tr>
                <tr><td>Billed Hours</td><td>{bill.totalHours}h</td></tr>
                <tr><td>Rate</td><td>₹{bill.slotId?.hourlyRate}/hr</td></tr>
                <tr><td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>Total</td><td style={{ color: 'var(--neon-green)', fontWeight: 700 }}>₹{bill.totalAmount}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </Layout>
  );
}