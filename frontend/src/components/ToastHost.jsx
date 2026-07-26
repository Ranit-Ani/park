import { useEffect, useState } from 'react';
import { onToast } from '../lib/toast';

const ICONS = {
  success: 'bi-check-circle-fill',
  danger: 'bi-exclamation-triangle-fill',
  warning: 'bi-exclamation-circle-fill',
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return onToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    });
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 99998, display: 'flex', flexDirection: 'column', gap: '.5rem', padding: '1rem' }}>
      {toasts.map((t) => (
        <div key={t.id} className={`ag-toast ${t.type}`}>
          <i className={`bi ${ICONS[t.type] || ICONS.success}`} /> {t.message}
        </div>
      ))}
    </div>
  );
}
