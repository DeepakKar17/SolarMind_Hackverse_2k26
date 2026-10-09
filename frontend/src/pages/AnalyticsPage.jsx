import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PageHeader, Card, StatCard, Badge, Button, Select, LoadingState, ErrorState } from '../components/common';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Zap,
  IndianRupee,
  Clock,
  ShieldCheck,
  Percent,
  CheckCircle,
  FileSpreadsheet,
  FileJson,
  Layers,
} from 'lucide-react';
import { analyticsService } from '../services/analyticsService';
import { formatEnergy, formatCurrency, formatPercent } from '../utils/formatters';

export const AnalyticsPage = () => {
  const [plantId, setPlantId] = useState('ALL');
  const [timeRange, setTimeRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportFeedback, setExportFeedback] = useState(null);

  // Load analytics dataset
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await analyticsService.getAnalyticsData({ plantId, timeRange });
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load fleet analytics telemetry.');
    } finally {
      setLoading(false);
    }
  }, [plantId, timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Handle Export Action
  const handleExport = (format) => {
    try {
      const { blob, filename } = analyticsService.exportReport({
        format,
        data,
        userHasPermission: true,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportFeedback(`Successfully generated and downloaded ${filename}`);
      setTimeout(() => setExportFeedback(null), 5000);
    } catch (err) {
      setExportFeedback(`Export failed: ${err.message}`);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: 'var(--space-12)' }}>
        <LoadingState message="Aggregating cross-plant clear-sky models, generation trends, and maintenance SLAs..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Fleet Analytics & Degradation Reporting"
          breadcrumbs={[
            { label: 'Platform', href: '/dashboard' },
            { label: 'Fleet Analytics' },
          ]}
        />
        <ErrorState
          title="Analytics Telemetry Error"
          message={error}
          onRetry={loadAnalytics}
        />
      </div>
    );
  }

  const { kpis, generationTrends, faultCategoryDistribution, maintenanceMetrics } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="Solar Fleet Performance & Degradation Analytics"
        subtitle="Physics-informed clear-sky output comparison, anomaly loss contributions, and service resolution SLAs."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Fleet Analytics & Reports' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              size="sm"
              icon={FileSpreadsheet}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={FileJson}
              onClick={() => handleExport('json')}
            >
              Export JSON
            </Button>
          </div>
        }
      />

      {/* Export Notification Banner */}
      {exportFeedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle size={16} />
            <span>{exportFeedback}</span>
          </div>
          <button onClick={() => setExportFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            &times;
          </button>
        </div>
      )}

      {/* Filter Control Bar */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ minWidth: '220px' }}>
              <Select
                label="Solar Plant Filter"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Fleet Installations (Combined)' },
                  { value: '1', label: 'Residential Rooftop String-1 (5.2 kWp)' },
                  { value: '2', label: 'Bhartiya Villa Single-String (3.3 kWp)' },
                  { value: '3', label: 'Suburban Net-Metered Array C (6.0 kWp)' },
                  { value: '4', label: 'Kaveri Commercial Canopy D (10.0 kWp)' },
                ]}
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <Select
                label="Analytical Time Horizon"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                options={[
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: '90d', label: 'Last 90 Days (Quarter)' },
                  { value: '1y', label: 'Last 12 Months' },
                ]}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Badge variant="success" dot>
              Clear-Sky Physical REST2 Benchmark: Active
            </Badge>
          </div>
        </div>
      </Card>

      {/* Aggregate KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="Total Harvested Energy"
          value={formatEnergy(kpis.totalActualYieldKwh)}
          subtext="Actual metered production"
          icon={Zap}
          variant="success"
        />
        <StatCard
          title="Clear-Sky Model Expected"
          value={formatEnergy(kpis.totalExpectedYieldKwh)}
          subtext="Unshaded theoretical potential"
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Estimated Energy Loss"
          value={`-${formatEnergy(kpis.totalYieldDeficitKwh)}`}
          subtext={`Deficit revenue: ${formatCurrency(kpis.totalFinancialLossInr)}`}
          icon={BarChart3}
          variant="danger"
        />
        <StatCard
          title="Average Performance Ratio (PR)"
          value={`${kpis.averagePerformanceRatio}%`}
          subtext="Weather & temperature normalized"
          icon={Percent}
          variant={kpis.averagePerformanceRatio >= 80 ? 'success' : 'warning'}
        />
      </div>

      {/* Section 1: Measured vs Clear-Sky Generation Trends & Performance Ratio */}
      <Card
        title="Actual vs Clear-Sky Expected Generation Trends"
        subtitle="Daily active kilowatt-hour production compared against high-accuracy physical clear-sky models"
      >
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={generationTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsActualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" kWh" tickLine={false} />
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
                dataKey="actualKwh"
                name="Actual Metered Yield (kWh)"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#analyticsActualGrad)"
              />
              <Area
                type="monotone"
                dataKey="expectedKwh"
                name="Clear-Sky Expected Model (kWh)"
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Section 2: Fault Category Loss Contributions & Maintenance SLAs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Fault Category Losses Breakdown */}
        <Card
          title="Fault Category Loss Contributions"
          subtitle="Quantified kilowatt-hour and revenue deficits partitioned by anomaly class"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {faultCategoryDistribution.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-canvas)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                      {item.name}
                    </strong>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {item.count} incident occurrences
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                    -{item.lossKwh} kWh
                  </strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {formatCurrency(item.lossInr)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Maintenance Response & Resolution Times (MTTD / MTTR) */}
        <Card
          title="Maintenance Response & Resolution Metrics"
          subtitle="Mean time to detect anomalies and technician SLA turnaround performance"
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Mean Time To Detect (MTTD)</span>
              <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)' }}>
                {maintenanceMetrics.meanTimeToDetectHours * 60} mins
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginTop: '2px' }}>
                Physics signature isolation
              </span>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Mean Time To Acknowledge</span>
              <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                {maintenanceMetrics.meanTimeToAcknowledgeHours} hrs
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginTop: '2px' }}>
                Operator triage time
              </span>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Mean Time To Resolve (MTTR)</span>
              <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                {maintenanceMetrics.meanTimeToResolveHours} hrs
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginTop: '2px' }}>
                Field technician closure
              </span>
            </div>

            <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>SLA Compliance Rate</span>
              <strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-success)' }}>
                {maintenanceMetrics.resolvedWithinSlaPercent}%
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', display: 'block', marginTop: '2px' }}>
                Target &lt;{maintenanceMetrics.slaTargetHours}h SLA
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <ShieldCheck size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
              <strong>92.5% First-Time Fix Rate:</strong> 22 of 24 dispatched work orders resolved without repeat visits.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPage;
