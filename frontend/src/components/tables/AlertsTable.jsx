import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Badge, Button, Card } from '../common';
import { useSolarData } from '../../hooks/useSolarData';
import { formatPower, formatEnergy, formatCurrency, formatDateTime } from '../../utils/formatters';

export const AlertsTable = ({ showAll = false }) => {
  const { alerts, resolveAlert } = useSolarData();
  const displayAlerts = showAll ? alerts : alerts.filter((a) => a.status === 'ACTIVE');

  if (displayAlerts.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-secondary-light)',
            color: 'var(--color-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-3)',
          }}
        >
          <CheckCircle2 size={24} />
        </div>
        <h4 style={{ marginBottom: '4px' }}>All Systems Operating Normally</h4>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          No active single-string anomalies or faults detected in the current telemetry window.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Active Fault Diagnostic Alerts"
      subtitle={`${displayAlerts.length} anomaly detected`}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-warning)' }}>
          <AlertTriangle size={16} />
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              backgroundColor: 'var(--color-bg-canvas)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Badge
                  variant={
                    alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'WARNING' ? 'warning' : 'info'
                  }
                  dot
                >
                  {alert.faultCategory.replace(/_/g, ' ')}
                </Badge>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Detected: {formatDateTime(alert.detectedAt)} ({(alert.confidence * 100).toFixed(0)}% confidence)
                </span>
              </div>

              {alert.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resolveAlert(alert.id)}
                  icon={CheckCircle2}
                >
                  Mark Resolved
                </Button>
              )}
            </div>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
              {alert.explanation}
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: 'var(--color-bg-subtle)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                Power Deficit: -{formatPower(alert.estimatedPowerLossKw)}
              </span>
              <span style={{ color: 'var(--color-warning-text)', fontWeight: 600 }}>
                Est. Daily Loss: {formatEnergy(alert.estimatedDailyLossKwh)} ({formatCurrency(alert.estimatedFinancialLossInr || alert.estimatedFinancialLoss)})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              <Info size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-primary)' }} />
              <span><strong>Actionable Guidance:</strong> {alert.recommendedAction}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default AlertsTable;
