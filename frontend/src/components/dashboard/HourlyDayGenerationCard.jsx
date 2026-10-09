import { useState } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  Zap,
  TrendingDown,
  Info,
  Calendar,
  Compass,
  Gauge,
  Thermometer,
  Layers,
} from 'lucide-react';
import { Card, Badge, Button } from '../common';
import { formatPower, formatEnergy, formatCurrency } from '../../utils/formatters';

const HOURLY_DAY_DATA = [
  {
    hour: '06:00',
    timeLabel: '6:00 AM',
    weatherIcon: '🌅',
    weatherLabel: 'Dawn / Sunrise',
    actualKw: 0.25,
    expectedKw: 0.30,
    irradianceWm2: 85,
    ambientTempC: 21.5,
    moduleTempC: 22.0,
    vDc: 240.2,
    iDc: 1.1,
    vAc: 228.4,
    gridFreqHz: 50.02,
    deficitKw: 0.05,
    status: 'NORMAL',
  },
  {
    hour: '07:00',
    timeLabel: '7:00 AM',
    weatherIcon: '🌤️',
    weatherLabel: 'Low Sun Clear',
    actualKw: 1.10,
    expectedKw: 1.25,
    irradianceWm2: 240,
    ambientTempC: 23.8,
    moduleTempC: 26.2,
    vDc: 310.5,
    iDc: 3.6,
    vAc: 229.1,
    gridFreqHz: 49.98,
    deficitKw: 0.15,
    status: 'NORMAL',
  },
  {
    hour: '08:00',
    timeLabel: '8:00 AM',
    weatherIcon: '☀️',
    weatherLabel: 'Clear Sky',
    actualKw: 2.10,
    expectedKw: 2.30,
    irradianceWm2: 450,
    ambientTempC: 26.1,
    moduleTempC: 32.0,
    vDc: 355.2,
    iDc: 6.0,
    vAc: 230.5,
    gridFreqHz: 50.01,
    deficitKw: 0.20,
    status: 'NORMAL',
  },
  {
    hour: '09:00',
    timeLabel: '9:00 AM',
    weatherIcon: '🌤️',
    weatherLabel: 'Passing Wisps',
    actualKw: 2.80,
    expectedKw: 3.20,
    irradianceWm2: 650,
    ambientTempC: 28.4,
    moduleTempC: 38.5,
    vDc: 370.4,
    iDc: 7.7,
    vAc: 231.2,
    gridFreqHz: 50.03,
    deficitKw: 0.40,
    status: 'MINOR_GAP',
  },
  {
    hour: '10:00',
    timeLabel: '10:00 AM',
    weatherIcon: '⛅',
    weatherLabel: 'Partial Cloud',
    actualKw: 3.40,
    expectedKw: 4.10,
    irradianceWm2: 820,
    ambientTempC: 30.5,
    moduleTempC: 44.2,
    vDc: 382.1,
    iDc: 9.0,
    vAc: 232.0,
    gridFreqHz: 50.00,
    deficitKw: 0.70,
    status: 'SHADING_GAP',
  },
  {
    hour: '11:00',
    timeLabel: '11:00 AM',
    weatherIcon: '🌥️',
    weatherLabel: 'Overcast Patch',
    actualKw: 3.00,
    expectedKw: 4.80,
    irradianceWm2: 700,
    ambientTempC: 32.1,
    moduleTempC: 47.0,
    vDc: 368.5,
    iDc: 8.3,
    vAc: 233.1,
    gridFreqHz: 49.95,
    deficitKw: 1.80,
    status: 'ANOMALY',
  },
  {
    hour: '12:00',
    timeLabel: '12:00 PM',
    weatherIcon: '🌦️',
    weatherLabel: 'Cloud Shadow',
    actualKw: 2.30,
    expectedKw: 5.20,
    irradianceWm2: 500,
    ambientTempC: 33.0,
    moduleTempC: 46.1,
    vDc: 350.0,
    iDc: 6.7,
    vAc: 234.0,
    gridFreqHz: 50.02,
    deficitKw: 2.90,
    status: 'ANOMALY',
  },
  {
    hour: '13:00',
    timeLabel: '1:00 PM',
    weatherIcon: '🌧️',
    weatherLabel: 'Brief Shower',
    actualKw: 1.40,
    expectedKw: 5.10,
    irradianceWm2: 300,
    ambientTempC: 31.0,
    moduleTempC: 39.5,
    vDc: 330.2,
    iDc: 4.3,
    vAc: 235.2,
    gridFreqHz: 50.15,
    deficitKw: 3.70,
    status: 'WEATHER_OUTAGE',
  },
  {
    hour: '14:00',
    timeLabel: '2:00 PM',
    weatherIcon: '🌥️',
    weatherLabel: 'Clearing Clouds',
    actualKw: 2.50,
    expectedKw: 4.60,
    irradianceWm2: 550,
    ambientTempC: 31.8,
    moduleTempC: 42.0,
    vDc: 358.4,
    iDc: 7.1,
    vAc: 233.8,
    gridFreqHz: 50.08,
    deficitKw: 2.10,
    status: 'ANOMALY',
  },
  {
    hour: '15:00',
    timeLabel: '3:00 PM',
    weatherIcon: '🌤️',
    weatherLabel: 'Bright Afternoon',
    actualKw: 3.10,
    expectedKw: 3.80,
    irradianceWm2: 720,
    ambientTempC: 30.9,
    moduleTempC: 41.5,
    vDc: 375.0,
    iDc: 8.4,
    vAc: 232.5,
    gridFreqHz: 50.04,
    deficitKw: 0.70,
    status: 'MINOR_GAP',
  },
  {
    hour: '16:00',
    timeLabel: '4:00 PM',
    weatherIcon: '🌤️',
    weatherLabel: 'Late Sun',
    actualKw: 2.10,
    expectedKw: 2.50,
    irradianceWm2: 480,
    ambientTempC: 29.2,
    moduleTempC: 35.8,
    vDc: 352.0,
    iDc: 6.1,
    vAc: 230.8,
    gridFreqHz: 50.01,
    deficitKw: 0.40,
    status: 'NORMAL',
  },
  {
    hour: '17:00',
    timeLabel: '5:00 PM',
    weatherIcon: '🌅',
    weatherLabel: 'Golden Hour',
    actualKw: 0.90,
    expectedKw: 1.10,
    irradianceWm2: 210,
    ambientTempC: 27.5,
    moduleTempC: 29.0,
    vDc: 295.0,
    iDc: 3.1,
    vAc: 229.5,
    gridFreqHz: 50.00,
    deficitKw: 0.20,
    status: 'NORMAL',
  },
];

