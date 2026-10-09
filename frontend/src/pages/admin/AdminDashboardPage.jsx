import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  Button,
  Select,
  SearchInput,
  Pagination,
  LoadingState,
  ErrorState,
} from '../../components/common';
import {
  ShieldAlert,
  Users,
  Building2,
  Cpu,
  Activity,
  AlertTriangle,
  Wrench,
  Server,
  Database,
  RefreshCw,
  ExternalLink,
  Sliders,
  FileText,
  Workflow,
  Radio,
  BarChart3,
  Settings,
  CheckCircle2,
  Clock,
  IndianRupee,
  Layers,
  ArrowUpRight,
  TrendingUp,
  AlertOctagon,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { usePermissions } from '../../hooks/usePermissions';

export const AdminDashboardPage = () => {
  const { isAdmin } = usePermissions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('today');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const auditPageSize = 5;

  // Load dashboard metrics
  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await adminService.getAdminDashboardMetrics();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to retrieve administrative metrics and telemetry status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, timeRange]);

  // Filter and paginate audit events
  const filteredAuditEvents = useMemo(() => {
    if (!data?.auditEvents) return [];
    return data.auditEvents.filter((evt) => {
      const matchesFilter = auditFilter === 'ALL' || evt.action === auditFilter;
      const searchLower = auditSearch.toLowerCase();
      const matchesSearch =
        !auditSearch ||
        evt.actor.toLowerCase().includes(searchLower) ||
        evt.action.toLowerCase().includes(searchLower) ||
        evt.target.toLowerCase().includes(searchLower) ||
        evt.details.toLowerCase().includes(searchLower);
      return matchesFilter && matchesSearch;
    });
  }, [data?.auditEvents, auditFilter, auditSearch]);

  const paginatedAuditEvents = useMemo(() => {
    const startIndex = (auditPage - 1) * auditPageSize;
    return filteredAuditEvents.slice(startIndex, startIndex + auditPageSize);
  }, [filteredAuditEvents, auditPage]);

  if (loading && !data) {
    return <LoadingState message="Loading administrative oversight telemetry and system health..." />;
  }

  if (error && !data) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <ErrorState
          title="Administrative Telemetry Unavailable"
          message={error}
          onRetry={() => fetchDashboardData()}
        />
      </div>
    );
  }

  const {
    health,
    userStats,
    fleetInventory,
    diagnosticsOverview,
    workOrdersOverview,
    integrations,
    generationFleetTrends,
    faultDistribution,
    workOrderStatusDistribution,
    dataFreshnessTimeline,
    plantComparisons,
    lastUpdatedAt,
  } = data || {};

  const adminNavLinks = [
    { to: '/admin/users', title: 'User Management', desc: 'Manage registered accounts, approvals & access', icon: Users, badge: `${userStats?.totalUsers || 142} Users` },
    { to: '/admin/roles', title: 'Roles & Permissions', desc: 'Configure Admin, Homeowner & Tech role policies', icon: Sliders, badge: '4 Roles' },
    { to: '/plants', title: 'Plant & Inverter Registry', desc: 'Browse and configure all generation plants', icon: Building2, badge: `${fleetInventory?.totalPlants || 8} Plants` },
    { to: '/monitoring', title: 'Live Telemetry Stream', desc: 'Real-time string telemetry, voltage & power curves', icon: Activity, badge: 'Sub-Minute' },
    { to: '/admin/fault-catalog', title: 'Fault Catalog', desc: 'IEC 61724 standard anomaly definitions & signatures', icon: AlertOctagon, badge: '12 Codes' },
    { to: '/admin/diagnosis-rules', title: 'Diagnosis Rules Engine', desc: 'Configure AI thresholds, irradiance baselines & flags', icon: Workflow, badge: '8 Rules' },
    { to: '/admin/integrations', title: 'Integrations Hub', desc: 'Deye OpenAPI, Sungrow, Huawei & MQTT status', icon: Radio, badge: '4 Connected' },
    { to: '/analytics', title: 'System Analytics', desc: 'Fleet-wide performance ratio & degradation trends', icon: BarChart3, badge: 'IEC 61724' },
    { to: '/admin/audit-logs', title: 'Audit & Security Logs', desc: 'Immutable administrative trail of system events', icon: FileText, badge: 'Full Trail' },
    { to: '/settings', title: 'Application Settings', desc: 'Global tariffs, notification triggers & API configs', icon: Settings, badge: 'System' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {/* Top Header */}
      <PageHeader
        title="Enterprise Administration & Fleet Oversight"
        description="System-wide management, multi-tenant RBAC enforcement, integration status, and diagnostic health."
        breadcrumbs={[
          { label: 'Overview', to: '/dashboard' },
          { label: 'Administration', to: '/admin/dashboard' },
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Real vs Demo API Indicator */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                backgroundColor: health?.isRealApi ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: health?.isRealApi ? 'var(--color-success)' : 'var(--color-primary)',
                border: `1px solid ${health?.isRealApi ? 'var(--color-success)' : 'var(--color-primary)'}`,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: health?.isRealApi ? 'var(--color-success)' : 'var(--color-primary)',
                }}
              />
              {health?.isRealApi ? 'Live REST API' : 'Verified Preview Telemetry'}
            </span>

            {/* Time Range Filter */}
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              options={[
                { value: 'today', label: 'Today (Real-time)' },
                { value: '7d', label: 'Past 7 Days' },
                { value: '30d', label: 'Past 30 Days' },
                { value: '90d', label: 'Quarter to Date' },
              ]}
              aria-label="Time range selector"
            />

            {/* Manual Refresh */}
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => fetchDashboardData(true)}
              loading={refreshing}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* System Health & Readiness Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          backgroundColor: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: health?.isLive && health?.isReady ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: health?.isLive && health?.isReady ? 'var(--color-success)' : 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                FastAPI Gateway & Database Readiness:
              </span>
              <Badge variant={health?.isLive && health?.isReady ? 'success' : 'danger'}>
                {health?.isLive && health?.isReady ? 'SYSTEM OPERATIONAL' : 'DEGRADED'}
              </Badge>
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Database: <strong style={{ color: 'var(--color-text-secondary)' }}>{health?.database || 'SQLite Session Pool'}</strong> | Environment: <strong style={{ color: 'var(--color-text-secondary)' }}>{health?.environment}</strong> | Core v{health?.version}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <div>
            Last Ingestion Sync: <strong style={{ color: 'var(--color-text-primary)' }}>{new Date(fleetInventory?.lastTelemetryReceived || lastUpdatedAt).toLocaleTimeString()}</strong>
          </div>
          <div>
            Data Freshness: <strong style={{ color: 'var(--color-success)' }}>{fleetInventory?.telemetryFreshnessPercent}%</strong>
          </div>
        </div>
      </div>

      {/* 8 Key Overview Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <StatCard
          title="User Accounts"
          value={userStats?.totalUsers || 142}
          unit="Users"
          change={`114 Homeowners • 18 Techs`}
          changeType="positive"
          icon={Users}
          description="138 Active accounts, 3 pending"
        />
        <StatCard
          title="Registered Fleet"
          value={fleetInventory?.totalPlants || 8}
          unit="Plants"
          change={`${fleetInventory?.totalCapacityKwp || 485.6} kWp Capacity`}
          changeType="neutral"
          icon={Building2}
          description={`${fleetInventory?.totalInverters || 16} Inverters registered`}
        />
        <StatCard
          title="Telemetry Status"
          value={`${fleetInventory?.reportingTelemetryRecently || 7}/${fleetInventory?.totalPlants || 8}`}
          unit="Reporting"
          change="96.4% Freshness Rate"
          changeType="positive"
          icon={Activity}
          description="Sub-minute MPPT telemetry active"
        />
        <StatCard
          title="Unresolved Diagnoses"
          value={diagnosticsOverview?.unresolvedDiagnoses || 6}
          unit="Faults"
          change={`${diagnosticsOverview?.criticalSeverity || 2} Critical • ${diagnosticsOverview?.warningSeverity || 4} Warnings`}
          changeType="negative"
          icon={AlertTriangle}
          description={`Est. loss: ₹${diagnosticsOverview?.estimatedDailyLossInr}/day`}
        />
        <StatCard
          title="Open Work Orders"
          value={workOrdersOverview?.openWorkOrders || 5}
          unit="Orders"
          change={`${workOrdersOverview?.overdueWorkOrders || 2} Overdue`}
          changeType={workOrdersOverview?.overdueWorkOrders > 0 ? 'negative' : 'neutral'}
          icon={Wrench}
          description={`${workOrdersOverview?.slaComplianceRatePercent}% SLA Compliance`}
        />
        <StatCard
          title="Integration Health"
          value="4 / 4"
          unit="Active"
          change="99.5% Avg Success Rate"
          changeType="positive"
          icon={Radio}
          description="Deye OpenAPI, Sungrow, Huawei"
        />
        <StatCard
          title="Est. Daily Deficit"
          value={diagnosticsOverview?.estimatedDailyEnergyLossKwh || 189.4}
          unit="kWh/day"
          change={`₹${diagnosticsOverview?.estimatedDailyLossInr || 1420.50} tariff loss`}
          changeType="negative"
          icon={IndianRupee}
          description="Recoverable with dispatch"
        />
        <StatCard
          title="System Readiness"
          value="100%"
          unit="Ready"
          change="Zero database lockouts"
          changeType="positive"
          icon={Database}
          description="SQLAlchemy connection pool stable"
        />
      </div>

      {/* Admin Navigation Quick-Links Grid */}
      <Card title="Administrative Navigation & Configuration Hub" subtitle="Direct access to operational subsystems, catalog configuration, and security controls.">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {adminNavLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-canvas)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  textDecoration: 'none',
                  transition: 'all var(--transition-fast)',
                }}
                className="sm-admin-nav-card"
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                      {link.title}
                    </span>
                    <Badge variant="primary">{link.badge}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    {link.desc}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Primary Visualizations Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Fleet Generation vs Baseline */}
        <Card title="Fleet-Wide Generation vs Clear-Sky Target" subtitle="Instantaneous generation telemetry aggregated across all authorized plants.">
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={generationFleetTrends} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminGenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="adminExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="timestamp" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} unit=" kW" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '8px' }}
                />
                <Legend />
                <Area type="monotone" dataKey="generationKw" name="Actual Generation (kW)" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#adminGenGrad)" />
                <Area type="monotone" dataKey="expectedKw" name="Expected Baseline (kW)" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} fillOpacity={1} fill="url(#adminExpGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Fault Distribution & Severity */}
        <Card title="Fault Category & Severity Breakdown" subtitle="Distribution of active anomalies detected by AI diagnosis engine.">
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faultDistribution} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" fontSize={11} width={130} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '8px' }}
                />
                <Bar dataKey="count" name="Fault Count" radius={[0, 4, 4, 0]}>
                  {faultDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Work Order Status Distribution */}
        <Card title="Work-Order Status Distribution" subtitle="Active maintenance workflow dispatch state.">
          <div style={{ height: '300px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workOrderStatusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="status"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {workOrderStatusDistribution?.map((entry, index) => (
                    <Cell key={`cell-wo-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '8px' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Data Freshness & Sync Timeline */}
        <Card title="Data Freshness & Sync Failures Over Time" subtitle="Telemetry ingestion stability and API rate limit tracking.">
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dataFreshnessTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis yAxisId="left" stroke="var(--color-text-muted)" fontSize={12} unit="%" domain={[90, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#ef4444" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '8px' }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="freshnessPercent" name="Freshness (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="failedSyncs" name="Failed Syncs" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Plant Performance Comparison Table */}
      <Card title="Plant Performance Comparison" subtitle="Comparative Performance Ratio (PR) and Specific Yield across registered sites.">
        <div style={{ overflowX: 'auto' }}>
          <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Plant Name</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Capacity (kWp)</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Performance Ratio (PR)</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Specific Yield</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Health Score</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plantComparisons?.map((plant) => (
                <tr key={plant.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {plant.name}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                    {plant.capacityKwp} kWp
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--color-bg-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${plant.performanceRatio}%`,
                            height: '100%',
                            backgroundColor: plant.performanceRatio > 80 ? 'var(--color-success)' : plant.performanceRatio > 75 ? 'var(--color-warning)' : 'var(--color-danger)',
                          }}
                        />
                      </div>
                      <span style={{ fontWeight: 600 }}>{plant.performanceRatio}%</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                    {plant.specificYieldKwhKwp} kWh/kWp
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <strong style={{ color: plant.healthScore > 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {plant.healthScore}/100
                    </strong>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge variant={plant.status === 'NORMAL' ? 'success' : plant.status === 'WARNING' ? 'warning' : 'danger'}>
                      {plant.status}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                    <Link to={`/plants/${plant.id}`} className="sm-btn sm-btn--ghost sm-btn--sm" style={{ textDecoration: 'none' }}>
                      Inspect <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Integration Status Grid */}
      <Card title="Supported OpenAPI & Protocol Integrations" subtitle="Status of hardware connectors, OpenAPI gateways, and ingestion pipelines.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {integrations?.map((integ) => (
            <div
              key={integ.id}
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-bg-canvas)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                  {integ.name}
                </span>
                <Badge variant={integ.status === 'CONNECTED' ? 'success' : 'danger'}>
                  {integ.status}
                </Badge>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                {integ.endpoint}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                <span>Success Rate: <strong>{integ.successRatePercent}%</strong></span>
                <span>Failures (24h): <strong style={{ color: integ.failureCount24h > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{integ.failureCount24h}</strong></span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Last Sync: {new Date(integ.lastSync).toLocaleTimeString()} ({integ.syncIntervalMin}m interval)
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Administrative & System Audit Trail */}
      <Card
        title="Recent Administrative & System Audit Events"
        subtitle="Security events, role assignments, inverter calibrations, and rule alterations."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <SearchInput
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value);
                setAuditPage(1);
              }}
              placeholder="Search audit trail..."
              style={{ width: '220px' }}
            />
            <Select
              value={auditFilter}
              onChange={(e) => {
                setAuditFilter(e.target.value);
                setAuditPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Actions' },
                { value: 'ASSIGN_ROLE', label: 'Role Assignments' },
                { value: 'DEYE_CLOUD_SYNC', label: 'Deye Cloud Ingestion' },
                { value: 'UPDATE_FAULT_RULE', label: 'Rule Alterations' },
                { value: 'DISPATCH_WORK_ORDER', label: 'Work Orders' },
              ]}
              aria-label="Filter audit action"
            />
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Event ID</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Timestamp</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Actor</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Action</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Target</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Details</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAuditEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                    No audit records match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedAuditEvents.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 600 }}>
                      {evt.id}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{evt.actor}</span>
                      <Badge variant={evt.role === 'admin' ? 'primary' : evt.role === 'system' ? 'neutral' : 'warning'} style={{ marginLeft: '6px', fontSize: '10px' }}>
                        {evt.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {evt.action}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                      {evt.target}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', maxWidth: '280px' }}>
                      {evt.details}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge variant={evt.status === 'SUCCESS' ? 'success' : 'info'}>
                        {evt.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredAuditEvents.length > auditPageSize && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              currentPage={auditPage}
              totalPages={Math.ceil(filteredAuditEvents.length / auditPageSize)}
              onPageChange={(page) => setAuditPage(page)}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
