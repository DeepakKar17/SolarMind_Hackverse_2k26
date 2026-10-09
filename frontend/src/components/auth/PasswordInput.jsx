import { useState } from 'react';

export const PasswordInput = ({
  id,
  name = 'password',
  value,
  onChange,
  placeholder = '••••••••',
  label = 'Password',
  required = true,
  autoComplete = 'current-password',
  disabled = false,
  error,
  showStrengthMeter = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  // Compute password strength score (0-4)
  const getStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strength = getStrength(value);
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const strengthColors = ['#ef4444', '#f59e0b', '#eab308', '#10b981', '#059669'];

  return (
    <div className="sm-form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label htmlFor={id} className="sm-label" style={{ marginBottom: 'var(--space-1)' }}>
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`sm-input ${error ? 'sm-input--error' : ''}`}
          style={{ paddingRight: '40px' }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="sm-btn sm-btn--ghost"
          style={{
            position: 'absolute',
            right: '4px',
            height: '32px',
            width: '32px',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
          }}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={0}
        >
          {showPassword ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {showStrengthMeter && value && (
        <div style={{ marginTop: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: '4px', height: '4px', marginBottom: '4px' }}>
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                style={{
                  flex: 1,
                  borderRadius: '2px',
                  backgroundColor: step <= strength ? strengthColors[strength] : 'var(--color-bg-muted)',
                  transition: 'background-color 0.2s ease',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: strengthColors[strength] }}>
            {strengthLabels[strength]}
          </span>
        </div>
      )}

      {error && (
        <span id={`${id}-error`} className="sm-input-error-msg" role="alert" style={{ display: 'block', marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
};

export default PasswordInput;
