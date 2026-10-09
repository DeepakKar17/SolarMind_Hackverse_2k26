import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PageHeader, Card, StatCard, Badge, Button, Select, LoadingState, ErrorState, EmptyState } from '../components/common';
import {
  Stethoscope,
  ArrowLeft,
  Wrench,
  AlertTriangle,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle,
  Activity,
  Cpu,
  Brain,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { formatDateTime, formatEnergy, formatCurrency } from '../utils/formatters';
import { diagnosisService, DIAGNOSIS_ENGINE_TYPES } from '../services/diagnosisService';
import DiagnosisEngineBadge from '../components/diagnosis/DiagnosisEngineBadge';
import DiagnosisEvidenceCard from '../components/diagnosis/DiagnosisEvidenceCard';
import DiagnosisImpactCard from '../components/diagnosis/DiagnosisImpactCard';
import DiagnosisTelemetryTimeline from '../components/diagnosis/DiagnosisTelemetryTimeline';
import DiagnosisInspectionChecklist from '../components/diagnosis/DiagnosisInspectionChecklist';
import DiagnosisHistoryCard from '../components/diagnosis/DiagnosisHistoryCard';
import AnalysisRunModal from '../components/diagnosis/AnalysisRunModal';
import WorkOrderModal from '../components/dashboard/WorkOrderModal';
import { useSolarData } from '../hooks/useSolarData';

export const DiagnosisDetailPage = () => {
  const { diagnosisId } = useParams();
  const navigate = useNavigate();
  const { addWorkOrder } = useSolarData();

  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Action States
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Load diagnosis record
  const loadDiagnosis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await diagnosisService.getDiagnosisById(diagnosisId);
      setDiagnosis(data);
    } catch (err) {
      setError(err.message || `Failed to load diagnosis record ${diagnosisId}`);
    } finally {
      setLoading(false);
    }
  }, [diagnosisId]);

  useEffect(() => {
    loadDiagnosis();
  }, [loadDiagnosis]);

  // Status transition handler
  const handleStatusChange = async (newStatus) => {
    if (!diagnosis) return;
    try {
      setUpdatingStatus(true);
      const updated = await diagnosisService.updateDiagnosisStatus(diagnosis.id, newStatus, {
        actor: 'Current Operator',
        note: `Manual status transition to ${newStatus}.`,
      });
      setDiagnosis({ ...updated });
      setActionFeedback(`Diagnosis status updated to ${newStatus}.`);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err) {
      setActionFeedback(`Error updating status: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Re-run scan handler
  const handleScanComplete = async (params) => {
    const result = await diagnosisService.runAnalysis(params);
    setActionFeedback(`Re-analysis complete. Created linked evaluation ${result.id}.`);
    setTimeout(() => setActionFeedback(null), 6000);
  };

  // Create Work Order handler
  const handleCreateWorkOrder = async (workOrderData) => {
    if (diagnosis) {
      const created = addWorkOrder({
        ...workOrderData,
        diagnosisId: diagnosis.id,
        plantId: diagnosis.plantId,
      });
      const updated = await diagnosisService.linkWorkOrder(diagnosis.id, created.id);
      setDiagnosis({ ...updated });
      setActionFeedback(`Work order ${created.id} created and linked to diagnosis ${diagnosis.id}.`);
      setTimeout(() => setActionFeedback(null), 6000);
    }
    setIsWorkOrderModalOpen(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-12)' }}>
        <LoadingState message={`Retrieving diagnostic signatures and physical model comparisons for ${diagnosisId}...`} />
      </div>
    );
  }

  if (error || !diagnosis) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Diagnosis Not Found"
          breadcrumbs={[
            { label: 'Platform', href: '/dashboard' },
            { label: 'Diagnoses', href: '/diagnosis' },
            { label: diagnosisId || 'Detail' },
          ]}
          actions={
            <Link to="/diagnosis" className="sm-btn sm-btn-outline sm-btn-sm" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={14} />
              <span>Back to Fault Diagnoses</span>
            </Link>
          }
        />
        <ErrorState
          title="Diagnosis Record Error"
          message={error || `Diagnosis ID ${diagnosisId} does not exist.`}
          onRetry={loadDiagnosis}
        />
      </div>
    );
  }

  const severityVariant = diagnosis.severity === 'CRITICAL' ? 'danger' : diagnosis.severity === 'WARNING' ? 'warning' : 'info';
  const statusVariant = diagnosis.status === 'ACTIVE' ? 'warning' : diagnosis.status === 'INVESTIGATING' ? 'info' : diagnosis.status === 'RESOLVED' ? 'success' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Page Header & Navigation */}
      <PageHeader
        title={`Fault Diagnosis Dossier: ${diagnosis.id}`}
        subtitle={`${diagnosis.plantName} | Inverter ${diagnosis.inverterId} | Evaluated ${formatDateTime(diagnosis.timestamp)}`}
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Fault Diagnoses', href: '/diagnosis' },
          { label: diagnosis.id },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Link to="/diagnosis" className="sm-btn sm-btn-outline sm-btn-sm" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={14} />
              <span>Back to List</span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAnalysisModalOpen(true)}
            >
              <Sparkles size={14} />
              <span>Re-Analyze Incident</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsWorkOrderModalOpen(true)}
            >
              <Wrench size={14} />
              <span>Dispatch Work Order</span>
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

      {/* Incident Header Summary Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '650px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <Badge variant={severityVariant} dot>{diagnosis.severity}</Badge>
              <DiagnosisEngineBadge
                engineType={diagnosis.engineType}
                confidenceScore={diagnosis.confidenceScore}
                confidenceTier={diagnosis.confidenceTier}
                isSuspicionOnly={diagnosis.isSuspicionOnly}
                hasInsufficientEvidence={diagnosis.hasInsufficientEvidence}
                size="md"
              />
              <Badge variant={statusVariant} dot>{diagnosis.status}</Badge>
            </div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              {diagnosis.faultTitle || diagnosis.faultClass.replace(/_/g, ' ')}
            </h2>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <span><strong>Plant:</strong> {diagnosis.plantName}</span>
              <span><strong>Inverter:</strong> {diagnosis.inverterId}</span>
              <span><strong>Affected String:</strong> {diagnosis.affectedString || 'Unknown / Not Isolated'}</span>
            </div>
          </div>

          {/* Status Changer Control */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: '180px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Manage Anomaly Status
            </label>
            <Select
              value={diagnosis.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
              options={[
                { value: 'ACTIVE', label: 'Active Anomaly' },
                { value: 'INVESTIGATING', label: 'Under Investigation' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'DISMISSED', label: 'Dismissed / False Positive' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Confidence & Rule Interpretation Guide */}
      <Card title="Confidence & Diagnostic Methodology Interpretation">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          {diagnosis.engineType === DIAGNOSIS_ENGINE_TYPES.DETERMINISTIC_RULE ? (
            <>
              <Cpu size={22} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-text-primary)', display: 'block', fontSize: 'var(--font-size-sm)' }}>
                  Deterministic Hard-Coded Electrical Rule Check
                </strong>
                This anomaly was isolated using strict electrical code and threshold logic (e.g. IEEE 1547 / CEA grid anti-islanding parameters). Because it represents an exact rule breach rather than an empirical statistical estimate, no probabilistic confidence score is assigned.
              </div>
            </>
          ) : diagnosis.isSuspicionOnly || diagnosis.hasInsufficientEvidence ? (
            <>
              <HelpCircle size={22} style={{ color: 'var(--color-warning-text)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-warning-text)', display: 'block', fontSize: 'var(--font-size-sm)' }}>
                  Physical Heuristic Suspicion (Unconfirmed)
                </strong>
                Evidence collected indicates a potential anomaly pattern, but current telemetry resolution or sensor calibration does not meet the threshold for definitive confirmation. Do not treat this diagnosis as confirmed without on-site measurement.
              </div>
            </>
          ) : (
            <>
              <Brain size={22} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-success)', display: 'block', fontSize: 'var(--font-size-sm)' }}>
                  Supervised Machine Learning Anomaly Classifier ({diagnosis.confidenceScore}% Match)
                </strong>
                The physical sensor signature matches historical training distributions for {diagnosis.faultClass.replace(/_/g, ' ')} with high statistical confidence ({diagnosis.confidenceScore}% match against clear-sky physical baseline).
              </div>
            </>
          )}
        </div>
      </Card>

      {/* 1. Evidence Used, Measured vs Expected & Data Quality */}
      <DiagnosisEvidenceCard
        probableCause={diagnosis.probableCause}
        rootCauseSummary={diagnosis.rootCauseSummary}
        electricalSignatures={diagnosis.electricalSignatures}
        comparisonMetrics={diagnosis.comparisonMetrics}
        dataQualityWarning={diagnosis.dataQualityWarning}
        hasInsufficientEvidence={diagnosis.hasInsufficientEvidence}
        engineType={diagnosis.engineType}
        isSuspicionOnly={diagnosis.isSuspicionOnly}
      />

      {/* 2. Timeline of Relevant Telemetry */}
      <DiagnosisTelemetryTimeline
        timelineTelemetry={diagnosis.timelineTelemetry}
        faultTitle={diagnosis.faultTitle || diagnosis.faultClass}
      />

      {/* 3. Estimated Energy Loss & Financial Impact */}
      <DiagnosisImpactCard
        estimatedLostEnergyKwh={diagnosis.estimatedLostEnergyKwh}
        cumulativeLostEnergyKwh={diagnosis.cumulativeLostEnergyKwh}
        projectedMonthlyLossKwh={diagnosis.projectedMonthlyLossKwh}
        financialDeficitInr={diagnosis.financialDeficitInr}
        projectedMonthlyLossInr={diagnosis.projectedMonthlyLossInr}
      />

      {/* 4. Recommended Inspection Steps, Related Images & Work Orders */}
      <DiagnosisInspectionChecklist
        recommendedInspectionSteps={diagnosis.recommendedInspectionSteps}
        relatedImages={diagnosis.relatedImages}
        workOrderId={diagnosis.workOrderId}
        onOpenWorkOrderModal={() => setIsWorkOrderModalOpen(true)}
      />

      {/* 5. Diagnosis Lifecycle History */}
      <DiagnosisHistoryCard
        history={diagnosis.history}
        diagnosisId={diagnosis.id}
      />

      {/* Modals */}
      <AnalysisRunModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onScanComplete={handleScanComplete}
      />

      <WorkOrderModal
        isOpen={isWorkOrderModalOpen}
        onClose={() => setIsWorkOrderModalOpen(false)}
        diagnosis={diagnosis}
        onSubmit={handleCreateWorkOrder}
      />
    </div>
  );
};

export default DiagnosisDetailPage;
