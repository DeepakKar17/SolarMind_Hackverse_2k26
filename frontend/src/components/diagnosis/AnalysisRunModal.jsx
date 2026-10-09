import { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, Select, Badge } from '../common';
import { Sparkles, Activity, AlertCircle, CheckCircle2, Cpu } from 'lucide-react';

export const AnalysisRunModal = ({ isOpen, onClose, onScanComplete }) => {
  const [plantId, setPlantId] = useState('1');
  const [analysisMode, setAnalysisMode] = useState('FULL_SUITE');
  const [timeWindow, setTimeWindow] = useState('24h');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsScanning(true);

    try {
      setScanStep('Retrieving high-resolution inverter & string telemetry...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      setScanStep('Running Clear-Sky physical irradiance simulation...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      setScanStep('Evaluating electrical signature deviations & ML classifiers...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (onScanComplete) {
        await onScanComplete({ plantId, analysisMode, timeWindow });
      }

      setIsScanning(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete diagnostic scan.');
      setIsScanning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isScanning ? undefined : onClose}
      title="Run SolarMind AI Diagnostic Scan"
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div
          style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <Cpu size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--color-text-primary)', display: 'block' }}>
              Edge Telemetry Diagnostic Pipeline
            </strong>
            Executes physics-informed model comparisons and deep learning anomaly classifiers.
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <Select
          label="Target Solar Installation / Plant"
          value={plantId}
          onChange={(e) => setPlantId(e.target.value)}
          disabled={isScanning}
          options={[
            { value: '1', label: 'Residential Rooftop String-1 (5.2 kWp)' },
            { value: '2', label: 'Bhartiya Villa Single-String (3.3 kWp)' },
            { value: '3', label: 'Suburban Net-Metered Array C (6.0 kWp)' },
            { value: '4', label: 'Kaveri Commercial Canopy D (10.0 kWp)' },
            { value: '5', label: 'Green Acres Agri-PV (15.0 kWp)' },
            { value: '6', label: 'Deccan Heights Rooftop F (8.5 kWp)' },
          ]}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Analysis Time Window"
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            disabled={isScanning}
            options={[
              { value: '6h', label: 'Last 6 Hours' },
              { value: '24h', label: 'Last 24 Hours' },
              { value: '7d', label: 'Last 7 Days' },
              { value: '30d', label: 'Last 30 Days' },
            ]}
          />

          <Select
            label="Diagnostic Engine Mode"
            value={analysisMode}
            onChange={(e) => setAnalysisMode(e.target.value)}
            disabled={isScanning}
            options={[
              { value: 'FULL_SUITE', label: 'Full Diagnostic Suite' },
              { value: 'ML_ONLY', label: 'ML Anomaly Classifier' },
              { value: 'DETERMINISTIC_ONLY', label: 'Electrical Grid Rules' },
              { value: 'SOILING_ONLY', label: 'Soiling & Degradation' },
            ]}
          />
        </div>

        {isScanning && (
          <div
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Sparkles size={16} style={{ color: 'var(--color-primary)', animation: 'spin 2s linear infinite' }} />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)' }}>
                Diagnostic Scan in Progress...
              </span>
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {scanStep}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <Badge variant="info" style={{ fontSize: '11px' }}>
            Endpoint: /api/v1/diagnoses/analyze (Simulated)
          </Badge>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isScanning}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isScanning}
            >
              <Sparkles size={14} />
              <span>{isScanning ? 'Analyzing...' : 'Execute AI Scan'}</span>
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

AnalysisRunModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScanComplete: PropTypes.func,
};

export default AnalysisRunModal;