export const HourlyDayGenerationCard = () => {
  const [selectedHourIndex, setSelectedHourIndex] = useState(6); // Default 12:00 PM peak
  const activeHour = HOURLY_DAY_DATA[selectedHourIndex];

  // Daily totals
  const totalActualKwh = HOURLY_DAY_DATA.reduce((sum, h) => sum + h.actualKw, 0);
  const totalExpectedKwh = HOURLY_DAY_DATA.reduce((sum, h) => sum + h.expectedKw, 0);
  const totalDeficitKwh = totalExpectedKwh - totalActualKwh;
  const maxKw = Math.max(...HOURLY_DAY_DATA.map((h) => h.expectedKw));

  return (
    <Card className="sm-card">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Calendar size={18} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              Hourly Generation & Weather Context Today
            </h3>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Hour-by-hour active power output (kW) vs weather-adjusted physical baseline across daylight hours.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Badge variant="primary">Single-Day Hourly Slice</Badge>
          <Badge variant={totalDeficitKwh > 3 ? 'warning' : 'success'}>
            Gap: -{totalDeficitKwh.toFixed(1)} kWh
          </Badge>
        </div>
      </div>

      {/* Hourly Strip / Bar Track */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-5)',
        }}
      >
        {HOURLY_DAY_DATA.map((item, idx) => {
          const isSelected = idx === selectedHourIndex;
          const actualHeightPct = Math.round((item.actualKw / maxKw) * 100);
          const expectedHeightPct = Math.round((item.expectedKw / maxKw) * 100);

          return (
            <button
              key={item.hour}
              type="button"
              onClick={() => setSelectedHourIndex(idx)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: 'var(--space-2) 4px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg-subtle)',
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                outline: 'none',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)' }}>
                {item.hour}
              </span>
              <span style={{ fontSize: '18px', margin: '4px 0' }}>{item.weatherIcon}</span>

              {/* Dual Bar Track (Expected vs Actual) */}
              <div
                style={{
                  height: '60px',
                  width: '26px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '2px',
                  backgroundColor: 'var(--color-bg-muted)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px',
                  margin: '4px 0',
                }}
              >
                {/* Expected Baseline Bar */}
                <div
                  style={{
                    width: '9px',
                    height: `${expectedHeightPct}%`,
                    backgroundColor: 'var(--color-border-strong)',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.6,
                  }}
                  title={`Expected: ${item.expectedKw} kW`}
                />
                {/* Actual Generation Bar */}
                <div
                  style={{
                    width: '11px',
                    height: `${actualHeightPct}%`,
                    backgroundColor: item.deficitKw > 1.5 ? 'var(--color-warning)' : 'var(--color-primary)',
                    borderRadius: '2px 2px 0 0',
                  }}
                  title={`Actual: ${item.actualKw} kW`}
                />
              </div>

              <strong style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>
                {item.actualKw.toFixed(1)} <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>kW</span>
              </strong>
            </button>
          );
        })}
      </div>

      {/* Selected Hour Detailed Inspector Card */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
            Selected Hour Window
          </span>
          <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
            {activeHour.timeLabel} ({activeHour.weatherIcon} {activeHour.weatherLabel})
          </strong>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            POA Irradiance: <strong>{activeHour.irradianceWm2} W/m²</strong> | Amb: <strong>{activeHour.ambientTempC}°C</strong>
          </p>
        </div>

        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
            Active vs Expected Power
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: '2px' }}>
            <strong style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-primary)' }}>
              {activeHour.actualKw.toFixed(2)} kW
            </strong>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              / {activeHour.expectedKw.toFixed(2)} kW expected
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 'var(--font-weight-semibold)',
              color: activeHour.deficitKw > 1 ? 'var(--color-danger)' : 'var(--color-success)',
            }}
          >
            {activeHour.deficitKw > 0 ? `Deficit: -${activeHour.deficitKw.toFixed(2)} kW` : 'Yield on Track'}
          </span>
        </div>

        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
            DC String Signatures
          </span>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', marginTop: '4px', lineHeight: 1.6 }}>
            <span>V_DC: <strong>{activeHour.vDc} V</strong></span> • <span>I_DC: <strong>{activeHour.iDc} A</strong></span><br />
            <span>V_AC Grid: <strong>{activeHour.vAc} V</strong></span> • <span>Freq: <strong>{activeHour.gridFreqHz} Hz</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Diagnostic Assessment
          </span>
          <div style={{ marginTop: '4px' }}>
            {activeHour.status === 'ANOMALY' && (
              <Badge variant="danger">High Yield Deficit Alert</Badge>
            )}
            {activeHour.status === 'SHADING_GAP' && (
              <Badge variant="warning">Diurnal Shading Pattern</Badge>
            )}
            {activeHour.status === 'WEATHER_OUTAGE' && (
              <Badge variant="warning">Cloud / Rain Attenuation</Badge>
            )}
            {activeHour.status === 'NORMAL' && (
              <Badge variant="success">Optimal Physical Operation</Badge>
            )}
            {activeHour.status === 'MINOR_GAP' && (
              <Badge variant="info">Passing Cloud Fluctuations</Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default HourlyDayGenerationCard;
