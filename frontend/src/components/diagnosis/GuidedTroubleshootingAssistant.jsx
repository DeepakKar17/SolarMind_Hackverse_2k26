import { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  FileText,
  Copy,
  ArrowRight,
  Sun,
  CloudRain,
  Wrench,
  Zap,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Card, Badge, Button } from '../common';
import { useToast } from '../common/Toast';

export const GuidedTroubleshootingAssistant = ({ initialFaultCode = '', onClose, onOpenWorkOrder }) => {
  const { addToast } = useToast();

  const [state, setState] = useState({
    weather: null, // 'yes' | 'no' | 'unknown'
    soil: null,    // 'yes' | 'no' | 'unknown'
    mcb: null,     // 'yes' | 'no' | 'unknown'
    grid: null,    // 'yes' | 'no' | 'unknown'
    fault: initialFaultCode || '',   // '' | 'F35' | 'F56' | 'F20' | 'OTHER' | 'NONE'
  });

  const answeredCount = [state.weather, state.soil, state.mcb, state.grid, state.fault ? state.fault : null].filter(Boolean).length;
  const progressPct = Math.round((answeredCount / 5) * 100);

  const handleSelect = (key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setState({
      weather: null,
      soil: null,
      mcb: null,
      grid: null,
      fault: '',
    });
    addToast({ title: 'Assistant Reset', message: 'Diagnostic questions reset to initial state.', variant: 'info' });
  };

  const handleCopySummary = async () => {
    const text = `SolarMind Guided Diagnosis Summary:
• Weather check: ${state.weather || 'Not answered'}
• Panel soiling: ${state.soil || 'Not answered'}
• External switches: ${state.mcb || 'Not answered'}
• Grid availability: ${state.grid || 'Not answered'}
• Inverter alarm code: ${state.fault || 'None'}
• Evidence Completeness: ${progressPct}%`;

    try {
      await navigator.clipboard.writeText(text);
      addToast({ title: 'Copied to Clipboard', message: 'Diagnosis dossier summary copied.', variant: 'success' });
    } catch {
      addToast({ title: 'Copy Failed', message: 'Could not access clipboard.', variant: 'danger' });
    }
  };

  const handleDownloadReport = () => {
    const reportText = `==================================================================
SOLARMIND AI SOLAR DIAGNOSTIC DOSSIER
==================================================================
Generated At: ${new Date().toISOString()}
System Type: Residential Single-String On-Grid Inverter

GUIDED ROOT-CAUSE QUESTION RESPONSES:
1. Weather Anomaly Explanation: ${state.weather || 'Unverified'}
2. Visible Module Soiling / Debris: ${state.soil || 'Unverified'}
3. External Switch & Breaker Appearance: ${state.mcb || 'Unverified'}
4. DISCOM Utility Outage / Power Cut: ${state.grid || 'Unverified'}
5. Inverter Display Fault Code: ${state.fault || 'None'}

EVIDENCE COMPLETENESS: ${progressPct}%

SOLARMIND AI DIAGNOSTIC INFERENCE:
${getDiagnosisInferenceText(state)}

SAFETY NOTICE:
SolarMind provides analytical diagnostic guidance. High voltage DC/AC
equipment must only be serviced by certified solar electricians.
Never open energized equipment.
==================================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarMind-Diagnosis-Dossier-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ title: 'Report Downloaded', message: 'Diagnosis text dossier saved.', variant: 'success' });
  };

  // Determine root cause synthesis
  const diagnosis = evaluateDiagnosis(state);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header with Evidence Gauge */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <HelpCircle size={20} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              Interactive Root-Cause Diagnostic Assistant
            </h3>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Answer guided diagnostic questions to narrow down the probable fault mechanism and generate an immediate safe action plan.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={handleReset}>
            Reset Checks
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>

      {/* Progress & Completeness Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-semibold)' }}>
            Evidence Completeness ({answeredCount} / 5 Questions Answered)
          </span>
          <strong style={{ color: progressPct === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
            {progressPct}% Verified
          </strong>
        </div>
        <div style={{ height: '6px', backgroundColor: 'var(--color-bg-muted)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              transition: 'width 250ms ease',
            }}
          />
        </div>
      </div>

      {/* 5 Guided Diagnostic Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Step 1: Weather Check */}
        <QuestionStepCard
          stepNumber={1}
          question="Can weather explain the energy gap?"
          description="Check rain, cloud cover, irradiance (W/m²), and ambient temperature before assuming hardware failure."
          active={state.weather !== null}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <ChoiceButton
              selected={state.weather === 'yes'}
              onClick={() => handleSelect('weather', 'yes')}
              label="Yes — Rain / dense clouds explain gap"
            />
            <ChoiceButton
              selected={state.weather === 'no'}
              onClick={() => handleSelect('weather', 'no')}
              label="No — Clear sun with deficit"
            />
            <ChoiceButton
              selected={state.weather === 'unknown'}
              onClick={() => handleSelect('weather', 'unknown')}
              label="Not sure / Inconclusive"
            />
          </div>
          {state.weather === 'yes' && (
            <ResultAlert
              variant="info"
              title="Weather is a plausible contributor"
              message="Low irradiance reduces yield. SolarMind will compute a weather-adjusted baseline before raising hardware fault alarms."
            />
          )}
          {state.weather === 'no' && (
            <ResultAlert
              variant="warning"
              title="High irradiance with generation deficit detected"
              message="Weather alone does not account for the deficit. Physical panel or electrical checks are recommended."
            />
          )}
        </QuestionStepCard>

        {/* Step 2: Soiling & Obstruction Check */}
        <QuestionStepCard
          stepNumber={2}
          question="Are dust, soil, leaves or obstructions visible on panels?"
          description="Perform a safe ground-level visual inspection or upload a panel photo using Geo Photo AI."
          active={state.soil !== null}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <ChoiceButton
              selected={state.soil === 'yes'}
              onClick={() => handleSelect('soil', 'yes')}
              label="Yes — Heavy dust / leaves visible"
            />
            <ChoiceButton
              selected={state.soil === 'no'}
              onClick={() => handleSelect('soil', 'no')}
              label="No — Panel surface is clean"
            />
            <ChoiceButton
              selected={state.soil === 'unknown'}
              onClick={() => handleSelect('soil', 'unknown')}
              label="Cannot confirm safely"
            />
          </div>
          {state.soil === 'yes' && (
            <ResultAlert
              variant="warning"
              title="Panel soiling / obstruction confirmed"
              message="Recommend scheduled module washing using demineralized water. Never walk on panels or use abrasive scrubbers."
            />
          )}
        </QuestionStepCard>

        {/* Step 3: External Breakers / Switches */}
        <QuestionStepCard
          stepNumber={3}
          question="Do accessible external isolators & breakers appear in normal ON position?"
          description="Only visually verify external switch handles. Never open electrical enclosures or touch wiring."
          active={state.mcb !== null}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <ChoiceButton
              selected={state.mcb === 'yes'}
              onClick={() => handleSelect('mcb', 'yes')}
              label="Yes — All switches in normal position"
            />
            <ChoiceButton
              selected={state.mcb === 'no'}
              onClick={() => handleSelect('mcb', 'no')}
              label="No — Breaker tripped / abnormal"
            />
            <ChoiceButton
              selected={state.mcb === 'unknown'}
              onClick={() => handleSelect('mcb', 'unknown')}
              label="Cannot verify safely"
            />
          </div>
          {state.mcb === 'no' && (
            <ResultAlert
              variant="danger"
              title="Certified electrical service required"
              message="Do not repeatedly reset a tripped breaker without qualified inspection. Possible DC ground fault or AC overcurrent protection trip."
            />
          )}
        </QuestionStepCard>

        {/* Step 4: Utility Grid Outage */}
        <QuestionStepCard
          stepNumber={4}
          question="Is there a DISCOM utility grid power outage?"
          description="On-grid inverters immediately disconnect when grid voltage is absent to prevent dangerous anti-islanding feed."
          active={state.grid !== null}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <ChoiceButton
              selected={state.grid === 'yes'}
              onClick={() => handleSelect('grid', 'yes')}
              label="Yes — Grid power cut confirmed"
            />
            <ChoiceButton
              selected={state.grid === 'no'}
              onClick={() => handleSelect('grid', 'no')}
              label="No — Grid power is active"
            />
            <ChoiceButton
              selected={state.grid === 'unknown'}
              onClick={() => handleSelect('grid', 'unknown')}
              label="Not sure"
            />
          </div>
          {state.grid === 'yes' && (
            <ResultAlert
              variant="info"
              title="Grid safety anti-islanding active"
              message="Zero export during utility outage is normal on-grid safety behavior. Generation will resume automatically upon grid restoration."
            />
          )}
        </QuestionStepCard>

        {/* Step 5: Inverter Alarm Code */}
        <QuestionStepCard
          stepNumber={5}
          question="Does the inverter LCD or app display an alarm code?"
          description="Select the code from the inverter display for verbatim manufacturer manual interpretation."
          active={Boolean(state.fault)}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <select
              value={state.fault}
              onChange={(e) => handleSelect('fault', e.target.value)}
              className="sm-input"
              style={{ minWidth: '260px', padding: '8px 12px', fontSize: 'var(--font-size-xs)' }}
            >
              <option value="">Select Inverter Code...</option>
              <option value="F35">F35 — Grid Unavailable / Overvoltage Trip (Deye OEM)</option>
              <option value="F56">F56 — DC Bus Voltage Low / String Open Circuit</option>
              <option value="F20">F20 — Over-Current Hardware Protection Event</option>
              <option value="OTHER">Other / Unknown Manufacturer Code</option>
              <option value="NONE">No Alarm Code Displayed</option>
            </select>
          </div>
          {state.fault && state.fault !== 'NONE' && (
            <ResultAlert
              variant="warning"
              title={`OEM Fault Lookup: ${state.fault}`}
              message={
                state.fault === 'F35'
                  ? 'Deye Manual Reference: Grid line voltage exceeded permissible threshold. Check utility voltage at AC isolator.'
                  : state.fault === 'F56'
                  ? 'Deye Manual Reference: DC input voltage below operating MPPT window. Check string fuses and connectors.'
                  : 'Requires OEM manual resolution. Refer to qualified technician.'
              }
            />
          )}
        </QuestionStepCard>
      </div>

      {/* Synthesis Dossier Card */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: diagnosis.bgColor,
          border: `1px solid ${diagnosis.borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '20px' }}>{diagnosis.icon}</span>
            <div>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: diagnosis.textColor }}>
                Root-Cause Synthesis: {diagnosis.title}
              </strong>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                Confidence: <strong>{diagnosis.confidence}</strong> • Category: <strong>{diagnosis.category}</strong>
              </p>
            </div>
          </div>
          <Badge variant={diagnosis.badgeVariant}>{diagnosis.statusBadge}</Badge>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          {diagnosis.summary}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
          {onOpenWorkOrder && (
            <Button
              variant="primary"
              size="sm"
              icon={Wrench}
              onClick={() => onOpenWorkOrder({ title: diagnosis.title, summary: diagnosis.summary })}
            >
              Generate Maintenance Work Order
            </Button>
          )}
          <Button variant="outline" size="sm" icon={FileText} onClick={handleDownloadReport}>
            Download Diagnostic Dossier (.txt)
          </Button>
          <Button variant="ghost" size="sm" icon={Copy} onClick={handleCopySummary}>
            Copy Summary
          </Button>
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Question Step Card
const QuestionStepCard = ({ stepNumber, question, description, active, children }) => (
  <div
    style={{
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: active ? 'var(--color-bg-surface)' : 'var(--color-bg-subtle)',
      border: active ? '1px solid var(--color-primary-focus)' : '1px solid var(--color-border)',
      boxShadow: active ? 'var(--shadow-sm)' : 'none',
      transition: 'all 150ms ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: active ? 'var(--color-primary)' : 'var(--color-bg-muted)',
          color: active ? '#ffffff' : 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'var(--font-weight-bold)',
          flexShrink: 0,
        }}
      >
        {stepNumber}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
          {question}
        </h4>
        <p style={{ margin: '2px 0 var(--space-2)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {description}
        </p>
        {children}
      </div>
    </div>
  </div>
);

// Subcomponent: Choice Button
const ChoiceButton = ({ selected, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: 'var(--radius-md)',
      fontSize: '12px',
      fontWeight: 'var(--font-weight-medium)',
      backgroundColor: selected ? 'var(--color-primary-light)' : 'var(--color-bg-surface)',
      border: selected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
      color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 120ms ease',
    }}
  >
    {selected && <Check size={13} color="var(--color-primary)" />}
    <span>{label}</span>
  </button>
);

// Subcomponent: Result Alert
const ResultAlert = ({ variant = 'info', title, message }) => {
  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return (
    <div
      style={{
        marginTop: 'var(--space-2)',
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isDanger ? 'var(--color-danger-bg)' : isWarning ? 'var(--color-warning-bg)' : 'var(--color-info-bg)',
        border: `1px solid ${isDanger ? 'var(--color-danger-border)' : isWarning ? 'var(--color-warning-border)' : 'var(--color-info-border)'}`,
        fontSize: '11px',
      }}
    >
      <strong style={{ color: isDanger ? 'var(--color-danger-text)' : isWarning ? 'var(--color-warning-text)' : 'var(--color-info-text)' }}>
        {title}:
      </strong>{' '}
      <span style={{ color: 'var(--color-text-secondary)' }}>{message}</span>
    </div>
  );
};

// Diagnosis Evaluation Helper
function evaluateDiagnosis(state) {
  if (state.mcb === 'no') {
    return {
      icon: '🚨',
      title: 'Tripped External Breaker / Isolator Fault',
      confidence: 'High (Action Required)',
      category: 'ELECTRICAL_SAFETY',
      statusBadge: 'Service Needed',
      badgeVariant: 'danger',
      bgColor: 'var(--color-danger-bg)',
      borderColor: 'var(--color-danger-border)',
      textColor: 'var(--color-danger-text)',
      summary: 'An external breaker was reported in tripped or abnormal position. Do not repeatedly reset breakers. Request qualified on-site electrical inspection for potential DC ground faults.',
    };
  }

  if (state.fault === 'F35' || state.grid === 'yes') {
    return {
      icon: '⚡',
      title: 'DISCOM Grid Overvoltage / Outage Trip',
      confidence: '98% Verified',
      category: 'GRID_INTERRUPTION',
      statusBadge: 'Grid Event',
      badgeVariant: 'warning',
      bgColor: 'var(--color-warning-bg)',
      borderColor: 'var(--color-warning-border)',
      textColor: 'var(--color-warning-text)',
      summary: 'Utility grid voltage exceeded 253V upper threshold or power was cut, triggering anti-islanding safety disconnect. Contact local DISCOM for transformer tap adjustment.',
    };
  }

  if (state.soil === 'yes') {
    return {
      icon: '🧹',
      title: 'Panel Dust Soiling & Leaf Obstruction',
      confidence: '85% Physical Evidence',
      category: 'SOILING_AND_DIRT',
      statusBadge: 'Actionable Maintenance',
      badgeVariant: 'warning',
      bgColor: 'var(--color-warning-bg)',
      borderColor: 'var(--color-warning-border)',
      textColor: 'var(--color-warning-text)',
      summary: 'Accumulation of dust and leaf obstruction is causing diurnal current attenuation. Schedule safe module washing using demineralized water.',
    };
  }

  if (state.weather === 'yes') {
    return {
      icon: '🌧️',
      title: 'Atmospheric Cloud & Rain Irradiance Attenuation',
      confidence: 'Moderate (Weather Explained)',
      category: 'WEATHER_ANOMALY',
      statusBadge: 'Weather Explained',
      badgeVariant: 'info',
      bgColor: 'var(--color-info-bg)',
      borderColor: 'var(--color-info-border)',
      textColor: 'var(--color-info-text)',
      summary: 'Current yield deficit is consistent with measured low plane-of-array irradiance and heavy cloud cover. Inverter physical hardware is operating within normal baseline.',
    };
  }

  return {
    icon: '🔍',
    title: 'Multi-Evidence Preliminary Evaluation',
    confidence: 'Awaiting Verification',
    category: 'INSPECTION_PENDING',
    statusBadge: 'Reviewing',
    badgeVariant: 'secondary',
    bgColor: 'var(--color-bg-subtle)',
    borderColor: 'var(--color-border)',
    textColor: 'var(--color-text-primary)',
    summary: 'Complete the 5 guided checks above to calibrate physical sensors with visible on-site observations.',
  };
}

function getDiagnosisInferenceText(state) {
  if (state.mcb === 'no') return 'Qualified electrical service required for tripped external isolator.';
  if (state.fault === 'F35' || state.grid === 'yes') return 'Grid overvoltage / anti-islanding disconnect verified.';
  if (state.soil === 'yes') return 'Heavy panel surface soiling causing generation deficit.';
  if (state.weather === 'yes') return 'Weather and irradiance attenuation explains deficit.';
  return 'Preliminary diagnostic review in progress.';
}

export default GuidedTroubleshootingAssistant;
