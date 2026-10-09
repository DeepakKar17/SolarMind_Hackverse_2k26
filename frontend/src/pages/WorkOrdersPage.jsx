import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSolarData } from '../hooks/useSolarData';
import { PageHeader, Card, Badge, DataTable, Button, IconButton } from '../components/common';
import { Wrench, Plus, Eye, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatEnergy } from '../utils/formatters';
import WorkOrderModal from '../components/dashboard/WorkOrderModal';

export const WorkOrdersPage = () => {
  const { workOrders, addWorkOrder } = useSolarData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns = [
    {
      key: 'id',
      label: 'Work Order #',
      render: (val) => <strong style={{ color: 'var(--color-primary)' }}>{val}</strong>,
    },
    {
      key: 'title',
      label: 'Corrective Task',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Assigned: {row.assignedTo}
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (val) => (
        <Badge variant={val === 'CRITICAL' ? 'danger' : val === 'HIGH' ? 'warning' : 'info'}>
          {val}
        </Badge>
      ),
    },
    {
      key: 'scheduledDate',
      label: 'Target Date',
    },
    {
      key: 'estimatedCostInr',
      label: 'Cost Estimate',
      render: (val) => formatCurrency(val),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant={val === 'OPEN' || val === 'SCHEDULED' ? 'primary' : 'success'} dot>
          {val}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Details',
      align: 'right',
      render: (_, row) => (
        <Link
          to={`/work-orders/${row.id}`}
          className="sm-btn sm-btn-outline sm-btn-sm"
          style={{ textDecoration: 'none' }}
        >
          <Eye size={14} />
          <span>View</span>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Maintenance Work Orders"
        subtitle="Manage panel washing schedules, tree trimming, and inverter service dispatch tickets."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Work Orders' },
        ]}
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsModalOpen(true)}>
            New Work Order
          </Button>
        }
      />

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} data={workOrders} keyField="id" />
      </Card>

      <WorkOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={addWorkOrder}
      />
    </div>
  );
};

export default WorkOrdersPage;
