import { useParams, Link } from 'react-router-dom';
import { useSolarData } from '../hooks/useSolarData';
import { PageHeader, Card, StatCard, Badge, Button } from '../components/common';
import { Wrench, ArrowLeft, Calendar, User, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatEnergy } from '../utils/formatters';

export const WorkOrderDetailPage = () => {
  const { workOrderId } = useParams();
  const { workOrders } = useSolarData();

  const order = workOrders.find((w) => w.id === workOrderId) || workOrders[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title={`Work Order: ${order.id}`}
        subtitle={order.title}
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Work Orders', href: '/work-orders' },
          { label: order.id },
        ]}
        actions={
          <Link to="/work-orders" className="sm-btn sm-btn-outline sm-btn-sm" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={14} />
            <span>Back to Work Orders</span>
          </Link>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="Service Status"
          value={order.status}
          subtext="Target date confirmed"
          variant={order.status === 'COMPLETED' ? 'success' : 'primary'}
        />
        <StatCard
          title="Priority Level"
          value={order.priority}
          subtext="Criticality assessment"
          variant={order.priority === 'CRITICAL' ? 'danger' : 'warning'}
        />
        <StatCard
          title="Estimated Cost"
          value={formatCurrency(order.estimatedCostInr)}
          subtext="Includes service & cleaning"
          variant="info"
        />
        <StatCard
          title="Recoverable Yield"
          value={formatEnergy(order.expectedKwhRecovery)}
          subtext="Expected generation recovery"
          variant="success"
        />
      </div>

      <Card title="Technician Assignment & Action Checklist">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="var(--color-primary)" />
            <span>Assigned Field Service Team: <strong>{order.assignedTo}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--color-secondary)" />
            <span>Scheduled Execution Date: <strong>{order.scheduledDate}</strong></span>
          </div>
          <div style={{ backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <strong>Corrective Instructions & Diagnostic Notes:</strong>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {order.notes || 'Inspect array, perform demineralized water rinse, and confirm inverter string DC current recovery.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WorkOrderDetailPage;
