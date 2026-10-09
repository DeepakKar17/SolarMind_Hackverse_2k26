import { Zap, SunMedium, Gauge, BatteryCharging, RefreshCw } from 'lucide-react';
import MetricCard from '../common/MetricCard';
import { useSolarData } from '../../hooks/useSolarData';
import { formatPower, formatEnergy } from '../../utils/formatters';

export const LiveOverview = () => {
  const { telemetry, systemConfig, refreshLiveTelemetry } = useSolarData();

  return (
    <section style={{ marginBottom: 'var(--spacing-8)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Live Generation Telemetry</span>
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Single String: {systemConfig.panelCount}x {systemConfig.panelWattage}W panels ({systemConfig.ratedPowerKw} kW rated DC)
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={refreshLiveTelemetry}
          title="Poll latest telemetry snapshot"
        >
          <RefreshCw size={14} />
          <span>Refresh Snapshot</span>
        </button>
      </div>

      <div className="grid-cols-4">
        <MetricCard
          title="Active AC Generation"
          value={formatPower(telemetry.acPower)}
          subvalue={`DC Input: ${formatPower(telemetry.dcPower)} (${telemetry.dcVoltage}V / ${telemetry.dcCurrent}A)`}
          icon={Zap}
          accentColor="var(--color-solar-primary)"
        />

        <MetricCard
          title="Today's Total Yield"
          value={formatEnergy(telemetry.dailyYieldKwh)}
          subvalue={`Lifetime: ${telemetry.totalYieldKwh.toLocaleString()} kWh`}
          icon={BatteryCharging}
          accentColor="var(--color-success)"
        />

        <MetricCard
          title="Solar POA Irradiance"
          value={`${telemetry.irradiancePoa} W/m²`}
          subvalue={`Ambient Temp: ${telemetry.ambientTempC}°C`}
          icon={SunMedium}
          accentColor="var(--color-warning)"
        />

        <MetricCard
          title="Inverter Performance"
          value={`${telemetry.performanceRatio}%`}
          subvalue={`Internal Temp: ${telemetry.inverterTempC}°C (Optimal)`}
          icon={Gauge}
          accentColor="var(--color-info)"
        />
      </div>
    </section>
  );
};

export default LiveOverview;
