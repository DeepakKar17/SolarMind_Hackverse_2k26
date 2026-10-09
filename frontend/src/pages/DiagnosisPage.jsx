import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Badge, DataTable, Button, IconButton, LoadingState, ErrorState, EmptyState, Pagination, StatCard, Modal } from '../components/common';
import { Stethoscope, Eye, AlertTriangle, Sparkles, Wrench, ShieldAlert, Zap, TrendingDown, HelpCircle } from 'lucide-react';
import { formatDateTime, formatEnergy, formatCurrency } from '../utils/formatters';
import { diagnosisService, DIAGNOSIS_ENGINE_TYPES } from '../services/diagnosisService';
import DiagnosisEngineBadge from '../components/diagnosis/DiagnosisEngineBadge';
import DiagnosisFilterBar from '../components/diagnosis/DiagnosisFilterBar';
import AnalysisRunModal from '../components/diagnosis/AnalysisRunModal';
import WorkOrderModal from '../components/dashboard/WorkOrderModal';
import GuidedTroubleshootingAssistant from '../components/diagnosis/GuidedTroubleshootingAssistant';
import { useSolarData } from '../hooks/useSolarData';

export const DiagnosisPage = () => {
  const { addWorkOrder } = useSolarData();

  // State Management
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalCount: 0, totalPages: 1 });

  // Filter State
  const [filters, setFilters] = useState({
    search: '',
    plantId: 'ALL',
    severity: 'ALL',
    category: 'ALL',
    status: 'ALL',
    sortBy: 'date',
    sortOrder: 'desc',
    page: 1,
  });

  // Modals & Drawers
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [selectedDiagnosisForWO, setSelectedDiagnosisForWO] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Fetch diagnoses
  const loadDiagnoses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await diagnosisService.getDiagnoses(filters);
      setDiagnoses(data.items);
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        totalCount: data.totalCount,
        totalPages: data.totalPages,
      });
    } catch (err) {
      setError(err.message || 'Failed to load diagnosis telemetry.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDiagnoses();
  }, [loadDiagnoses]);

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      plantId: 'ALL',
      severity: 'ALL',
      category: 'ALL',
      status: 'ALL',
      sortBy: 'date',
      sortOrder: 'desc',
      page: 1,
    });
  };

  // Handle AI Scan completion
  const handleScanComplete = async (params) => {
    const result = await diagnosisService.runAnalysis(params);
    setActionFeedback(`Diagnostic scan completed for ${result.plantName}. New diagnosis record generated: ${result.id}`);
    loadDiagnoses();
    setTimeout(() => setActionFeedback(null), 6000);
  };

  // Handle Work Order creation
  const handleOpenWorkOrder = (diagnosis) => {
    setSelectedDiagnosisForWO(diagnosis);
    setIsWorkOrderModalOpen(true);
  };

  const handleCreateWorkOrder = async (workOrderData) => {
    if (selectedDiagnosisForWO) {
      const created = addWorkOrder({
        ...workOrderData,
        diagnosisId: selectedDiagnosisForWO.id,
        plantId: selectedDiagnosisForWO.plantId,
      });
      await diagnosisService.linkWorkOrder(selectedDiagnosisForWO.id, created.id);
      setActionFeedback(`Work order ${created.id} successfully created and linked to diagnosis ${selectedDiagnosisForWO.id}.`);
      loadDiagnoses();
      setTimeout(() => setActionFeedback(null), 6000);
    }
    setIsWorkOrderModalOpen(false);
  };

  // Compute fleet KPI summary
  const totalActive = diagnoses.filter((d) => d.status === 'ACTIVE').length;
  const totalSuspicions = diagnoses.filter((d) => d.isSuspicionOnly || d.hasInsufficientEvidence).length;
  const totalDailyLossKwh = diagnoses.reduce((acc, d) => acc + (d.estimatedLostEnergyKwh || 0), 0);
  const totalDailyLossInr = diagnoses.reduce((acc, d) => acc + (d.financialDeficitInr || 0), 0);

  // Table Columns Definition
  const columns = [
    {
      key: 'id',
      label: 'Diagnosis ID',
      render: (val, row) => (
        <div>
          <Link
            to={`/diagnosis/${val}`}
            style={{
              fontWeight: 700,
              color: 'var(--color-primary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{val}</span>
          </Link>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {formatDateTime(row.timestamp)}
          </span>
        </div>
      ),
    },
    {
      key: 'plantName',
      label: 'Plant & Inverter',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>{val}</strong>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
            <Badge variant="outline" style={{ fontSize: '10px', padding: '1px 5px' }}>{row.inverterId}</Badge>
            {row.affectedString ? (
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {row.affectedString}
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                String unknown
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'faultClass',
      label: 'Fault Classification',
      render: (val, row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong style={{ color: 'var(--color-text-primary)', fontSize: '13px' }}>
              {row.faultTitle || val.replace(/_/g, ' ')}
            </strong>
          </div>
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: '11px',
              color: 'var(--color-text-secondary)',
              marginTop: '2px',
              maxWidth: '300px',
            }}
          >
            {row.probableCause}
          </span>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (val) => {
        const variant = val === 'CRITICAL' ? 'danger' : val === 'WARNING' ? 'warning' : 'info';
        return <Badge variant={variant} dot>{val}</Badge>;
      },
    },
    {
      key: 'engineType',
      label: 'Diagnostic Engine & Score',
      render: (_, row) => (
        <DiagnosisEngineBadge
          engineType={row.engineType}
          confidenceScore={row.confidenceScore}
          confidenceTier={row.confidenceTier}
          isSuspicionOnly={row.isSuspicionOnly}
          hasInsufficientEvidence={row.hasInsufficientEvidence}
        />
      ),
    },
    {
      key: 'impact',
      label: 'Est. Energy / Financial Loss',
      render: (_, row) => {
        if (row.hasInsufficientEvidence || row.estimatedLostEnergyKwh === null) {
          return (
            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              Pending telemetry
            </span>
          );
        }
        return (
          <div>
            <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '12px' }}>
              -{formatEnergy(row.estimatedLostEnergyKwh)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              {formatCurrency(row.financialDeficitInr)} / day
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => {
        const variant = val === 'ACTIVE' ? 'warning' : val === 'INVESTIGATING' ? 'info' : val === 'RESOLVED' ? 'success' : 'default';
        return (
          <div>
            <Badge variant={variant} dot>{val}</Badge>
            {row.workOrderId && (
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-primary)', marginTop: '2px' }}>
                WO: {row.workOrderId}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <Link
            to={`/diagnosis/${row.id}`}
            className="sm-btn sm-btn-outline sm-btn-sm"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Inspect full diagnostic telemetry dossier"
          >
            <Eye size={13} />
            <span>Dossier</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenWorkOrder(row)}
            title="Dispatch Work Order"
            style={{ padding: '4px 8px' }}
          >
            <Wrench size={13} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="AI Fault Diagnosis Engine"
        subtitle="Physics-informed clear-sky deviation analysis, electrical signature isolation, and energy loss quantification."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Fault Diagnoses' },
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              size="sm"
              icon={HelpCircle}
              onClick={() => setIsAssistantOpen(true)}
            >
              <span>Troubleshooting Assistant</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAnalysisModalOpen(true)}
            >
              <Sparkles size={14} />
              <span>Run AI Diagnostic Scan</span>
            </Button>
          </div>
        }
      />

      {/* Action Notification Toast Banner */}
      {actionFeedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Sparkles size={16} />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Diagnostic Fleet Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="Active System Anomalies"
          value={totalActive}
          subtext="Unresolved single-string faults"
          icon={AlertTriangle}
          variant={totalActive > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title="Suspicion / Low Evidence Flags"
          value={totalSuspicions}
          subtext="Inconclusive or heuristic checks"
          icon={HelpCircle}
          variant={totalSuspicions > 0 ? 'info' : 'default'}
        />
        <StatCard
          title="Total Daily Yield Deficit"
          value={`-${formatEnergy(totalDailyLossKwh)}`}
          subtext="Estimated physics clear-sky loss"
          icon={Zap}
          variant="danger"
        />
        <StatCard
          title="Projected Daily Financial Deficit"
          value={formatCurrency(totalDailyLossInr)}
          subtext="Aggregated plant feed-in tariff loss"
          icon={TrendingDown}
          variant="danger"
        />
      </div>

      {/* Diagnosis Filter Bar */}
      <DiagnosisFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        onOpenAnalyzeModal={() => setIsAnalysisModalOpen(true)}
      />

      {/* Main Diagnosis Telemetry Data Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingState message="Evaluating electrical telemetry signatures and AI classification models..." />
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <ErrorState
              title="Failed to Load Fault Diagnoses"
              message={error}
              onRetry={loadDiagnoses}
            />
          </div>
        ) : diagnoses.length === 0 ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <EmptyState
              icon={Stethoscope}
              title="No Fault Diagnoses Found"
              description="No anomaly records match the active filter criteria or your solar fleet is operating at peak clear-sky efficiency."
              action={
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Clear All Filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={diagnoses}
              keyField="id"
            />
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Showing {diagnoses.length} of {pagination.totalCount} evaluated anomaly records
              </span>
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
              />
            </div>
          </>
        )}
      </Card>

      {/* Diagnostic Scan Modal */}
      <AnalysisRunModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onScanComplete={handleScanComplete}
      />

      {/* Work Order Dispatch Modal */}
      <WorkOrderModal
        isOpen={isWorkOrderModalOpen}
        onClose={() => setIsWorkOrderModalOpen(false)}
        diagnosis={selectedDiagnosisForWO}
        onSubmit={handleCreateWorkOrder}
      />

      {/* Guided Troubleshooting Assistant Modal */}
      {isAssistantOpen && (
        <Modal
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          title="Interactive Root-Cause Diagnostic Assistant"
          size="lg"
        >
          <GuidedTroubleshootingAssistant
            onClose={() => setIsAssistantOpen(false)}
            onOpenWorkOrder={(order) => {
              setIsAssistantOpen(false);
              setSelectedDiagnosisForWO({
                id: 'DIAG-402',
                faultClass: 'SOILING_ACCUMULATION',
                severity: 'WARNING',
                plantId: 1,
                inverterId: 'INV-101',
              });
              setIsWorkOrderModalOpen(true);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default DiagnosisPage;
