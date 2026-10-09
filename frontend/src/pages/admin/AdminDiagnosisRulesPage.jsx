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
import { Workflow, Settings2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/adminService';

export const AdminDiagnosisRulesPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Modal State
  const [selectedRule, setSelectedRule] = useState(null);
  const [editForm, setEditForm] = useState({ threshold_value: '', threshold_unit: '', documentation: '' });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getFaultRules();
      setRules(data);
    } catch (err) {
      setError(err.message || 'Failed to load fault diagnosis rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleOpenEdit = (rule) => {
    setSelectedRule(rule);
    setEditForm({
      threshold_value: rule.threshold_value,
      threshold_unit: rule.threshold_unit,
      documentation: rule.documentation || '',
    });
    setSaveError(null);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRule) return;
    try {
      setSaveLoading(true);
      setSaveError(null);
      await adminService.updateFaultRule(selectedRule.id, {
        threshold_value: parseFloat(editForm.threshold_value),
        threshold_unit: editForm.threshold_unit,
        documentation: editForm.documentation,
      });
      setSelectedRule(null);
      loadRules();
    } catch (err) {
      setSaveError(err.message || 'Failed to update rule threshold.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRollback = async (ruleId) => {
    if (!window.confirm('Are you sure you want to rollback this rule to its previous threshold value?')) return;
    try {
      await adminService.rollbackFaultRule(ruleId);
      loadRules();
    } catch (err) {
      alert(`Rollback failed: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <PageHeader
        title="Diagnosis Rules Configuration Engine"
        description="Configure dynamic thresholds, rule weights, and confidence baselines for automated anomaly detection."
        breadcrumbs={[
          { label: 'Administration', to: '/admin/dashboard' },
          { label: 'Diagnosis Rules', to: '/admin/diagnosis-rules' },
        ]}
      />

      <Card title="Active Diagnostic Heuristics" subtitle="Evaluation rules executed on incoming telemetry and manual inspection photos.">
        {loading ? (
          <LoadingState message="Loading diagnostic heuristics catalog..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadRules} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Rule ID</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Rule Name</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Category</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Active Threshold</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Version</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Updated By</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {r.id}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      <div>{r.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 400 }}>{r.description}</div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {r.category}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {r.threshold_value} {r.threshold_unit}
                      </span>
                      {r.previous_threshold_value !== undefined && r.previous_threshold_value !== null && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          Prev: {r.previous_threshold_value}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge variant="primary">v{r.version}</Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {r.updated_by || 'SYSTEM'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                        <button className="sm-btn sm-btn--secondary sm-btn--sm" onClick={() => handleOpenEdit(r)}>
                          Configure
                        </button>
                        {r.previous_threshold_value !== undefined && r.previous_threshold_value !== null && (
                          <button className="sm-btn sm-btn--ghost sm-btn--sm" onClick={() => handleRollback(r.id)} title="Rollback to previous threshold">
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Threshold Modal */}
      {selectedRule && (
        <Modal
          isOpen={Boolean(selectedRule)}
          onClose={() => setSelectedRule(null)}
          title={`Configure Rule: ${selectedRule.name}`}
        >
          <form onSubmit={handleSaveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {saveError && (
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                {saveError}
              </div>
            )}
            <Input
              label="Threshold Value"
              type="number"
              step="any"
              value={editForm.threshold_value}
              onChange={(e) => setEditForm({ ...editForm, threshold_value: e.target.value })}
              required
            />
            <Input
              label="Threshold Unit"
              value={editForm.threshold_unit}
              onChange={(e) => setEditForm({ ...editForm, threshold_unit: e.target.value })}
              required
            />
            <Input
              label="Engineering Documentation / Standards Note"
              value={editForm.documentation}
              onChange={(e) => setEditForm({ ...editForm, documentation: e.target.value })}
              placeholder="e.g. IEC 61724 Section 7.2"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setSelectedRule(null)} type="button">
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={saveLoading}>
                Save & Bump Version
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AdminDiagnosisRulesPage;
