import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { StatusBadge, EmptyState } from '../../components/Bits';
import { apiRequest, downloadFile } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/utils';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

const FILTERS = [
  { key: 'all', label: 'All', cls: 'primary' },
  { key: 'Booked', label: 'Upcoming', cls: 'ghost' },
  { key: 'Active', label: 'Active', cls: 'cyan' },
  { key: 'Completed', label: 'Completed', cls: 'green' },
  { key: 'Cancelled', label: 'Cancelled', cls: 'ghost' },
];

export default function UserBookings() {
  const [all, setAll] = useState([]);
  const [filter, setFilter] = useState('all');
  const [alert, setAlert] = useState({ message: '', type: 'info' });
  const [bill, setBill] = useState(null);

  const load = useCallback(async () => {
    const d = await apiRequest('/bookings');
    if (d && d.success) setAll(d.data);
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('bookingUpdated', load);
    socket.on('bookingCancelled', load);
    return () => {
      socket.off('bookingUpdated', load);
      socket.off('bookingCancelled', load);
    };
  }, [load]);

  async function cancel(id) {
    if (!confirm('Cancel booking?')) return;
    const d = await apiRequest('/bookings/' + id, { method: 'DELETE' });
    if (d && d.success) { showToast('Cancelled.', 'warning'); load(); }
    else showToast(d?.message || 'Failed.', 'danger');
  }

  async function downloadReceipt(booking) {
    const filename = `receipt-${booking._id.slice(-8).toUpperCase()}.pdf`;
    const res = await downloadFile(`/bookings/${booking._id}/receipt`, filename);
    if (!res.success) showToast(res.message || 'Could not download receipt.', 'danger');
  }

  const rows = filter === 'all' ? all : all.filter((b) => b.status === filter);

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
            <thead><tr><th>Slot</th><th>Location</th><th>Booked</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon="bi-calendar-x">No bookings found.</EmptyState></td></tr>
              ) : rows.map((b) => (
                <tr key={b._id}>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{b.slotId?.slotNumber || '—'}</strong></td>
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
                      <>
                        <button className="btn-ag ghost sm" onClick={() => setBill(b)}><i className="bi bi-receipt" /></button>{' '}
                        <button className="btn-ag cyan sm" onClick={() => downloadReceipt(b)}><i className="bi bi-file-earmark-pdf" /> PDF</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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