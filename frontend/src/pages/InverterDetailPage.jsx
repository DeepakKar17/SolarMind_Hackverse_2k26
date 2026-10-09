import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  Button,
  LoadingState,
  ErrorState,
} from '../components/common';
import { useSolarData } from '../hooks/useSolarData';
import { inverterService } from '../services/inverterService';
import InverterDiagnosticBadge from '../components/inverters/InverterDiagnosticBadge';
import InverterStringTopologyCard from '../components/inverters/InverterStringTopologyCard';
import InverterTelemetryTrends from '../components/inverters/InverterTelemetryTrends';
import InverterFaultsHistoryCard from '../components/inverters/InverterFaultsHistoryCard';
import InverterSpecsCard from '../components/inverters/InverterSpecsCard';
import {
  Cpu,
  ArrowLeft,
  Zap,
  Gauge,
  Thermometer,
  Activity,
  Sun,
  ShieldCheck,
  Building2,
  Calendar,
  Radio,
} from 'lucide-react';
import {
  formatPower,
  formatCapacity,
  formatVoltage,
  formatCurrent,
  formatEnergy,
  formatRelativeTime,
} from '../utils/formatters';

export const InverterDetailPage = () => {
  const { inverterId } = useParams();
  const navigate = useNavigate();
  const { setSelectedPlantId } = useSolarData();

  const [inverter, setInverter] = useState(null);
  const [telemetryRange, setTelemetryRange] = useState('TODAY');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInverter = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await inverterService.getInverterById(inverterId, { range: telemetryRange });
      setInverter(data);
      if (data.plantId) {
        setSelectedPlantId(data.plantId);
      }
    } catch (err) {
      setError(err.message || `Inverter unit "${inverterId}" not found.`);
    } finally {
      setIsLoading(false);
    }
  }, [inverterId, telemetryRange, setSelectedPlantId]);

  useEffect(() => {
    fetchInverter();
  }, [fetchInverter]);

  if (isLoading) {
    return <LoadingState message={`Loading telemetry for Inverter ${inverterId}...`} />;
  }

  if (error || !inverter) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Inverter Not Found"
          subtitle={`The inverter hardware unit "${inverterId}" was not found in the fleet.`}
          breadcrumbs={[
            { label: 'Platform', href: '/dashboard' },
            { label: 'Inverters', href: '/inverters' },
            { label: 'Not Found' },
          ]}
        />
        <ErrorState
          title="Inverter Unit Unavailable"
          message={error || 'The requested inverter serial or identifier does not exist.'}
          actionText="Back to Inverters Fleet"
          onAction={() => navigate('/inverters')}
        />
      </div>
    );
  }

  // Safe KPI formatting respecting DATA RULES: Missing reading must not be displayed as zero
  const acPowerDisplay = inverter.acPowerKw !== null && inverter.acPowerKw !== undefined
    ? formatPower(inverter.acPowerKw)
    : '--';

  const dcVoltageDisplay = inverter.dcVoltageV !== null && inverter.dcVoltageV !== undefined
    ? formatVoltage(inverter.dcVoltageV)
    : '--';

  const dcCurrentDisplay = inverter.dcCurrentA !== null && inverter.dcCurrentA !== undefined
    ? formatCurrent(inverter.dcCurrentA)
    : '--';

  const gridVoltageDisplay = inverter.acVoltageV !== null && inverter.acVoltageV !== undefined
    ? formatVoltage(inverter.acVoltageV)
    : '--';

  const tempDisplay = inverter.temperatureC !== null && inverter.temperatureC !== undefined
    ? `${inverter.temperatureC} °C`
    : '--';

  const todayEnergyDisplay = inverter.todayEnergyKwh !== null && inverter.todayEnergyKwh !== undefined
    ? formatEnergy(inverter.todayEnergyKwh)
    : '--';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header with Breadcrumbs, Diagnostic Badge, and Actions */}
      <PageHeader
        title={`Inverter Unit: ${inverter.id}`}
        subtitle={`${inverter.manufacturer} ${inverter.model} • Plant: ${inverter.plantName}`}
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Inverters', href: '/inverters' },
          { label: inverter.id },
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Link
              to="/inverters"
              className="sm-btn sm-btn-outline sm-btn-sm"
              style={{ textDecoration: 'none' }}
              aria-label="Back to Inverters Fleet"
            >
              <ArrowLeft size={14} />
              <span>Inverters Fleet</span>
            </Link>
            <Link
              to={`/plants/${inverter.plantId}`}
              className="sm-btn sm-btn-outline sm-btn-sm"
              style={{ textDecoration: 'none' }}
              aria-label={`View ${inverter.plantName}`}
            >
              <Building2 size={14} />
              <span>Plant Overview</span>
            </Link>
            <InverterDiagnosticBadge status={inverter.status} size="md" />
          </div>
        }
      />

      {/* 2. Primary 6 KPI Stat Cards (with safe missing readings rendering) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        {/* AC Power */}
        <StatCard
          title="Active AC Power"
          value={acPowerDisplay}
          subtext={`Rated: ${formatCapacity(inverter.ratedAcPowerKw)}`}
          icon={Zap}
          variant="primary"
        />

        {/* DC MPPT Input */}
        <StatCard
          title="DC MPPT Input"
          value={dcVoltageDisplay}
          subtext={`DC Current: ${dcCurrentDisplay}`}
          icon={Activity}
          variant="info"
        />

        {/* AC Grid Voltage & Frequency */}
        <StatCard
          title="AC Grid Voltage"
          value={gridVoltageDisplay}
          subtext={`Grid Freq: ${inverter.acFrequencyHz ? `${inverter.acFrequencyHz} Hz` : '--'}`}
          icon={Gauge}
          variant="success"
        />

        {/* Operating Internal Temperature */}
        <StatCard
          title="Internal Inverter Temp"
          value={tempDisplay}
          subtext={
            inverter.temperatureC !== null
              ? `Warning limit: ${inverter.maxTempThresholdC || 65}°C`
              : 'Sensor not installed / telemetry null'
          }
          icon={Thermometer}
          variant={
            inverter.temperatureC === null
              ? 'default'
              : inverter.temperatureC > 60
              ? 'danger'
              : inverter.temperatureC > 50
              ? 'warning'
              : 'success'
          }
        />

        {/* Today's Generation */}
        <StatCard
          title="Energy Generated Today"
          value={todayEnergyDisplay}
          subtext={`Lifetime: ${inverter.cumulativeEnergyMwh ? `${inverter.cumulativeEnergyMwh} MWh` : '--'}`}
          icon={Sun}
          variant="success"
        />

        {/* Inverter Inversion Efficiency */}
        <StatCard
          title="Inversion Efficiency"
          value={inverter.efficiencyPercent !== null && inverter.efficiencyPercent !== undefined ? `${inverter.efficiencyPercent}%` : '--'}
          subtext={inverter.acPowerKw > 0 ? 'Active MPPT tracking' : 'Standby / Idle'}
          icon={Cpu}
          variant={inverter.efficiencyPercent >= 95 ? 'success' : inverter.efficiencyPercent > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* 3. PV String & MPPT Channel Architecture Topology */}
      <InverterStringTopologyCard
        mpptConfiguration={inverter.mpptConfiguration}
        inverterName={inverter.name || inverter.id}
      />

      {/* 4. High-Resolution Telemetry Waveforms (Power, Voltage, Current, Temp) */}
      <InverterTelemetryTrends
        telemetryHistory={inverter.telemetryHistory}
        inverterName={inverter.id}
        maxTempThresholdC={inverter.maxTempThresholdC}
      />

      {/* 5. Hardware Specifications & Operating Metadata */}
      <InverterSpecsCard inverter={inverter} />

      {/* 6. Active Hardware Fault Alarms & Historical Fault Log */}
      <InverterFaultsHistoryCard
        activeFaults={inverter.activeFaults}
        historicalFaults={inverter.historicalFaults}
        inverterName={inverter.id}
      />
    </div>
  );
};

export default InverterDetailPage;
