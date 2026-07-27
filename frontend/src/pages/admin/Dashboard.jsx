import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { PageHeader } from '../../components/Layout';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../lib/socket';
import { showToast } from '../../lib/toast';

const empty = {
  revenue: { totalRevenue: 0, totalBookings: 0, avgAmount: 0 },
  activeBookings: 0, occupancyRate: 0, totalUsers: 0,
  slots: { Available: '--', Booked: '--', Occupied: '--', total: '--' },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(empty);

  const load = useCallback(async () => {
    const res = await apiRequest('/admin/dashboard');
    if (res && res.success) setD(res.data);
  }, []);

  useEffect(() => {
    load();

    // Live sync: refresh stats the moment a booking/slot/revenue event
    // happens anywhere in the system, and pop a toast for visibility
    // (like a Facebook-style notification) while the admin is on this page.
    const socket = getSocket();
    const refresh = () => load();
    const onNewBooking = () => { showToast('New booking placed', 'info'); load(); };
    const onRevenue = ({ amount }) => { showToast(`Payment received: ₹${amount}`, 'success'); load(); };

    socket.on('slotUpdated', refresh);
    socket.on('bookingCreated', onNewBooking);
    socket.on('bookingUpdated', refresh);
    socket.on('revenueUpdated', onRevenue);
    socket.on('userUpdated', refresh);

    const t = setInterval(load, 60000); // safety-net poll
    return () => {
      clearInterval(t);
      socket.off('slotUpdated', refresh);
      socket.off('bookingCreated', onNewBooking);
      socket.off('bookingUpdated', refresh);
      socket.off('revenueUpdated', onRevenue);
      socket.off('userUpdated', refresh);
    };
  }, [load]);

  return (
    <Layout title="Command Dashboard" badge="Administrator">
      <PageHeader
        title={`Welcome, ${user?.name}!`}
        subtitle="Full system oversight and control"
        action={<button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div className="stat-label">Total Revenue</div><div className="stat-value text-green">₹{(d.revenue.totalRevenue || 0).toFixed(0)}</div></div>
            <div className="stat-icon green"><i className="bi bi-currency-rupee" /></div>
          </div>
        </div>
        <div className="stat-card cyan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div className="stat-label">Active Bookings</div><div className="stat-value text-cyan">{d.activeBookings}</div></div>
            <div className="stat-icon cyan"><i className="bi bi-calendar-check" /></div>
          </div>
        </div>
        <div className="stat-card orange">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div className="stat-label">Occupancy Rate</div><div className="stat-value text-orange">{d.occupancyRate}%</div></div>
            <div className="stat-icon orange"><i className="bi bi-bar-chart-fill" /></div>
          </div>
        </div>
        <div className="stat-card purple">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div className="stat-label">Total Users</div><div className="stat-value">{d.totalUsers}</div></div>
            <div className="stat-icon purple"><i className="bi bi-people" /></div>
          </div>
        </div>
      </div>

      <div className="dash-two-col" style={{ marginBottom: '1.25rem' }}>
        <div className="ag-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>SLOT STATUS MATRIX</div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ textAlign: 'center' }}><div className="font-orbit" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--neon-green)' }}>{d.slots.Available}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Available</div></div>
            <div style={{ textAlign: 'center' }}><div className="font-orbit" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffc107' }}>{d.slots.Booked}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booked</div></div>
            <div style={{ textAlign: 'center' }}><div className="font-orbit" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--neon-orange)' }}>{d.slots.Occupied}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Occupied</div></div>
            <div style={{ textAlign: 'center' }}><div className="font-orbit" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--neon-cyan)' }}>{d.slots.total}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</div></div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Occupancy</div>
          <div className="ag-progress"><div className="ag-progress-bar" style={{ width: d.occupancyRate + '%', background: 'linear-gradient(90deg,var(--neon-cyan),var(--neon-blue))' }} /></div>
        </div>

        <div className="ag-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>QUICK COMMANDS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <Link to="/admin/slots" className="btn-ag cyan full" style={{ justifyContent: 'flex-start' }}><i className="bi bi-plus-circle" /> Add New Parking Slot</Link>
            <Link to="/admin/users" className="btn-ag ghost full" style={{ justifyContent: 'flex-start' }}><i className="bi bi-person-gear" /> Manage User Roles</Link>
            <Link to="/admin/revenue" className="btn-ag green full" style={{ justifyContent: 'flex-start' }}><i className="bi bi-graph-up" /> Revenue Analytics</Link>
            <Link to="/admin/bookings" className="btn-ag ghost full" style={{ justifyContent: 'flex-start' }}><i className="bi bi-list-columns" /> All Bookings Log</Link>
          </div>
        </div>
      </div>

      <div className="ag-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>FINANCIAL OVERVIEW</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.1)', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>All-Time Revenue</div>
            <div className="font-orbit" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--neon-green)' }}>₹{(d.revenue.totalRevenue || 0).toFixed(2)}</div>
          </div>
          <div style={{ background: 'rgba(0,136,255,0.05)', border: '1px solid rgba(0,136,255,0.1)', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completed Bookings</div>
            <div className="font-orbit" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--neon-cyan)' }}>{d.revenue.totalBookings}</div>
          </div>
          <div style={{ background: 'rgba(255,193,7,0.05)', border: '1px solid rgba(255,193,7,0.1)', borderRadius: 12, padding: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg Booking Value</div>
            <div className="font-orbit" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffc107' }}>₹{(d.revenue.avgAmount || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}