import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Card, StatCard, Badge, Button, Input, Select, SearchInput, Modal, LoadingState, ErrorState, EmptyState } from '../components/common';
import {
  Wrench,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Zap,
  Camera,
  Layers,
  FileCheck,
  Eye,
  IndianRupee,
} from 'lucide-react';
import { maintenanceService } from '../services/maintenanceService';
import { formatCurrency, formatEnergy, formatVoltage, formatCurrent } from '../utils/formatters';

export const MaintenancePage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [plantId, setPlantId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');

  // Selected Log for Inspection Modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Load maintenance records
  const loadMaintenance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await maintenanceService.getMaintenanceLogs({ search, plantId, status, category });
      setLogs(res);
    } catch (err) {
      setError(err.message || 'Failed to load maintenance history records.');
    } finally {
      setLoading(false);
    }
  }, [search, plantId, status, category]);

  useEffect(() => {
    loadMaintenance();
  }, [loadMaintenance]);

  const completedCount = logs.filter((l) => l.status === 'COMPLETED').length;
  const totalSpendInr = logs.reduce((acc, l) => acc + (l.costInr || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="Preventive Maintenance & Service Verification History"
        subtitle="Chronological audit records of module washes, foliage clearance, inverter service, and electrical verification tests."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Maintenance History' },
        ]}
      />

      {/* KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="Completed Interventions"
          value={completedCount}
          subtext="Verified on-site service operations"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Total Maintenance Spend"
          value={formatCurrency(totalSpendInr)}
          subtext="Dispatched contractor & part costs"
          icon={IndianRupee}
          variant="default"
        />
        <StatCard
          title="Average Yield Recovery"
          value="+16.5%"
          subtext="Measured post-service yield uplift"
          icon={Zap}
          variant="success"
        />
        <StatCard
          title="SLA Verification Rate"
          value="100%"
          subtext="With electrical test sign-offs"
          icon={ShieldCheck}
          variant="info"
        />
      </div>

      {/* Filter Control Bar */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ flex: '1 1 280px' }}>
            <SearchInput
              placeholder="Search by work order ID, technician, issue, plant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              aria-label="Search maintenance history"
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <Select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Solar Plants' },
                { value: '1', label: 'Residential Rooftop String-1' },
                { value: '3', label: 'Suburban Net-Metered Array C' },
                { value: '4', label: 'Kaveri Commercial Canopy D' },
              ]}
              aria-label="Filter by plant"
            />
          </div>

          <div style={{ minWidth: '160px' }}>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'COMPLETED', label: 'Completed & Signed' },
                { value: 'SCHEDULED', label: 'Scheduled / Pending' },
              ]}
              aria-label="Filter by status"
            />
          </div>

          <div style={{ minWidth: '190px' }}>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Service Categories' },
                { value: 'VEGETATION_TRIMMING', label: 'Vegetation Trimming' },
                { value: 'MODULE_WASHING', label: 'Demineralized Wash' },
                { value: 'GRID_COMPLIANCE', label: 'Grid Voltage Compliance' },
                { value: 'PREVENTIVE_INSPECTION', label: 'Preventive Audit' },
              ]}
              aria-label="Filter by service category"
            />
          </div>
        </div>
      </Card>

      {/* Maintenance Records Feed */}
      {loading ? (
        <LoadingState message="Retrieving historical service logs and technician electrical test sign-offs..." />
      ) : error ? (
        <ErrorState title="Failed to Load Maintenance History" message={error} onRetry={loadMaintenance} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Maintenance Records Found"
          description="No historical service records match the active filter criteria."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setPlantId('ALL');
                setStatus('ALL');
                setCategory('ALL');
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {logs.map((log) => {
            const isCompleted = log.status === 'COMPLETED';

            return (
              <Card key={log.id} style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {/* Top Bar */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge variant={isCompleted ? 'success' : 'warning'} dot>
                        {log.status}
                      </Badge>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                        {log.workOrderId} ({log.id})
                      </strong>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {log.issueTitle}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        {log.completedDate ? `Completed: ${log.completedDate}` : `Scheduled: ${log.scheduledDate}`}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        onClick={() => setSelectedLog(log)}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                      >
                        Verification Evidence
                      </Button>
                    </div>
                  </div>

                  {/* Asset & Technician Metadata */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-bg-canvas)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', color: 'var(--color-text-secondary)' }}>
                      <span><strong>Plant:</strong> {log.plantName}</span>
                      <span><strong>Asset:</strong> {log.inverterId} / {log.stringId}</span>
                      <span><strong>Lead Tech:</strong> {log.technician}</span>
                      <span><strong>Provider:</strong> {log.serviceProvider}</span>
                    </div>

                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      Cost: {formatCurrency(log.costInr)} {log.durationHours ? `(${log.durationHours} hrs)` : ''}
                    </div>
                  </div>

                  {/* Actions Taken Overview */}
                  <div>
                    <strong style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                      Key Corrective Actions Executed:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                      {log.actionsTaken.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Verification Evidence Summary Strip */}
                  {log.verificationEvidence && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '6px 10px',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        color: 'var(--color-success)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span><strong>Post-Service Uplift:</strong> {log.verificationEvidence.yieldGainPercent}</span>
                      <span><strong>String Voc:</strong> {formatVoltage(log.verificationEvidence.stringVocVolts)}</span>
                      <span><strong>String Isc:</strong> {formatCurrent(log.verificationEvidence.stringIscAmps)}</span>
                      {log.verificationEvidence.hasPhotoEvidence && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Camera size={11} /> Photo Geotag Attached
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Verification Evidence Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Field Verification Evidence: ${selectedLog.workOrderId}`}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                {selectedLog.issueTitle}
              </h3>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {selectedLog.plantName} | {selectedLog.inverterId} | {selectedLog.technician}
              </span>
            </div>

            {selectedLog.verificationEvidence ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Yield Uplift / Recovery</span>
                    <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-success)' }}>
                      {selectedLog.verificationEvidence.yieldGainPercent}
                    </strong>
                  </div>

                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>String Voc / Isc Test</span>
                    <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                      {formatVoltage(selectedLog.verificationEvidence.stringVocVolts)} / {formatCurrent(selectedLog.verificationEvidence.stringIscAmps)}
                    </strong>
                  </div>
                </div>

                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-surface)', borderLeft: '3px solid var(--color-success)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                  <strong style={{ color: 'var(--color-success)', display: 'block', marginBottom: '2px' }}>
                    Technician Verification Sign-Off:
                  </strong>
                  {selectedLog.verificationEvidence.technicianSignoff}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Service is scheduled. Electrical test verification readings will be uploaded upon work order completion.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="primary" size="sm" onClick={() => setSelectedLog(null)}>
                Close Evidence Dossier
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MaintenancePage;
