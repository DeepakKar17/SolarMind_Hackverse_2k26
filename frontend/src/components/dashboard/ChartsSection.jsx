import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  Activity,
  PieChart as PieIcon,
  CalendarDays,
  Building2,
} from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';
import { Card } from '../common';
import { formatPower, formatEnergy, formatCurrency } from '../../utils/formatters';

// Custom Tooltip for Power Curves
const PowerTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const actual = payload.find((p) => p.dataKey === 'actualKw')?.value ?? 0;
    const expected = payload.find((p) => p.dataKey === 'expectedKw')?.value;
    const poa = payload.find((p) => p.dataKey === 'irradiancePoa')?.value;
    const deficit = expected !== undefined ? Math.max(0, expected - actual) : 0;

    return (
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          boxShadow: 'var(--shadow-xl)',
          fontSize: '12px',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '6px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
          Time: {label}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#60a5fa' }}>
          <span>Actual Power:</span>
          <strong>{formatPower(actual)}</strong>
        </div>
        {expected !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#34d399' }}>
            <span>Expected Power:</span>
            <strong>{formatPower(expected)}</strong>
          </div>
        )}
        {poa !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#fbbf24' }}>
            <span>POA Irradiance:</span>
            <strong>{poa} W/m²</strong>
          </div>
        )}
        {deficit > 0.2 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#f87171', marginTop: '4px', borderTop: '1px solid #334155', paddingTop: '4px' }}>
            <span>Deficit:</span>
            <strong>-{formatPower(deficit)}</strong>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Loss Chart
const LossTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          boxShadow: 'var(--shadow-xl)',
          fontSize: '12px',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '6px' }}>{label}</div>
        <div style={{ color: '#f59e0b', marginBottom: '2px' }}>
          Lost Energy: <strong>{formatEnergy(data.lostKwh)}</strong>
        </div>
        <div style={{ color: '#ef4444', marginBottom: '2px' }}>
          Financial Impact: <strong>{formatCurrency(data.financialLossInr)}</strong>
        </div>
        {data.primaryFault && (
          <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
            Primary Driver: <em>{data.primaryFault}</em>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const ChartsSection = () => {
  const {
    telemetrySeries,
    faultDistribution,
    dailyLossSeries,
    plantComparisons,
  } = useSolarData();

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
      {/* Top Row: Dual Curves & Expected vs Actual */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Chart 1: Actual Generation Over Time */}
        <Card
          title="1. Actual Generation Profile (Today)"
          subtitle="Real-time inverter AC output power curves across daylight hours."
          headerRight={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
              <Activity size={14} />
              <span>Inverter AC (kW)</span>
            </div>
          }
        >
          <div style={{ width: '100%', height: '280px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <AreaChart data={telemetrySeries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualOnlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" kW" />
                <Tooltip content={<PowerTooltip />} />
                <Area
                  type="monotone"
                  dataKey="actualKw"
                  name="Actual Power"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#actualOnlyGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Expected vs Actual Generation */}
        <Card
          title="2. Expected vs. Actual Generation"
          subtitle="Clear-sky physical POA yield model vs. measured inverter generation."
          headerRight={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: 'var(--font-size-xs)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669' }}>
                <span style={{ width: '10px', height: '3px', backgroundColor: '#059669', borderRadius: '2px' }} />
                Expected
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb' }}>
                <span style={{ width: '10px', height: '3px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
                Actual
              </span>
            </div>
          }
        >
          <div style={{ width: '100%', height: '280px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <AreaChart data={telemetrySeries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="expectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="actualDualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" kW" />
                <Tooltip content={<PowerTooltip />} />
                <Area
                  type="monotone"
                  dataKey="expectedKw"
                  name="Expected Power"
                  stroke="#059669"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#expectedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="actualKw"
                  name="Actual Power"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#actualDualGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Middle Row: Fault Categories Breakdown & Energy Loss Impact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Chart 3: Fault Categories by Count & Impact */}
        <Card
          title="3. Fault Categories by Occurrence"
          subtitle="Diagnostic distribution of single-string anomalies across period."
          headerRight={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              <PieIcon size={14} />
              <span>Anomaly Count</span>
            </div>
          }
        >
          <div style={{ width: '100%', height: '280px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart
                data={faultDistribution}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 40, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="category"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  width={130}
                />
                <Tooltip
                  formatter={(value, name, item) => [
                    `${value} occurrences (${item.payload.lostKwh} kWh lost / ₹${item.payload.financialLossInr})`,
                    'Count',
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {faultDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 4: Energy Loss by Date */}
        <Card
          title="4. Energy Loss Trend & Monetary Impact"
          subtitle="Daily lost kilowatt-hours and financial deficit in ₹."
          headerRight={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
              <CalendarDays size={14} />
              <span>Lost Generation (kWh)</span>
            </div>
          }
        >
          <div style={{ width: '100%', height: '280px', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart data={dailyLossSeries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" kWh" />
                <Tooltip content={<LossTooltip />} />
                <Bar dataKey="lostKwh" name="Energy Lost (kWh)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Full-Width Row: Chart 5: Plant Performance Comparison */}
      <Card
        title="5. Plant Performance Comparison"
        subtitle="Benchmark Performance Ratio (PR %) and Specific Yield (kWh/kWp) across multi-plant fleet."
        headerRight={
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
            <Building2 size={14} />
            <span>Fleet Analytics</span>
          </div>
        }
      >
        <div style={{ width: '100%', height: '260px', minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
            <BarChart data={plantComparisons} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="plantName" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'performanceRatio') return [`${value}%`, 'Performance Ratio'];
                  return [`${value} kWh/kWp`, 'Specific Yield'];
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(val) => (val === 'performanceRatio' ? 'Performance Ratio (PR %)' : 'Specific Yield (kWh/kWp)')}
              />
              <Bar dataKey="performanceRatio" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
};

export default ChartsSection;
