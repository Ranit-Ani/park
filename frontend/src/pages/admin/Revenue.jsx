import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import Layout from '../../components/Layout';
import { apiRequest } from '../../lib/api';

export default function Revenue() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalBookings: 0, avgAmount: 0 });

  useEffect(() => {
    (async () => {
      const d = await apiRequest('/admin/revenue');
      if (!d || !d.success) return;
      const { summary: s, daily } = d.data;
      setSummary(s);

      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: daily.map((x) => x._id),
          datasets: [{
            label: 'Revenue (₹)',
            data: daily.map((x) => x.revenue),
            backgroundColor: 'rgba(0,136,255,0.5)',
            borderColor: '#0088ff',
            borderWidth: 2,
            borderRadius: 6,
            hoverBackgroundColor: 'rgba(0,245,255,0.6)',
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(6,13,26,0.95)',
              titleColor: '#00f5ff',
              bodyColor: '#e8f4ff',
              borderColor: 'rgba(0,245,255,0.2)',
              borderWidth: 1,
            },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,136,255,0.08)' }, ticks: { color: '#5a7a9a' } },
            x: { grid: { display: false }, ticks: { color: '#5a7a9a' } },
          },
        },
      });
    })();

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, []);

  return (
    <Layout title="Revenue Analytics" badge={false}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card green"><div className="stat-label">Total Revenue</div><div className="stat-value text-green">₹{(summary.totalRevenue || 0).toFixed(2)}</div></div>
        <div className="stat-card cyan"><div className="stat-label">Completed Bookings</div><div className="stat-value text-cyan">{summary.totalBookings}</div></div>
        <div className="stat-card orange"><div className="stat-label">Avg Booking Value</div><div className="stat-value text-orange">₹{(summary.avgAmount || 0).toFixed(2)}</div></div>
      </div>
      <div className="ag-card" style={{ padding: '1.5rem' }}>
        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: '0.75rem', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>DAILY REVENUE — LAST 30 DAYS</div>
        <canvas ref={canvasRef} height={80} />
      </div>
    </Layout>
  );
}
