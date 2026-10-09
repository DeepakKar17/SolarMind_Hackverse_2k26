import { useId } from 'react';

export const Input = ({
  label,
  error,
  helperText,
  icon: Icon,
  required = false,
  disabled = false,
  type = 'text',
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`sm-form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="sm-label">
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {Icon && (
          <div style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            <Icon size={16} />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`sm-input-control ${error ? 'sm-input-error' : ''}`}
          style={Icon ? { paddingLeft: '34px' } : undefined}
          {...props}
        />
      </div>

      {error && (
        <span id={`${inputId}-error`} className="sm-error-text" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${inputId}-helper`} className="sm-helper-text">
          {helperText}
        </span>
      )}
    </div>
  );
};

export default Input;
