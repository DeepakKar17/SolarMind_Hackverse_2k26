import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSolarData } from '../../hooks/useSolarData';
import { TrendingUp, AlertTriangle } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const actual = payload.find((p) => p.dataKey === 'actualKw')?.value || 0;
    const expected = payload.find((p) => p.dataKey === 'expectedKw')?.value || 0;
    const deficit = Math.max(0, expected - actual);

    return (
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '13px',
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
          Time: {label}
        </div>
        <div style={{ color: 'var(--color-solar-light)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span>Actual Power:</span>
          <strong>{actual.toFixed(2)} kW</strong>
        </div>
        <div style={{ color: '#06b6d4', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
          <span>Expected Yield:</span>
          <strong>{expected.toFixed(2)} kW</strong>
        </div>
        {deficit > 0.3 && (
          <div style={{ color: 'var(--color-danger)', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} />
            <span>Deficit: -{deficit.toFixed(2)} kW</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const PowerGenerationChart = () => {
  const { powerCurves } = useSolarData();

  return (
    <div className="glass-card" style={{ marginBottom: 'var(--spacing-8)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-6)',
          gap: 'var(--spacing-3)',
        }}
      >
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="var(--color-solar-primary)" />
            <span>Generation Curve: Actual vs. Clear-Sky Expected</span>
          </h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Comparing measured inverter AC output against physical POA solar irradiance model.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: 'var(--font-size-xs)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-solar-light)' }}>
            <span style={{ width: '12px', height: '3px', background: '#f59e0b', borderRadius: '2px' }} />
            Actual Power (kW)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#06b6d4' }}>
            <span style={{ width: '12px', height: '3px', background: '#06b6d4', borderRadius: '2px' }} />
            Physics Expected (kW)
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: '340px', minWidth: '0' }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
          <AreaChart data={powerCurves} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="expectedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
            <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} unit=" kW" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="expectedKw"
              name="Expected Power"
              stroke="#06b6d4"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#expectedGradient)"
            />
            <Area
              type="monotone"
              dataKey="actualKw"
              name="Actual Power"
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill="url(#actualGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PowerGenerationChart;
