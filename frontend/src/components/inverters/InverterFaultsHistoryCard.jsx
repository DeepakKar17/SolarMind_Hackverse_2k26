import { Card, Badge, DataTable } from '../common';
import { AlertTriangle, History, ShieldAlert } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

export const InverterFaultsHistoryCard = ({ activeFaults = [], historicalFaults = [], inverterName }) => {
  const activeColumns = [
    {
      key: 'faultCode',
      label: 'Active Fault Code & Alarm',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-danger)' }}>{val}</strong>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
            {row.description}
          </p>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (val) => (
        <Badge variant={val === 'CRITICAL' ? 'danger' : 'warning'} dot>
          {val}
        </Badge>
      ),
    },
    {
      key: 'occurredAt',
      label: 'Detected',
      render: (val) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {formatRelativeTime(val)}
        </span>
      ),
    },
  ];

  const historyColumns = [
    {
      key: 'faultCode',
      label: 'Historical Fault Event',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
            {row.description}
          </p>
        </div>
      ),
    },
    {
      key: 'occurredAt',
      label: 'Occurred',
      render: (val) => <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatDateTime(val)}</span>,
    },
    {
      key: 'resolvedAt',
      label: 'Resolved Time',
      render: (val) => <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{val ? formatDateTime(val) : 'Auto-Cleared'}</span>,
    },
    {
      key: 'severity',
      label: 'Severity Level',
      render: (val) => <Badge variant="neutral" size="sm">{val}</Badge>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Active Fault Alarms */}
      <Card
        title={`Active Hardware Alarms (${activeFaults.length})`}
        subtitle={`Real-time diagnostic fault conditions flagged for ${inverterName}`}
        style={{ padding: 0 }}
      >
        <DataTable
          columns={activeColumns}
          data={activeFaults}
          keyField="id"
          emptyMessage="No active fault alarms detected on this inverter hardware."
        />
      </Card>

      {/* Historical Fault Audit Log */}
      {historicalFaults && historicalFaults.length > 0 && (
        <Card
          title={`Historical Fault Audit Log (${historicalFaults.length})`}
          subtitle="Past electrical trips, transient overvoltages, and grid disconnect events"
          style={{ padding: 0 }}
        >
          <DataTable
            columns={historyColumns}
            data={historicalFaults}
            keyField="id"
          />
        </Card>
      )}
    </div>
  );
};

export default InverterFaultsHistoryCard;
