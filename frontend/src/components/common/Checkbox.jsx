import { useId } from 'react';

export const Checkbox = ({
  label,
  checked = false,
  onChange,
  disabled = false,
  error,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  return (
    <div className={`sm-form-group ${className}`}>
      <label htmlFor={checkboxId} className="sm-checkbox-label">
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sm-checkbox-input"
          aria-invalid={Boolean(error)}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && <span className="sm-error-text">{error}</span>}
    </div>
  );
};

export default Checkbox;
