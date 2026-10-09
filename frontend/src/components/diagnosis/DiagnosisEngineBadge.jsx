import { Badge } from '../common';
import { DIAGNOSIS_ENGINE_TYPES } from '../../services/diagnosisService';
import { Brain, Cpu, Sparkles, HelpCircle, ShieldAlert } from 'lucide-react';

export const DiagnosisEngineBadge = ({
  engineType,
  confidenceScore = null,
  isSuspicionOnly = false,
  hasInsufficientEvidence = false,
  size = 'sm',
}) => {
  if (hasInsufficientEvidence) {
    return (
      <Badge variant="neutral" size={size} dot>
        Insufficient Telemetry
      </Badge>
    );
  }

  if (engineType === DIAGNOSIS_ENGINE_TYPES.DETERMINISTIC_RULE) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: size === 'sm' ? '11px' : '12px',
          fontWeight: 600,
          color: 'var(--color-primary)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
        }}
      >
        <Cpu size={12} />
        <span>Deterministic Rule</span>
      </span>
    );
  }

  if (isSuspicionOnly || engineType === DIAGNOSIS_ENGINE_TYPES.HEURISTIC) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: size === 'sm' ? '11px' : '12px',
          fontWeight: 600,
          color: 'var(--color-warning-text)',
          backgroundColor: 'var(--color-warning-light)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-warning-border)',
        }}
      >
        <HelpCircle size={12} />
        <span>
          Suspicion {confidenceScore !== null ? `(${confidenceScore}% Model Match)` : '(Unconfirmed)'}
        </span>
      </span>
    );
  }

  // Standard ML Model Prediction with Confidence Score
  if (confidenceScore !== null && confidenceScore !== undefined) {
    const isHigh = confidenceScore >= 85;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: size === 'sm' ? '11px' : '12px',
          fontWeight: 600,
          color: isHigh ? 'var(--color-success)' : 'var(--color-warning-text)',
          backgroundColor: isHigh ? 'rgba(22, 163, 74, 0.1)' : 'var(--color-warning-light)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          border: isHigh ? '1px solid rgba(22, 163, 74, 0.2)' : '1px solid var(--color-warning-border)',
        }}
      >
        <Brain size={12} />
        <span>{confidenceScore}% ML Match</span>
      </span>
    );
  }

  // Default fallback when confidence is not provided
  return (
    <Badge variant="neutral" size={size}>
      AI Evaluated
    </Badge>
  );
};

export default DiagnosisEngineBadge;
