import { useId } from 'react';

export const Select = ({
  label,
  options = [],
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  id,
  value,
  onChange,
  placeholder,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={`sm-form-group ${className}`}>
      {label && (
        <label htmlFor={selectId} className="sm-label">
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}

      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        className={`sm-input-control ${error ? 'sm-input-error' : ''}`}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && (
        <span id={`${selectId}-error`} className="sm-error-text" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${selectId}-helper`} className="sm-helper-text">
          {helperText}
        </span>
      )}
    </div>
  );
};

export default Select;
