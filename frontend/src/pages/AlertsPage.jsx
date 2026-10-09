import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, StatCard, Badge, Button, Input, Select, SearchInput, LoadingState, ErrorState, EmptyState, Modal } from '../components/common';
import GuidedTroubleshootingAssistant from '../components/diagnosis/GuidedTroubleshootingAssistant';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Search,
  CheckCheck,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { alertService, ALERT_SEVERITIES } from '../services/alertService';
import { formatDateTime, formatPower, formatEnergy, formatCurrency } from '../utils/formatters';

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlertForAssistant, setSelectedAlertForAssistant] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [acknowledged, setAcknowledged] = useState('ALL');
  const [plantId, setPlantId] = useState('ALL');

  // Action Feedback
  const [actionFeedback, setActionFeedback] = useState(null);

  // Load alerts
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await alertService.getAlerts({ search, severity, acknowledged, plantId });
      setAlerts(res);
    } catch (err) {
      setError(err.message || 'Failed to load system alarm telemetry.');
    } finally {
      setLoading(false);
    }
  }, [search, severity, acknowledged, plantId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Handle Acknowledge Action
  const handleAcknowledge = async (alertId) => {
    try {
      const updated = await alertService.acknowledgeAlert(alertId, { actor: 'Lead Solar Engineer' });
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...updated } : a)));
      setActionFeedback(`Alert ${alertId} successfully acknowledged.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Handle Batch Acknowledge
  const handleBatchAcknowledge = async () => {
    const unacked = alerts.filter((a) => !a.acknowledged).map((a) => a.id);
    if (unacked.length === 0) return;

    try {
      await alertService.batchAcknowledge(unacked, { actor: 'Lead Solar Engineer' });
      loadAlerts();
      setActionFeedback(`Acknowledged ${unacked.length} active alarms.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback(`Batch error: ${err.message}`);
    }
  };

  const totalCritical = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const totalUnacked = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="System Alarms & Diagnostic Alerts"
        subtitle="Real-time electrical threshold trip alarms, communication dropouts, and single-string deratings."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'System Alarms' },
        ]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={CheckCheck}
            onClick={handleBatchAcknowledge}
            disabled={totalUnacked === 0}
          >
            Acknowledge All Filtered ({totalUnacked})
          </Button>
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
            <CheckCircle2 size={16} />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            &times;
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="Critical Alarms"
          value={totalCritical}
          subtext="Immediate trip / safety intervention"
          icon={AlertCircle}
          variant={totalCritical > 0 ? 'danger' : 'success'}
        />
        <StatCard
          title="Unacknowledged Events"
          value={totalUnacked}
          subtext="Pending operator review"
          icon={Bell}
          variant={totalUnacked > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Total Evaluated Alarms"
          value={alerts.length}
          subtext="Across active solar fleet"
          icon={ShieldAlert}
          variant="info"
        />
      </div>

      {/* Filter Control Bar */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div style={{ flex: '1 1 280px' }}>
              <SearchInput
                placeholder="Search alerts by ID, alarm code, plant, inverter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch('')}
                aria-label="Search alerts"
              />
            </div>

            <div style={{ minWidth: '160px' }}>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Severities' },
                  { value: 'CRITICAL', label: 'Critical / Trips' },
                  { value: 'WARNING', label: 'Warnings / Anomalies' },
                  { value: 'INFO', label: 'Informational' },
                ]}
                aria-label="Filter by severity"
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <Select
                value={acknowledged}
                onChange={(e) => setAcknowledged(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Acknowledged States' },
                  { value: 'UNACKNOWLEDGED', label: 'Unacknowledged Only' },
                  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                ]}
                aria-label="Filter by acknowledgement state"
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <Select
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Solar Plants' },
                  { value: '1', label: 'Residential Rooftop String-1' },
                  { value: '2', label: 'Bhartiya Villa Single-String' },
                  { value: '3', label: 'Suburban Net-Metered Array C' },
                  { value: '4', label: 'Kaveri Commercial Canopy D' },
                  { value: '6', label: 'Deccan Heights Rooftop F' },
                ]}
                aria-label="Filter by solar plant"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Alerts Feed List */}
      {loading ? (
        <LoadingState message="Polling live system alarms and inverter telemetry logs..." />
      ) : error ? (
        <ErrorState title="Failed to Load Alarms" message={error} onRetry={loadAlerts} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No Diagnostic Alarms Found"
          description="No alert records match the active filter criteria. All monitored solar strings are operating normally."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setSeverity('ALL');
                setAcknowledged('ALL');
                setPlantId('ALL');
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';
            const badgeVariant = isCritical ? 'danger' : isWarning ? 'warning' : 'info';

            return (
              <Card key={alert.id} style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {/* Alert Header Row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge variant={badgeVariant} dot>
                        {alert.severity}
                      </Badge>
                      <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                        {alert.id}
                      </strong>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {alert.code}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {formatDateTime(alert.timestamp)}
                      </span>

                      {alert.acknowledged ? (
                        <Badge variant="success" size="sm">
                          ✓ Acknowledged ({alert.acknowledgedBy})
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Alert Message */}
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {alert.message}
                  </p>

                  {/* Asset Metadata & Impact Pill */}
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
                      <span><strong>Plant:</strong> {alert.plantName}</span>
                      <span><strong>Inverter:</strong> {alert.inverterId}</span>
                      <span><strong>String / Port:</strong> {alert.stringId}</span>
                    </div>

                    {alert.estimatedDailyLossKwh !== null && (
                      <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                        Est. Loss: -{formatEnergy(alert.estimatedDailyLossKwh)} ({formatCurrency(alert.estimatedFinancialLossInr)} / day)
                      </div>
                    )}
                  </div>

                  {/* Actionable Guidance & Related Diagnosis Link */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      <strong>Guidance:</strong> {alert.actionableGuidance}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={HelpCircle}
                        onClick={() => setSelectedAlertForAssistant(alert)}
                        style={{ fontSize: '11px', padding: '3px 10px' }}
                      >
                        Troubleshoot (Guided Questions)
                      </Button>

                      {alert.relatedDiagnosisId && (
                        <Link
                          to={`/diagnosis/${alert.relatedDiagnosisId}`}
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 600,
                          }}
                        >
                          <span>Inspect Dossier ({alert.relatedDiagnosisId})</span>
                          <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Guided Troubleshooting Modal */}
      {selectedAlertForAssistant && (
        <Modal
          isOpen={Boolean(selectedAlertForAssistant)}
          onClose={() => setSelectedAlertForAssistant(null)}
          title={`Root-Cause Troubleshooting: ${selectedAlertForAssistant.id} (${selectedAlertForAssistant.code})`}
          size="lg"
        >
          <GuidedTroubleshootingAssistant
            initialFaultCode={selectedAlertForAssistant.code?.includes('GRID') ? 'F35' : ''}
            onClose={() => setSelectedAlertForAssistant(null)}
          />
        </Modal>
      )}
    </div>
  );
};

export default AlertsPage;
