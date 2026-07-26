// ─── Shared formatting helpers (mirrors js/app.js) ─────────────────

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CLASS_MAP = {
  Available: 'available',
  Booked: 'booked',
  Occupied: 'occupied',
  Active: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Maintenance: 'maintenance',
};

export function statusClass(status) {
  return STATUS_CLASS_MAP[status] || 'cancelled';
}

export const ROLE_HOME = {
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
  user: '/user/dashboard',
};

export function homeForRole(role) {
  return ROLE_HOME[role] || '/login';
}
