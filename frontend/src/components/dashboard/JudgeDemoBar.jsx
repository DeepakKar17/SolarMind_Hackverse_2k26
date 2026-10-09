import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Camera,
  Layers,
  Zap,
  TrendingDown,
  Info,
  ArrowRight,
} from 'lucide-react';
import { Badge, Button, Modal } from '../common';
import { useSolarData } from '../../hooks/useSolarData';
import { useToast } from '../common/Toast';
import GuidedTroubleshootingAssistant from '../diagnosis/GuidedTroubleshootingAssistant';
import WorkOrderModal from './WorkOrderModal';

export const DEMO_SCENARIOS = {
  NORMAL: {
    id: 'NORMAL',
    name: '1. Optimal Peak Generation',
    badge: 'Healthy Yield',
    badgeVariant: 'success',
    icon: '☀️',
    powerKw: 5.2,
    expectedKw: 5.2,
    gapKwh: 0.0,
    lossInr: 0.0,
    prPct: 99.4,
    faultClass: 'NORMAL',
    diagnosisTitle: 'System Operating at Nominal Peak Yield',
    recommendation: 'No action required. All MPPT strings operating within optimal physical baseline.',
  },
  SHADING: {
    id: 'SHADING',
    name: '2. Severe Tree Shading Deficit',
    badge: 'Diurnal Deficit',
    badgeVariant: 'warning',
    icon: '🌳',
    powerKw: 3.45,
    expectedKw: 5.2,
    gapKwh: 5.1,
    lossInr: 41.2,
    prPct: 66.3,
    faultClass: 'PARTIAL_SHADING',
    diagnosisTitle: 'Localized Tree Foliage Obstruction',
    recommendation: 'Trim tree branch encroachment along southern rooftop array boundary.',
  },
  SOILING: {
    id: 'SOILING',
    name: '3. Heavy Dust & Soiling Layer',
    badge: 'Soiling Deficit',
    badgeVariant: 'warning',
    icon: '🌫️',
    powerKw: 4.1,
    expectedKw: 5.2,
    gapKwh: 4.2,
    lossInr: 34.02,
    prPct: 78.8,
    faultClass: 'SOILING_ACCUMULATION',
    diagnosisTitle: 'Multi-Day Uniform Dust & Bird Droppings',
    recommendation: 'Schedule module washing using demineralized water and soft micro-fiber sponge.',
  },
  GRID_OVERVOLTAGE: {
    id: 'GRID_OVERVOLTAGE',
    name: '4. DISCOM Grid Overvoltage Trip',
    badge: 'Safety Trip',
    badgeVariant: 'danger',
    icon: '⚡',
    powerKw: 0.0,
    expectedKw: 5.2,
    gapKwh: 4.7,
    lossInr: 38.07,
    prPct: 0.0,
    faultClass: 'GRID_OVERVOLTAGE',
    diagnosisTitle: 'Distribution Line Voltage Exceeded 253V Anti-Islanding Trip',
    recommendation: 'Contact DISCOM utility division for distribution transformer tap adjustment.',
  },
  THERMAL: {
    id: 'THERMAL',
    name: '5. Inverter Thermal Throttling',
    badge: 'Thermal Derate',
    badgeVariant: 'warning',
    icon: '🔥',
    powerKw: 3.8,
    expectedKw: 5.2,
    gapKwh: 2.3,
    lossInr: 18.63,
    prPct: 73.1,
    faultClass: 'THERMAL_CLIPPING',
    diagnosisTitle: 'IGBT Heatsink Ventilation Restriction',
    recommendation: 'Clear heatsink louvers and check inverter cooling fan assembly.',
  },
};

