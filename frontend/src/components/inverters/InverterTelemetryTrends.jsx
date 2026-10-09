import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, Button } from '../common';
import { Zap, Gauge, Activity, Thermometer } from 'lucide-react';

export const InverterTelemetryTrends = ({ telemetryHistory = [], inverterName, maxTempThresholdC = 65.0 }) => {
  const [activeTab, setActiveTab] = useState('POWER'); // 'POWER' | 'VOLTAGE' | 'CURRENT' | 'TEMP'

  const hasTempData = telemetryHistory.some((item) => item.temperatureC !== null && item.temperatureC !== undefined);

  return (
    <Card
      title="High-Resolution Telemetry & Dynamic Operating Curves"
      subtitle={`Multi-channel electrical and thermal waveforms for ${inverterName}`}
      actions={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
          <Button
            variant={activeTab === 'POWER' ? 'primary' : 'ghost'}
            size="sm"
            icon={Zap}
            onClick={() => setActiveTab('POWER')}
          >
            Power (kW)
          </Button>
          <Button
            variant={activeTab === 'VOLTAGE' ? 'primary' : 'ghost'}
            size="sm"
            icon={Gauge}
            onClick={() => setActiveTab('VOLTAGE')}
          >
            Voltage (V)
          </Button>
          <Button
            variant={activeTab === 'CURRENT' ? 'primary' : 'ghost'}
            size="sm"
            icon={Activity}
            onClick={() => setActiveTab('CURRENT')}
          >
            Current (A)
          </Button>
          <Button
            variant={activeTab === 'TEMP' ? 'primary' : 'ghost'}
            size="sm"
            icon={Thermometer}
            onClick={() => setActiveTab('TEMP')}
          >
            Thermal (°C)
          </Button>
        </div>
      }
    >
      <div style={{ width: '100%', height: 280, marginTop: 'var(--space-2)' }}>
        {activeTab === 'POWER' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="invDcPowerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="invAcPowerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" kW" tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area
                type="monotone"
                dataKey="dcPowerKw"
                name="DC Input Power (kW)"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#invDcPowerGrad)"
              />
              <Area
                type="monotone"
                dataKey="acPowerKw"
                name="AC Output Power (kW)"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#invAcPowerGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'VOLTAGE' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" V" tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line
                type="monotone"
                dataKey="dcVoltageV"
                name="DC String Voltage (V)"
                stroke="#0284c7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="acVoltageV"
                name="AC Grid Voltage (V)"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'CURRENT' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" A" tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Line
                type="monotone"
                dataKey="dcCurrentA"
                name="DC String Current (A)"
                stroke="#d97706"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="acCurrentA"
                name="AC Output Current (A)"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'TEMP' && (
          hasTempData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetryHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" °C" domain={[20, 80]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {maxTempThresholdC && (
                  <ReferenceLine
                    y={maxTempThresholdC}
                    label={{ value: `Warning Limit (${maxTempThresholdC}°C)`, fill: '#ef4444', fontSize: 10, position: 'top' }}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="temperatureC"
                  name="Internal Inverter IGBT Temp (°C)"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <Thermometer size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <strong>Temperature Sensor Uninstalled or Telemetry Unavailable</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                This hardware model does not broadcast internal IGBT thermal probes. (Missing readings are not assumed zero).
              </p>
            </div>
          )
        )}
      </div>
    </Card>
  );
};

export default InverterTelemetryTrends;
