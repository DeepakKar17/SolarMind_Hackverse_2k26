import { useId } from 'react';

export const Textarea = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  rows = 3,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const textareaId = id || generatedId;

  return (
    <div className={`sm-form-group ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="sm-label">
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        rows={rows}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        className={`sm-input-control ${error ? 'sm-input-error' : ''}`}
        style={{ resize: 'vertical' }}
        {...props}
      />

      {error && (
        <span id={`${textareaId}-error`} className="sm-error-text" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${textareaId}-helper`} className="sm-helper-text">
          {helperText}
        </span>
      )}
    </div>
  );
};

export default Textarea;
