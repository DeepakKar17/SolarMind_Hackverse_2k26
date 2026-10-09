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
} from 'recharts';
import { Card } from '../common';
import { Activity } from 'lucide-react';

export const DiagnosisTelemetryTimeline = ({ timelineTelemetry = [], faultTitle }) => {
  if (!timelineTelemetry || timelineTelemetry.length === 0) {
    return (
      <Card title="Timeline of Relevant Telemetry">
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
          High-resolution waveform telemetry not available for this historical incident window.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Timeline of Anomaly Onset Window"
      subtitle={`Measured generation vs expected clear-sky baseline during ${faultTitle}`}
    >
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timelineTelemetry} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="diagMeasuredGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
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
              dataKey="measuredKw"
              name="Measured Active Power (kW)"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#diagMeasuredGrad)"
            />
            <Area
              type="monotone"
              dataKey="expectedKw"
              name="Clear-Sky Expected Model (kW)"
              stroke="#16a34a"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="none"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default DiagnosisTelemetryTimeline;
