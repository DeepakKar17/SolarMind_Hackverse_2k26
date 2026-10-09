import { Link } from 'react-router-dom';
import { Card, Badge, DataTable } from '../common';
import { AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { formatCurrency, formatEnergy, formatRelativeTime } from '../../utils/formatters';

export const PlantFaultsCard = ({ alerts = [], diagnoses = [], plantName }) => {
  const alertColumns = [
    {
      key: 'title',
      label: 'Fault Diagnostic & Anomaly',
      render: (val, row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
              {Math.round((row.confidence || 0.9) * 100)}% Conf
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
            {row.explanation}
          </p>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (val) => (
        <Badge
          variant={val === 'CRITICAL' ? 'danger' : val === 'WARNING' ? 'warning' : 'info'}
          dot
        >
          {val}
        </Badge>
      ),
    },
    {
      key: 'estimatedDailyLossKwh',
      label: 'Energy & Financial Loss',
      render: (val, row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
            -{formatEnergy(val)}
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {formatCurrency(row.estimatedFinancialLossInr || 0)}/day
          </span>
        </div>
      ),
    },
    {
      key: 'detectedAt',
      label: 'Detected',
      render: (val) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {formatRelativeTime(val)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Resolution',
      align: 'right',
      render: (_, row) => (
        <Link
          to={`/diagnosis/DIAG-${row.id.replace('ALT-', '40')}`}
          className="sm-btn sm-btn-outline sm-btn-sm"
          style={{ textDecoration: 'none' }}
        >
          <span>Root Cause</span>
          <ArrowRight size={13} />
        </Link>
      ),
    },
  ];

  return (
    <Card
      title={`Active Diagnoses & Fault Alarms (${alerts.length})`}
      subtitle={`AI-assisted fault identification and root cause analysis for ${plantName}`}
      style={{ padding: 0 }}
    >
      <DataTable
        columns={alertColumns}
        data={alerts}
        keyField="id"
        emptyMessage="No active fault anomalies detected for this plant. Operation is optimal."
      />
    </Card>
  );
};

export default PlantFaultsCard;
