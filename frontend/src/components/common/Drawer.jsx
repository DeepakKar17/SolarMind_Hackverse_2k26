import { useEffect } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export const Drawer = ({
  isOpen = false,
  onClose,
  title,
  children,
  footer,
  width = '420px',
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sm-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`sm-drawer-container ${className}`}
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm-card-header">
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
            {title}
          </h3>
          {onClose && (
            <IconButton icon={X} size="sm" onClick={onClose} ariaLabel="Close drawer" />
          )}
        </div>

        <div style={{ padding: 'var(--space-5)', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {footer && (
          <div className="sm-card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drawer;
