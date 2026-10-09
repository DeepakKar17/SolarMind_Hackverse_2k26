import { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastContext } from './toastContextDef';
export { useToast } from './useToast';

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, message, variant = 'info', duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, title, message, variant }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          maxWidth: '380px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const ToastItem = ({ toast, onClose }) => {
  const { title, message, variant = 'info' } = toast;

  const getIcon = () => {
    switch (variant) {
      case 'success': return <CheckCircle2 size={18} color="var(--color-secondary)" />;
      case 'warning': return <AlertTriangle size={18} color="var(--color-warning)" />;
      case 'danger':
      case 'error': return <AlertCircle size={18} color="var(--color-danger)" />;
      case 'info':
      default: return <Info size={18} color="var(--color-primary)" />;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'success': return 'var(--color-secondary)';
      case 'warning': return 'var(--color-warning)';
      case 'danger':
      case 'error': return 'var(--color-danger)';
      case 'info':
      default: return 'var(--color-primary)';
    }
  };

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        backgroundColor: 'var(--color-bg-surface)',
        borderLeft: `4px solid ${getBorderColor()}`,
        borderTop: '1px solid var(--color-border)',
        borderRight: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        animation: 'slideLeft 200ms ease-out',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
            {title}
          </h4>
        )}
        {message && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>
            {message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss toast"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: '2px',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ToastProvider;
