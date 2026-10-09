import { useState, useMemo } from 'react';
import {
  Card,
  Badge,
  Button,
  IconButton,
  DataTable,
  Pagination,
  SearchInput,
  useToast,
} from '../common';
import {
  AlertTriangle,
  Stethoscope,
  Wrench,
  CheckCircle,
  Eye,
  Plus,
} from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';
import {
  formatEnergy,
  formatCurrency,
  formatDateTime,
} from '../../utils/formatters';
import DiagnosisDrawer from './DiagnosisDrawer';
import WorkOrderModal from './WorkOrderModal';

export const TablesSection = () => {
  const {
    alerts,
    diagnoses,
    workOrders,
    resolveAlert,
    addWorkOrder,
  } = useSolarData();

  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('ALERTS'); // 'ALERTS' | 'DIAGNOSES' | 'WORK_ORDERS'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Modals & Drawer State
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false);
  const [isWorkOrderOpen, setIsWorkOrderOpen] = useState(false);

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      return (
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.faultCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.explanation?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [alerts, searchQuery]);

  // Filtered Diagnoses
  const filteredDiagnoses = useMemo(() => {
    return diagnoses.filter((item) => {
      return (
        item.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.faultClass?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.rootCauseSummary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [diagnoses, searchQuery]);

  // Filtered Work Orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((item) => {
      return (
        item.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assignedTo?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [workOrders, searchQuery]);

  // Current Paginated Data
  const currentDataset =
    activeTab === 'ALERTS'
      ? filteredAlerts
      : activeTab === 'DIAGNOSES'
      ? filteredDiagnoses
      : filteredWorkOrders;

  const totalPages = Math.ceil(currentDataset.length / pageSize) || 1;
  const paginatedData = currentDataset.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Column Definitions
  const alertColumns = [
    {
      key: 'severity',
      label: 'Severity',
      width: '120px',
      render: (val) => (
        <Badge
          variant={
            val === 'CRITICAL' ? 'danger' : val === 'WARNING' ? 'warning' : 'info'
          }
          dot
        >
          {val}
        </Badge>
      ),
    },
    {
      key: 'title',
      label: 'Alert Description & Root Cause',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)', display: 'block' }}>{val}</strong>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.explanation}</span>
        </div>
      ),
    },
    {
      key: 'detectedAt',
      label: 'Detected',
      width: '150px',
      render: (val) => formatDateTime(val),
    },
    {
      key: 'loss',
      label: 'Est. Daily Loss',
      width: '160px',
      render: (_, row) => (
        <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
          -{formatEnergy(row.estimatedDailyLossKwh)} ({formatCurrency(row.estimatedFinancialLossInr)})
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Action',
      width: '140px',
      align: 'right',
      render: (val, row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
          {val === 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              icon={CheckCircle}
              onClick={() => {
                resolveAlert(row.id);
                addToast({ title: 'Alert Resolved', message: `${row.title} marked as resolved.`, variant: 'success' });
              }}
            >
              Resolve
            </Button>
          ) : (
            <Badge variant="success">Resolved</Badge>
          )}
        </div>
      ),
    },
  ];

  const diagnosisColumns = [
    {
      key: 'id',
      label: 'Diagnosis ID',
      width: '120px',
      render: (val) => <strong style={{ color: 'var(--color-primary)' }}>{val}</strong>,
    },
    {
      key: 'faultClass',
      label: 'Classified Anomaly',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{val.replace(/_/g, ' ')}</strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {row.rootCauseSummary}
          </span>
        </div>
      ),
    },
    {
      key: 'confidenceScore',
      label: 'AI Confidence',
      width: '130px',
      render: (val) => (
        <Badge variant={val > 85 ? 'success' : 'warning'}>
          {val}% Match
        </Badge>
      ),
    },
    {
      key: 'timestamp',
      label: 'Evaluated Time',
      width: '160px',
      render: (val) => formatDateTime(val),
    },
    {
      key: 'actions',
      label: 'Details',
      width: '100px',
      align: 'right',
      render: (_, row) => (
        <IconButton
          icon={Eye}
          size="sm"
          ariaLabel="View diagnosis report"
          onClick={() => {
            setSelectedDiagnosis(row);
            setIsDiagnosisOpen(true);
          }}
        />
      ),
    },
  ];

  const workOrderColumns = [
    {
      key: 'id',
      label: 'Work Order #',
      width: '120px',
      render: (val) => <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>,
    },
    {
      key: 'title',
      label: 'Task & Corrective Instructions',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Assigned: {row.assignedTo} (Sched: {row.scheduledDate})
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      width: '110px',
      render: (val) => (
        <Badge variant={val === 'CRITICAL' ? 'danger' : val === 'HIGH' ? 'warning' : 'info'}>
          {val}
        </Badge>
      ),
    },
    {
      key: 'estimatedCostInr',
      label: 'Cost Estimate',
      width: '130px',
      render: (val) => formatCurrency(val),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (val) => (
        <Badge variant={val === 'OPEN' || val === 'SCHEDULED' ? 'primary' : 'success'} dot>
          {val}
        </Badge>
      ),
    },
  ];

  return (
    <section>
      <Card style={{ padding: 0 }}>
        {/* Tab Navigation Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
        >
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant={activeTab === 'ALERTS' ? 'primary' : 'ghost'}
              size="sm"
              icon={AlertTriangle}
              onClick={() => {
                setActiveTab('ALERTS');
                setCurrentPage(1);
              }}
            >
              Recent Alerts ({alerts.filter((a) => a.status === 'ACTIVE').length})
            </Button>
            <Button
              variant={activeTab === 'DIAGNOSES' ? 'primary' : 'ghost'}
              size="sm"
              icon={Stethoscope}
              onClick={() => {
                setActiveTab('DIAGNOSES');
                setCurrentPage(1);
              }}
            >
              Recent Diagnoses ({diagnoses.length})
            </Button>
            <Button
              variant={activeTab === 'WORK_ORDERS' ? 'primary' : 'ghost'}
              size="sm"
              icon={Wrench}
              onClick={() => {
                setActiveTab('WORK_ORDERS');
                setCurrentPage(1);
              }}
            >
              Work Orders ({workOrders.length})
            </Button>
          </div>

          {/* Search, Filter & Quick Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: '220px' }}>
              <SearchInput
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onClear={() => setSearchQuery('')}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
              />
            </div>

            {activeTab === 'WORK_ORDERS' && (
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setSelectedDiagnosis(null);
                  setIsWorkOrderOpen(true);
                }}
              >
                New Work Order
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Table Body */}
        <DataTable
          columns={
            activeTab === 'ALERTS'
              ? alertColumns
              : activeTab === 'DIAGNOSES'
              ? diagnosisColumns
              : workOrderColumns
          }
          data={paginatedData}
          keyField="id"
          emptyMessage={`No ${activeTab.toLowerCase().replace('_', ' ')} matching the current filters.`}
        />

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={currentDataset.length}
          onPageChange={(p) => setCurrentPage(p)}
        />
      </Card>

      {/* Diagnosis Report Drawer */}
      <DiagnosisDrawer
        isOpen={isDiagnosisOpen}
        onClose={() => setIsDiagnosisOpen(false)}
        diagnosis={selectedDiagnosis}
        onOpenWorkOrder={(diag) => {
          setSelectedDiagnosis(diag);
          setIsWorkOrderOpen(true);
        }}
      />

      {/* Work Order Schedule Modal */}
      <WorkOrderModal
        isOpen={isWorkOrderOpen}
        onClose={() => setIsWorkOrderOpen(false)}
        diagnosis={selectedDiagnosis}
        onSubmit={(order) => {
          addWorkOrder(order);
          addToast({
            title: 'Work Order Created',
            message: `Work Order #${order.title} successfully scheduled.`,
            variant: 'success',
          });
        }}
      />
    </section>
  );
};

export default TablesSection;
