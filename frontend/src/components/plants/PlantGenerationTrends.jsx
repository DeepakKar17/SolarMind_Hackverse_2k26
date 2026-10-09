import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { Card } from '../common';
import { TrendingUp, SunMedium } from 'lucide-react';

export const PlantGenerationTrends = ({ telemetrySeries = [], plantName }) => {
  // Weekly generation dummy data consistent with the plant
  const weeklyData = [
    { day: 'Mon', actualKwh: 24.5, expectedKwh: 28.0 },
    { day: 'Tue', actualKwh: 26.2, expectedKwh: 28.5 },
    { day: 'Wed', actualKwh: 25.8, expectedKwh: 29.0 },
    { day: 'Thu', actualKwh: 28.4, expectedKwh: 30.2 },
    { day: 'Fri', actualKwh: 24.8, expectedKwh: 29.5 },
    { day: 'Sat', actualKwh: 26.5, expectedKwh: 31.0 },
    { day: 'Sun (Today)', actualKwh: 27.2, expectedKwh: 31.8 },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 'var(--space-4)' }}>
      {/* Daylight Power Generation Curve */}
      <Card
        title="Daylight Generation vs Clear-Sky Model"
        subtitle={`Live AC power output (kW) across daylight hours for ${plantName}`}
      >
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetrySeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="plantActualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="plantExpectedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} unit="kW" tickLine={false} />
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
                dataKey="actualKw"
                name="Actual AC Power (kW)"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#plantActualGrad)"
              />
              <Area
                type="monotone"
                dataKey="expectedKw"
                name="Clear-Sky Model (kW)"
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#plantExpectedGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 7-Day Yield Comparison */}
      <Card
        title="7-Day Daily Energy Yield (kWh)"
        subtitle="Expected vs Actual cumulative daily energy generated"
      >
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} unit="kWh" tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="actualKwh" name="Actual Yield (kWh)" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expectedKwh" name="Expected Yield (kWh)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default PlantGenerationTrends;
