import React, { useState, useMemo } from 'react';
import {
  Sun,
  Zap,
  TrendingUp,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Calendar,
  IndianRupee,
  Activity,
  CheckCircle2,
  Camera,
  Download,
  Info,
  Layers,
  ArrowUpRight,
  CloudSun,
  Eye,
  Sliders,
  Check,
  Send,
  Sparkles,
  PhoneCall,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useSolarData } from '../hooks/useSolarData';
import { getHomeownerText } from '../utils/homeownerTranslations';
import {
  Card,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  EmptyState,
} from '../components/common';
import { formatPower, formatEnergy, formatCurrency } from '../utils/formatters';

export const HomeownerDashboardPage = () => {
  const { user: currentUser } = useAuth();
  const {
    plants,
    selectedPlantId,
    setSelectedPlantId,
    telemetrySeries,
    alerts,
    diagnoses,
    workOrders,
    dailyLossSeries,
    addWorkOrder,
  } = useSolarData();

  // Multi-Language State (Default: English 'en', supports 'hi' Hindi and 'or' Odia)
  const [currentLang, setCurrentLang] = useState('en');
  const t = useMemo(() => getHomeownerText(currentLang), [currentLang]);

  // Modals & User Actions State
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoSuccess, setPhotoSuccess] = useState(false);

  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [techNotes, setTechNotes] = useState('');
  const [techUrgency, setTechUrgency] = useState('NORMAL');
  const [techSuccess, setTechSuccess] = useState(false);

  const [isPrefsModalOpen, setIsPrefsModalOpen] = useState(false);
  const [prefWhatsApp, setPrefWhatsApp] = useState(true);
  const [prefSms, setPrefSms] = useState(true);
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSaved, setPrefSaved] = useState(false);

  const [reportDownloading, setReportDownloading] = useState(false);

  // Filter plants assigned to this homeowner if role is homeowner
  const authorizedPlants = useMemo(() => {
    if (!plants || plants.length === 0) return [];
    if (currentUser?.role === 'homeowner') {
      const userAssigned = plants.filter(
        (p) =>
          p.homeowner_id === currentUser.id ||
          p.homeowner_email === currentUser.email ||
          p.id === 1 // Default household solar plant for demo user
      );
      return userAssigned.length > 0 ? userAssigned : [plants[0]];
    }
    return plants;
  }, [plants, currentUser]);

  // Currently active plant
  const activePlant = useMemo(() => {
    return (
      authorizedPlants.find((p) => p.id === selectedPlantId) ||
      authorizedPlants[0] ||
      null
    );
  }, [authorizedPlants, selectedPlantId]);

  // Latest Telemetry & Metrics
  const latestTelemetry = useMemo(() => {
    if (!telemetrySeries || telemetrySeries.length === 0) return null;
    return telemetrySeries[telemetrySeries.length - 1];
  }, [telemetrySeries]);

  const todayActualKwh = useMemo(() => {
    if (!telemetrySeries) return 0;
    return Number(
      telemetrySeries.reduce((sum, item) => sum + (item.actualKw || 0), 0).toFixed(1)
    );
  }, [telemetrySeries]);

  const todayExpectedKwh = useMemo(() => {
    if (!telemetrySeries) return 0;
    return Number(
      telemetrySeries.reduce((sum, item) => sum + (item.expectedKw || 0), 0).toFixed(1)
    );
  }, [telemetrySeries]);

  const currentPowerKw = latestTelemetry ? latestTelemetry.actualKw : 0;
  const energyShortfallKwh = Math.max(0, Number((todayExpectedKwh - todayActualKwh).toFixed(1)));
  const tariffRate = activePlant?.tariffPerKwh || 7.50;
  const todaySavingsInr = Number((todayActualKwh * tariffRate).toFixed(0));
  const financialShortfallInr = Number((energyShortfallKwh * tariffRate).toFixed(0));

  // Health score calculation with evidence guard
  const hasSufficientEvidence = telemetrySeries && telemetrySeries.length >= 6;
  const healthScore = useMemo(() => {
    if (!hasSufficientEvidence) return null;
    if (todayExpectedKwh === 0) return 90;
    const ratio = (todayActualKwh / todayExpectedKwh) * 100;
    if (ratio >= 85) return 92;
    if (ratio >= 70) return 78;
    return 64;
  }, [hasSufficientEvidence, todayActualKwh, todayExpectedKwh]);

  // Active Alerts & Work Orders for this plant
  const plantAlerts = useMemo(() => {
    if (!alerts || !activePlant) return [];
    return alerts.filter((a) => !a.plantId || a.plantId === activePlant.id);
  }, [alerts, activePlant]);

  const activeAlertsCount = plantAlerts.filter((a) => a.status === 'ACTIVE').length;

  const plantWorkOrders = useMemo(() => {
    if (!workOrders || !activePlant) return [];
    return workOrders.filter((w) => !w.plantId || w.plantId === activePlant.id);
  }, [workOrders, activePlant]);

  // Active Diagnosis
  const latestDiagnosis = useMemo(() => {
    if (!diagnoses || !activePlant) return null;
    const plantDiags = diagnoses.filter((d) => !d.plantId || d.plantId === activePlant.id);
    return plantDiags.length > 0 ? plantDiags[0] : null;
  }, [diagnoses, activePlant]);

  // Handle Photo Inspection Submit
  const handlePhotoSubmit = (e) => {
    e.preventDefault();
    setPhotoSuccess(true);
    setTimeout(() => {
      setPhotoSuccess(false);
      setIsPhotoModalOpen(false);
      setPhotoNotes('');
      setPhotoFile(null);
    }, 1800);
  };

  // Handle Technician Request Submit
  const handleTechSubmit = (e) => {
    e.preventDefault();
    if (activePlant) {
      addWorkOrder({
        title: `Homeowner Service Request: ${activePlant.name}`,
        diagnosisId: latestDiagnosis?.id || 'DIAG-HOME-REQ',
        priority: techUrgency === 'URGENT' ? 'HIGH' : 'MEDIUM',
        notes: techNotes || 'Homeowner requested inspection from portal.',
      });
    }
    setTechSuccess(true);
    setTimeout(() => {
      setTechSuccess(false);
      setIsTechModalOpen(false);
      setTechNotes('');
    }, 1800);
  };

  // Handle Statement Export
  const handleDownloadReport = () => {
    setReportDownloading(true);
    setTimeout(() => {
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        `SolarMind Homeowner Solar Statement\n` +
        `Plant: ${activePlant?.name || 'Home Rooftop'}\n` +
        `Capacity: ${activePlant?.installedCapacityKwp || 5.4} kWp\n` +
        `Generated Today (kWh): ${todayActualKwh}\n` +
        `Expected Today (kWh): ${todayExpectedKwh}\n` +
        `Savings (INR): ₹${todaySavingsInr}\n` +
        `Generated At: ${new Date().toISOString()}\n`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SolarMind_Monthly_Statement_${activePlant?.plantCode || '101'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setReportDownloading(false);
    }, 600);
  };

  if (!activePlant) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <EmptyState
          title="No Solar Plant Associated"
          message="There are currently no rooftop solar plants registered to your homeowner account. Please contact your system administrator or installer to link your solar array."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {/* =========================================================================
          1. HEADER & MULTI-LANGUAGE BAR
          ========================================================================= */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-surface)',
          padding: 'var(--space-5) var(--space-6)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.15)',
            }}
          >
            <Sun size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <h1
                style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}
              >
                {t.portalTitle}
              </h1>
              <Badge variant="primary" style={{ fontSize: '11px' }}>
                {activePlant.installedCapacityKwp || 5.4} kWp
              </Badge>
              {activePlant.isDemo && (
                <Badge variant="neutral" style={{ fontSize: '10px' }}>
                  {t.demoModeTag}
                </Badge>
              )}
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              {t.welcomeUser}, <strong>{currentUser?.full_name || 'Homeowner'}</strong> • {activePlant.name} ({activePlant.location})
            </p>
          </div>
        </div>

        {/* Plant Switcher & Language Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
          {authorizedPlants.length > 1 && (
            <Select
              value={selectedPlantId}
              onChange={(e) => setSelectedPlantId(Number(e.target.value))}
              options={authorizedPlants.map((p) => ({ value: p.id, label: p.name }))}
              aria-label={t.selectPlant}
              style={{ minWidth: '180px' }}
            />
          )}

          {/* Language Selector Pill Group */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--color-bg-canvas)',
              borderRadius: 'var(--radius-full)',
              padding: '2px',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिंदी' },
              { code: 'or', label: 'ଓଡ଼ିଆ' },
            ].map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setCurrentLang(lang.code)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: currentLang === lang.code ? 700 : 500,
                  backgroundColor: currentLang === lang.code ? 'var(--color-primary)' : 'transparent',
                  color: currentLang === lang.code ? '#ffffff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={Sliders}
            onClick={() => setIsPrefsModalOpen(true)}
          >
            {t.userPreferencesTitle}
          </Button>
        </div>
      </div>

      {/* =========================================================================
          2. DASHBOARD KPI CARDS (8 HOUSEHOLD METRICS)
          ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Card 1: Current Power */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.currentPower}
            </span>
            <div style={{ color: currentPowerKw > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
              <Zap size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {currentPowerKw > 0 ? formatPower(currentPowerKw) : '0.00 kW'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {currentPowerKw > 0 ? t.liveTelemetry : t.offlineData}
            </div>
          </div>
        </Card>

        {/* Card 2: Today's Yield */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.todayYield}
            </span>
            <div style={{ color: 'var(--color-primary)' }}>
              <Sun size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {todayActualKwh} {t.unitsKwh}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {t.todayYieldSub}
            </div>
          </div>
        </Card>

        {/* Card 3: Expected vs Actual */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.expectedVsActual}
            </span>
            <div style={{ color: 'var(--color-secondary)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {todayExpectedKwh > 0 ? `${((todayActualKwh / todayExpectedKwh) * 100).toFixed(0)}%` : '100%'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Target: <strong>{todayExpectedKwh} {t.unitsKwh}</strong>
            </div>
          </div>
        </Card>

        {/* Card 4: Energy Shortfall */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.energyShortfall}
            </span>
            <div style={{ color: energyShortfallKwh > 1 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              <Activity size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: energyShortfallKwh > 1 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
              -{energyShortfallKwh} {t.unitsKwh}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {t.energyShortfallSub}
            </div>
          </div>
        </Card>

        {/* Card 5: Financial Savings & Impact */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.financialSavings}
            </span>
            <div style={{ color: 'var(--color-success)' }}>
              <IndianRupee size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              +₹{todaySavingsInr}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Tariff: ₹{tariffRate.toFixed(2)}/kWh {financialShortfallInr > 0 && `(Loss: -₹${financialShortfallInr})`}
            </div>
          </div>
        </Card>

        {/* Card 6: Health Score */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.healthScore}
            </span>
            <div style={{ color: 'var(--color-primary)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            {hasSufficientEvidence && healthScore !== null ? (
              <>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: healthScore >= 85 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {healthScore} / 100
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  {healthScore >= 85 ? t.healthGood : t.healthFair}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-muted)' }}>
                  {t.insufficientEvidence}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {t.healthInsufficient}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Card 7: Active Alerts */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.activeAlerts}
            </span>
            <div style={{ color: activeAlertsCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: activeAlertsCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {activeAlertsCount} {activeAlertsCount === 1 ? 'Notice' : 'Notices'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {t.activeAlertsSub}
            </div>
          </div>
        </Card>

        {/* Card 8: Pending Maintenance */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t.pendingMaintenance}
            </span>
            <div style={{ color: 'var(--color-secondary)' }}>
              <Wrench size={20} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {plantWorkOrders.filter((w) => w.status !== 'COMPLETED').length} Tasks
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {t.pendingMaintenanceSub}
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          3. PLAIN-LANGUAGE AI DIAGNOSIS EXPERIENCE
          ========================================================================= */}
      {latestDiagnosis && (
        <Card
          title={t.aiDiagnosisTitle}
          subtitle={t.aiDiagnosisSub}
          actions={
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={Camera}
                onClick={() => setIsPhotoModalOpen(true)}
              >
                {t.uploadPhotoAction}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Wrench}
                onClick={() => setIsTechModalOpen(true)}
              >
                {t.requestTechVisit}
              </Button>
            </div>
          }
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-canvas)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {/* Top summary banner */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Sparkles size={18} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  {latestDiagnosis.faultClass?.replace('_', ' ')}
                </span>
                <Badge variant={latestDiagnosis.confidenceScore >= 90 ? 'success' : 'warning'}>
                  {latestDiagnosis.confidenceScore}% {t.confidenceScore.split(' ')[0]}
                </Badge>
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Recorded on {new Date(latestDiagnosis.timestamp).toLocaleString()}
              </div>
            </div>

            {/* 6 Plain Language Answers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {t.whatObserved}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                  During peak midday sun (1:00 PM - 2:30 PM), generation dropped by ~34% compared to normal clear-sky baselines, losing ~3.45 kWh.
                </p>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {t.whyHappening}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                  {latestDiagnosis.rootCauseSummary || 'Localized tree branch shadow or chimney obstacle casting shade across bottom solar cells.'}
                </p>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {t.supportingEvidence}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                  Sunlight intensity (irradiance) was strong at 960 W/m², voltage stayed stable at ~380V, but DC string current dropped from 13.6A to 9.2A.
                </p>
              </div>

              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {t.whatToDoNext}
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                  Check the south-west roof perimeter for newly overgrown tree branches. If panels look clean, schedule trimming or a technician check.
                </p>
              </div>
            </div>

            {/* Technician Recommendation Card */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-surface)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {t.technicianRequired}:
                </span>{' '}
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t.techYes}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={() => setIsPhotoModalOpen(true)}>
                  {t.uploadPhotoAction}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsTechModalOpen(true)}>
                  {t.requestTechVisit}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* =========================================================================
          4. INTERACTIVE ENERGY CHARTS
          ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Chart 1: Today's Power Curve */}
        <Card title={t.chartDailyTitle} subtitle={t.chartDailySub}>
          <div style={{ width: '100%', height: 280, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetrySeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="homeActualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" kW" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  type="monotone"
                  dataKey="actualKw"
                  name={t.actualOutput}
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#homeActualGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="expectedKw"
                  name={t.expectedBaseline}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Weekly Generation & Losses */}
        <Card title={t.chartTrendsTitle} subtitle={t.chartTrendsSub}>
          <div style={{ width: '100%', height: 280, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyLossSeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" kWh" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="actualKwh" name={t.actualOutput} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lostKwh" name={t.energyLost} fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 3: Sunlight Weather Comparison */}
        <Card title={t.chartWeatherTitle} subtitle={t.chartWeatherSub}>
          <div style={{ width: '100%', height: 260, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetrySeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} />
                <YAxis yAxisId="left" stroke="#2563eb" fontSize={11} unit=" kW" />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} unit=" W/m²" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Line yAxisId="left" type="monotone" dataKey="actualKw" name={t.actualOutput} stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="irradiancePoa" name={t.sunlightIrradiance} stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 4: Financial Savings History */}
        <Card title={t.chartLossTitle} subtitle={t.chartLossSub}>
          <div style={{ width: '100%', height: 260, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyLossSeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={11} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" ₹" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '8px', border: '1px solid #334155', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="financialLossInr" name={t.moneyLost} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          5. PLANT & HARDWARE SPECIFICATIONS & GLOSSARY
          ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Plant Specs */}
        <Card title={t.plantProfileTitle} subtitle={t.plantProfileSub}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.systemCapacity}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{activePlant.installedCapacityKwp || 5.4} kWp</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.inverterModel}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{activePlant.inverterModel || 'SolarMind Single-Phase 5kW'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.serialNumber}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace' }}>INV-SM-2026-90412</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.panelCount}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{activePlant.panelCount || 12} Mono-PERC Modules</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.tariffRate}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-success)' }}>₹{tariffRate.toFixed(2)} / kWh (DISCOM Net-Meter)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{t.warrantyStatus}</span>
              <Badge variant="success" style={{ fontSize: '10px' }}>{t.warrantyActive}</Badge>
            </div>
          </div>
        </Card>

        {/* Technical Glossary for Homeowners */}
        <Card title="Solar Terminology Simplified" subtitle="Hover or read simple explanations of rooftop solar concepts.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '11px' }}>
              <strong>kWp vs kWh:</strong> {t.glossaryKwp}
            </div>
            <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '11px' }}>
              <strong>Shading:</strong> {t.glossaryShading}
            </div>
            <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '11px' }}>
              <strong>Soiling:</strong> {t.glossarySoiling}
            </div>
            <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '11px' }}>
              <strong>Inverter:</strong> {t.glossaryInverter}
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          6. RECENT ALERTS, SERVICE TRACKER & STATEMENT EXPORT
          ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Service Tracker */}
        <Card title={t.workOrderTrackerTitle} subtitle={t.workOrderTrackerSub}>
          {plantWorkOrders.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-3) 0' }}>
              No active maintenance tasks. Your system is operating within normal parameters.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {plantWorkOrders.map((wo) => (
                <div
                  key={wo.id}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-canvas)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {wo.title}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Assigned: {wo.assignedTo || 'Technician Dispatch Queue'}
                    </div>
                  </div>
                  <Badge variant={wo.status === 'COMPLETED' ? 'success' : wo.status === 'SCHEDULED' ? 'primary' : 'warning'}>
                    {wo.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Energy Statement Download */}
        <Card title={t.reportsTitle} subtitle={t.reportsSub}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Export complete monthly generation readings, estimated export revenue, and tariff offset statements for your records.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                loading={reportDownloading}
                onClick={handleDownloadReport}
              >
                {t.downloadCsv}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                loading={reportDownloading}
                onClick={handleDownloadReport}
              >
                {t.downloadReport}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          7. MODALS: PHOTO INSPECTION, SERVICE REQUEST, PREFERENCES
          ========================================================================= */}
      {/* Geo Photo Inspection Request Modal */}
      {isPhotoModalOpen && (
        <Modal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          title="Upload Rooftop Photo for AI Analysis"
        >
          {photoSuccess ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-success)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto var(--space-2) auto' }} />
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>Photo Uploaded Successfully!</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                SolarMind AI Vision is analyzing your solar panel photo for soiling, hotspots, and physical shading.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePhotoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Take a photo of your rooftop solar array or panels using your phone camera. Our AI Vision will inspect for dust, bird droppings, or tree shadows.
              </p>
              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Select Photo File:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  required
                  style={{ fontSize: 'var(--font-size-xs)' }}
                />
              </div>
              <Textarea
                label="Observation Notes (Optional)"
                placeholder="e.g. Cleaned panels last week, but noticed tree shadow near left corner."
                value={photoNotes}
                onChange={(e) => setPhotoNotes(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => setIsPhotoModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Submit Photo for Inspection
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Technician Request Modal */}
      {isTechModalOpen && (
        <Modal
          isOpen={isTechModalOpen}
          onClose={() => setIsTechModalOpen(false)}
          title="Request Qualified Technician Visit"
        >
          {techSuccess ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-success)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto var(--space-2) auto' }} />
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>Service Request Dispatched!</div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                A work order has been created. A certified solar technician will contact you to confirm the appointment.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTechSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Schedule a certified technician visit to inspect your inverter, wiring, string connections, or clean rooftop panels.
              </p>
              <Select
                label="Urgency Level"
                value={techUrgency}
                onChange={(e) => setTechUrgency(e.target.value)}
                options={[
                  { value: 'NORMAL', label: 'Standard Routine Service (within 3-5 days)' },
                  { value: 'URGENT', label: 'Urgent / Generation Deficit (within 24 hours)' },
                ]}
              />
              <Textarea
                label="Service Details or Issues Observed"
                placeholder="e.g. Inverter showing shading warning or panel washing required."
                value={techNotes}
                onChange={(e) => setTechNotes(e.target.value)}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => setIsTechModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Dispatch Service Request
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Preferences Modal */}
      {isPrefsModalOpen && (
        <Modal
          isOpen={isPrefsModalOpen}
          onClose={() => setIsPrefsModalOpen(false)}
          title={t.userPreferencesTitle}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Configure your preferred notification channels and language preferences.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prefWhatsApp}
                  onChange={(e) => setPrefWhatsApp(e.target.checked)}
                />
                <span>{t.whatsappAlerts}</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prefSms}
                  onChange={(e) => setPrefSms(e.target.checked)}
                />
                <span>{t.smsAlerts}</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prefEmail}
                  onChange={(e) => setPrefEmail(e.target.checked)}
                />
                <span>{t.emailReports}</span>
              </label>
            </div>

            {prefSaved && (
              <div style={{ color: 'var(--color-success)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Preferences saved successfully!
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setIsPrefsModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setPrefSaved(true);
                  setTimeout(() => {
                    setPrefSaved(false);
                    setIsPrefsModalOpen(false);
                  }, 1200);
                }}
              >
                {t.savePreferences}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default HomeownerDashboardPage;
