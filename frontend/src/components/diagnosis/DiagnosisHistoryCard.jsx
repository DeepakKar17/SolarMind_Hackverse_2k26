import { Card, Badge, DataTable } from '../common';
import { History, CheckCircle, Clock } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

export const DiagnosisHistoryCard = ({ history = [], diagnosisId }) => {
  const columns = [
    {
      key: 'date',
      label: 'Timestamp',
      render: (val) => (
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={11} />
          {formatDateTime(val)}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Lifecycle Transition',
      render: (val) => <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>,
    },
    {
      key: 'actor',
      label: 'Triggered By / Evaluator',
      render: (val) => <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{val}</span>,
    },
    {
      key: 'note',
      label: 'Audit Notes & Observations',
      render: (val) => <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{val}</span>,
    },
  ];

  return (
    <Card
      title={`Diagnosis Incident Lifecycle & Audit Trail (${history.length})`}
      subtitle={`Sequential record of classification, operator reviews, and work order transitions for ${diagnosisId}`}
      style={{ padding: 0 }}
    >
      <DataTable
        columns={columns}
        data={history}
        keyField="date"
        emptyMessage="No historical lifecycle events recorded for this diagnosis."
      />
    </Card>
  );
};

export default DiagnosisHistoryCard;
