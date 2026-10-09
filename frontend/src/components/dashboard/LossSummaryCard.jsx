import { AlertOctagon, DollarSign, BatteryWarning, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSolarData } from '../../hooks/useSolarData';
import { formatEnergy, formatCurrency, formatPercent } from '../../utils/formatters';

export const LossSummaryCard = () => {
  const { lossSummary } = useSolarData();

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
            }}
          >
            <AlertOctagon size={18} />
          </div>
          <h3 style={{ fontSize: 'var(--font-size-lg)' }}>Energy Loss Impact</h3>
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {lossSummary.period}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <div style={{ padding: 'var(--spacing-4)', borderRadius: 'var(--radius-lg)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
            <BatteryWarning size={14} />
            <span>Lost Generation</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            {formatEnergy(lossSummary.lostKwh)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
            {formatPercent(lossSummary.lossPercentage)} of expected
          </div>
        </div>

        <div style={{ padding: 'var(--spacing-4)', borderRadius: 'var(--radius-lg)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-solar-light)', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
            <DollarSign size={14} />
            <span>Monetary Deficit</span>
          </div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
            {formatCurrency(lossSummary.financialLoss, lossSummary.currency)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Tariff: $0.18 / kWh
          </div>
        </div>
      </div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-6)', flex: 1 }}>
        Partial shading in the early afternoon is the primary contributor (~62% of loss). Resolving obstructions can recover approximately $146/year.
      </p>

      <Link to="/diagnostics" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
        <span>View Diagnostic Guide</span>
        <ArrowRight size={16} />
      </Link>
    </div>
  );
};

export default LossSummaryCard;
