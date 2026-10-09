import { Calendar } from 'lucide-react';
import Button from './Button';

export const DateRangeFilter = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onPresetSelect,
  activePreset = '30D',
  className = '',
}) => {
  const presets = [
    { label: 'Today', value: 'TODAY' },
    { label: '7D', value: '7D' },
    { label: '30D', value: '30D' },
    { label: 'YTD', value: 'YTD' },
  ];

  return (
    <div
      className={`sm-card ${className}`}
      style={{
        padding: 'var(--space-2) var(--space-3)',
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        {presets.map((p) => (
          <Button
            key={p.value}
            variant={activePreset === p.value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onPresetSelect && onPresetSelect(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
        <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="date"
          value={startDate || ''}
          onChange={(e) => onStartChange && onStartChange(e.target.value)}
          aria-label="Start date"
          className="sm-input-control"
          style={{ padding: '2px 6px', fontSize: 'var(--font-size-xs)', height: '28px', width: 'auto' }}
        />
        <span style={{ color: 'var(--color-text-muted)' }}>to</span>
        <input
          type="date"
          value={endDate || ''}
          onChange={(e) => onEndChange && onEndChange(e.target.value)}
          aria-label="End date"
          className="sm-input-control"
          style={{ padding: '2px 6px', fontSize: 'var(--font-size-xs)', height: '28px', width: 'auto' }}
        />
      </div>
    </div>
  );
};

export default DateRangeFilter;