export const JudgeDemoBar = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { setSelectedPlant } = useSolarData();

  const [activeScenarioKey, setActiveScenarioKey] = useState('SHADING');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [workOrderData, setWorkOrderData] = useState(null);

  const scenario = DEMO_SCENARIOS[activeScenarioKey];

  const handleScenarioChange = (key) => {
    setActiveScenarioKey(key);
    const s = DEMO_SCENARIOS[key];
    addToast({
      title: `Demo Scenario Loaded: ${s.name}`,
      message: `${s.diagnosisTitle} • Gap: -${s.gapKwh} kWh (₹${s.lossInr})`,
      variant: s.badgeVariant,
    });
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        padding: 'var(--space-4) var(--space-5)',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        marginBottom: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {/* Top Bar: Hackathon Badge & Scenario Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
              color: '#0f172a',
              fontWeight: 'var(--font-weight-extrabold)',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              letterSpacing: '0.04em',
            }}
          >
            <Sparkles size={13} />
            HACKATHON JURY DEMO PRESETS
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8' }}>
            Select realistic simulated fault events to evaluate root-cause AI & loss engine:
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Button
            variant="primary"
            size="sm"
            icon={HelpCircle}
            onClick={() => setIsAssistantOpen(true)}
            style={{ backgroundColor: '#2563eb', borderColor: '#3b82f6' }}
          >
            Interactive Troubleshooting Assistant
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={Camera}
            onClick={() => navigate('/photos')}
            style={{ color: '#f8fafc', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Geo Photo AI
          </Button>
        </div>
      </div>

      {/* Preset Scenario Selector Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        {Object.entries(DEMO_SCENARIOS).map(([key, item]) => {
          const isActive = key === activeScenarioKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleScenarioChange(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '1.5px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 'var(--font-weight-bold)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.name}
                </span>
                <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8' }}>
                  {item.powerKw} kW • {item.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Scenario Live Metrics Banner */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            {scenario.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <strong style={{ fontSize: 'var(--font-size-sm)', color: '#f8fafc' }}>
                {scenario.diagnosisTitle}
              </strong>
              <Badge variant={scenario.badgeVariant}>{scenario.badge}</Badge>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#cbd5e1' }}>
              Action Guidance: {scenario.recommendation}
            </p>
          </div>
        </div>

        {/* Live Numbers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Output / Baseline</span>
            <strong style={{ fontSize: '13px', color: '#60a5fa' }}>
              {scenario.powerKw} kW / {scenario.expectedKw} kW
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Energy Gap</span>
            <strong style={{ fontSize: '13px', color: scenario.gapKwh > 0 ? '#f87171' : '#34d399' }}>
              {scenario.gapKwh > 0 ? `-${scenario.gapKwh} kWh` : '0 kWh'}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Financial Deficit</span>
            <strong style={{ fontSize: '13px', color: scenario.lossInr > 0 ? '#fbbf24' : '#34d399' }}>
              ₹{scenario.lossInr.toFixed(2)}/day
            </strong>
          </div>
        </div>
      </div>

      {/* Guided Troubleshooting Assistant Modal */}
      {isAssistantOpen && (
        <Modal
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          title="Interactive Root-Cause Diagnostic Assistant"
          size="lg"
        >
          <GuidedTroubleshootingAssistant
            initialFaultCode={scenario.faultClass === 'GRID_OVERVOLTAGE' ? 'F35' : ''}
            onClose={() => setIsAssistantOpen(false)}
            onOpenWorkOrder={(order) => {
              setIsAssistantOpen(false);
              setWorkOrderData(order);
            }}
          />
        </Modal>
      )}

      {/* Work Order Modal */}
      {workOrderData && (
        <WorkOrderModal
          isOpen={Boolean(workOrderData)}
          onClose={() => setWorkOrderData(null)}
          diagnosis={{
            id: 'DIAG-DEMO-901',
            faultClass: scenario.faultClass,
            severity: scenario.faultClass === 'GRID_OVERVOLTAGE' ? 'CRITICAL' : 'WARNING',
            plantId: 1,
            inverterId: 'INV-101',
          }}
        />
      )}
    </div>
  );
};

export default JudgeDemoBar;
