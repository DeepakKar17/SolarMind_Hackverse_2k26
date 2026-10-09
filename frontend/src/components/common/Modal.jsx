import { useEffect } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';

export const Modal = ({
  isOpen = false,
  onClose,
  title,
  children,
  footer,
  maxWidth = '540px',
  closeOnBackdrop = true,
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
    <div
      className="sm-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={`sm-modal-container ${className}`}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sm-card-header">
            <h3 id="modal-title" style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
              {title}
            </h3>
            {onClose && (
              <IconButton icon={X} size="sm" onClick={onClose} ariaLabel="Close modal" />
            )}
          </div>
        )}

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

export default Modal;
