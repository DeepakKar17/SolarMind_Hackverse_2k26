import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  Input,
  LoadingState,
  ErrorState,
} from '../../components/common';
import { Radio, RefreshCw, Key, ShieldCheck, CheckCircle2, Zap } from 'lucide-react';
import { adminService } from '../../services/adminService';

export const AdminIntegrationsPage = () => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Edit Modal State
  const [selectedInteg, setSelectedInteg] = useState(null);
  const [editForm, setEditForm] = useState({ endpoint_url: '', app_id: '', secret: '', sync_interval_min: 5 });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getIntegrations();
      setIntegrations(data);
    } catch (err) {
      setError(err.message || 'Failed to load hardware integrations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const handleTestConnection = async (integrationId) => {
    try {
      setTestingId(integrationId);
      setTestResult(null);
      const res = await adminService.testIntegration(integrationId);
      setTestResult({ id: integrationId, ...res });
      loadIntegrations();
    } catch (err) {
      alert(`Connection Test Failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleOpenEdit = (integ) => {
    setSelectedInteg(integ);
    setEditForm({
      endpoint_url: integ.endpoint_url,
      app_id: integ.app_id || '',
      secret: '',
      sync_interval_min: integ.sync_interval_min || 5,
    });
    setSaveError(null);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInteg) return;
    try {
      setSaveLoading(true);
      setSaveError(null);
      await adminService.updateIntegration(selectedInteg.id, editForm);
      setSelectedInteg(null);
      loadIntegrations();
    } catch (err) {
      setSaveError(err.message || 'Failed to update integration settings.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <PageHeader
        title="Hardware OpenAPI & Integration Connectors"
        description="Configure Deye, Sungrow, and Huawei inverter cloud gateways, telemetry webhooks, and MQTT brokers."
        breadcrumbs={[
          { label: 'Administration', to: '/admin/dashboard' },
          { label: 'Integrations', to: '/admin/integrations' },
        ]}
      />

      {loading ? (
        <LoadingState message="Connecting to integration registry..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadIntegrations} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
          {integrations.map((integ) => (
            <Card key={integ.id} title={integ.name} subtitle={integ.endpoint_url}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Status</span>
                  <Badge variant={integ.status === 'CONNECTED' ? 'success' : 'danger'}>
                    {integ.status}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>App ID / Identifier</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>{integ.app_id || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Security Protocol</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>{integ.auth_type}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Masked Secret</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {integ.masked_secret || '••••••••••••'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Sync Interval</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{integ.sync_interval_min} minutes</span>
                </div>

                {testResult && testResult.id === integ.id && (
                  <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} /> Ping OK ({testResult.latency_ms}ms)
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RefreshCw}
                    loading={testingId === integ.id}
                    onClick={() => handleTestConnection(integ.id)}
                  >
                    Test Ping
                  </Button>
                  <button className="sm-btn sm-btn--ghost sm-btn--sm" onClick={() => handleOpenEdit(integ)}>
                    Edit Credentials
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Credentials Modal */}
      {selectedInteg && (
        <Modal
          isOpen={Boolean(selectedInteg)}
          onClose={() => setSelectedInteg(null)}
          title={`Configure: ${selectedInteg.name}`}
        >
          <form onSubmit={handleSaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {saveError && (
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                {saveError}
              </div>
            )}
            <Input
              label="Endpoint URL"
              value={editForm.endpoint_url}
              onChange={(e) => setEditForm({ ...editForm, endpoint_url: e.target.value })}
              required
            />
            <Input
              label="App ID / Client Identifier"
              value={editForm.app_id}
              onChange={(e) => setEditForm({ ...editForm, app_id: e.target.value })}
            />
            <Input
              label="New Client Secret / Token (Optional)"
              type="password"
              value={editForm.secret}
              onChange={(e) => setEditForm({ ...editForm, secret: e.target.value })}
              placeholder="Enter new secret to rotate credentials"
            />
            <Input
              label="Sync Interval (Minutes)"
              type="number"
              min="1"
              max="1440"
              value={editForm.sync_interval_min}
              onChange={(e) => setEditForm({ ...editForm, sync_interval_min: parseInt(e.target.value, 10) || 5 })}
              required
            />
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Note: Plaintext secrets are encrypted immediately upon storage and never exposed in client API responses.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setSelectedInteg(null)} type="button">
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={saveLoading}>
                Save Configuration
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminIntegrationsPage;
