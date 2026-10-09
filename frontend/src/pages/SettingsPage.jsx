import { useState, useEffect } from 'react';
import { PageHeader, Card, StatCard, Badge, Button, Input, Select, Checkbox } from '../components/common';
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Globe,
  Clock,
  RefreshCw,
  Cpu,
  Database,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { settingsService } from '../services/settingsService';

export const SettingsPage = () => {
  const [settings, setSettings] = useState(settingsService.getSettings());
  const [configStatus, setConfigStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('PLANT'); // 'PLANT' | 'UNITS' | 'DATETIME' | 'REFRESH' | 'STATUS'

  useEffect(() => {
    settingsService.getSystemConfigStatus().then((st) => setConfigStatus(st));
  }, []);

  const handleChange = (key, val) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = (e) => {
    e?.preventDefault();
    setIsSaving(true);
    settingsService.saveSettings(settings);
    setTimeout(() => {
      setIsSaving(false);
      setFeedback({ type: 'success', message: 'Application settings and preferences successfully saved.' });
      setTimeout(() => setFeedback(null), 4500);
    }, 400);
  };

  const handleReset = () => {
    const reset = settingsService.resetSettings();
    setSettings(reset);
    setFeedback({ type: 'info', message: 'Preferences reset to factory defaults.' });
    setTimeout(() => setFeedback(null), 4500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="Plant & Application Settings"
        subtitle="Manage default solar plant preferences, engineering units, date/time localization, and live system configuration status."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Settings' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="outline" size="sm" icon={RotateCcw} onClick={handleReset}>
              Reset Defaults
            </Button>
            <Button variant="primary" size="sm" icon={Save} onClick={handleSave} isLoading={isSaving}>
              Save Preferences
            </Button>
          </div>
        }
      />

      {/* Action Notification Toast Banner */}
      {feedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor:
              feedback.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            border:
              feedback.type === 'success' ? '1px solid var(--color-success)' : '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)',
            color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={16} />
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            &times;
          </button>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-2)',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'PLANT', label: 'Plant & Physical Model', icon: Sliders },
          { id: 'UNITS', label: 'Display Units & Currency', icon: Globe },
          { id: 'DATETIME', label: 'Date, Time & Locale', icon: Clock },
          { id: 'REFRESH', label: 'Data Refresh & Polling', icon: RefreshCw },
          { id: 'STATUS', label: 'System Health & Engine Status', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 500,
                fontSize: 'var(--font-size-sm)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Plant & Physical Model Preferences */}
      {activeTab === 'PLANT' && (
        <Card title="Solar Plant & Physical Model Preferences" subtitle="Default installation targets and clear-sky irradiance physics parameters">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
              <Select
                label="Default Active Solar Plant"
                value={settings.defaultPlantId}
                onChange={(e) => handleChange('defaultPlantId', e.target.value)}
                options={[
                  { value: '1', label: 'Residential Rooftop String-1 (5.2 kWp)' },
                  { value: '2', label: 'Bhartiya Villa Single-String (3.3 kWp)' },
                  { value: '3', label: 'Suburban Net-Metered Array C (6.0 kWp)' },
                  { value: '4', label: 'Kaveri Commercial Canopy D (10.0 kWp)' },
                ]}
              />

              <Input
                label="Feed-in Tariff Rate (₹ / kWh)"
                type="number"
                step="0.1"
                value={settings.defaultTariffInrPerKwh}
                onChange={(e) => handleChange('defaultTariffInrPerKwh', Number(e.target.value))}
              />

              <Select
                label="Clear-Sky Irradiance Model"
                value={settings.clearSkyPhysicsEngine}
                onChange={(e) => handleChange('clearSkyPhysicsEngine', e.target.value)}
                options={[
                  { value: 'REST2_PHYSICAL', label: 'REST2 High-Precision Atmospheric Model' },
                  { value: 'INEICHEN', label: 'Ineichen / Perez Clear-Sky Approximation' },
                  { value: 'HAURWITZ', label: 'Haurwitz Empirical Global Radiation' },
                ]}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Checkbox
                id="autoDetectStringAnomalies"
                checked={settings.autoDetectStringAnomalies}
                onChange={(e) => handleChange('autoDetectStringAnomalies', e.target.checked)}
                label="Enable automatic real-time string current attenuation anomaly detection"
              />
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Display Units & Currency */}
      {activeTab === 'UNITS' && (
        <Card title="Display Units & Engineering Formatting" subtitle="Select preferred electrical, thermal, and monetary units">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <Select
              label="Active Power Unit"
              value={settings.powerUnit}
              onChange={(e) => handleChange('powerUnit', e.target.value)}
              options={[
                { value: 'kW', label: 'Kilowatts (kW)' },
                { value: 'W', label: 'Watts (W)' },
                { value: 'MW', label: 'Megawatts (MW)' },
              ]}
            />

            <Select
              label="Energy Yield Unit"
              value={settings.energyUnit}
              onChange={(e) => handleChange('energyUnit', e.target.value)}
              options={[
                { value: 'kWh', label: 'Kilowatt-hours (kWh)' },
                { value: 'MWh', label: 'Megawatt-hours (MWh)' },
              ]}
            />

            <Select
              label="Financial Currency Symbol"
              value={settings.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              options={[
                { value: 'INR', label: 'Indian Rupee (₹ INR)' },
                { value: 'USD', label: 'US Dollar ($ USD)' },
                { value: 'EUR', label: 'Euro (€ EUR)' },
                { value: 'GBP', label: 'British Pound (£ GBP)' },
              ]}
            />

            <Select
              label="Temperature Scale"
              value={settings.tempUnit}
              onChange={(e) => handleChange('tempUnit', e.target.value)}
              options={[
                { value: 'C', label: 'Celsius (°C)' },
                { value: 'F', label: 'Fahrenheit (°F)' },
              ]}
            />
          </div>
        </Card>
      )}

      {/* Tab 3: Date, Time & Locale */}
      {activeTab === 'DATETIME' && (
        <Card title="Date, Time & Localization Preferences" subtitle="Configure timezones and timestamp display formats">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <Select
              label="Installation Timezone"
              value={settings.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
              options={[
                { value: 'Asia/Kolkata', label: 'India Standard Time (IST - UTC+05:30)' },
                { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
                { value: 'America/New_York', label: 'Eastern Time (ET - UTC-05:00)' },
                { value: 'Europe/London', label: 'Greenwich Mean Time (GMT - UTC+00:00)' },
              ]}
            />

            <Select
              label="Date Display Format"
              value={settings.dateFormat}
              onChange={(e) => handleChange('dateFormat', e.target.value)}
              options={[
                { value: 'YYYY-MM-DD', label: 'ISO Standard (YYYY-MM-DD)' },
                { value: 'DD/MM/YYYY', label: 'Standard (DD/MM/YYYY)' },
                { value: 'MM/DD/YYYY', label: 'US Format (MM/DD/YYYY)' },
              ]}
            />

            <Select
              label="Time Display Format"
              value={settings.timeFormat}
              onChange={(e) => handleChange('timeFormat', e.target.value)}
              options={[
                { value: '24h', label: '24-Hour Military Clock (14:30)' },
                { value: '12h', label: '12-Hour AM/PM Clock (02:30 PM)' },
              ]}
            />
          </div>
        </Card>
      )}

      {/* Tab 4: Data Refresh & Polling */}
      {activeTab === 'REFRESH' && (
        <Card title="Data Refresh & Telemetry Streaming" subtitle="Configure inverter gateway polling intervals and live telemetry stream">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ maxWidth: '320px' }}>
              <Select
                label="Automatic Telemetry Refresh Interval"
                value={String(settings.autoRefreshIntervalSec)}
                onChange={(e) => handleChange('autoRefreshIntervalSec', Number(e.target.value))}
                options={[
                  { value: '10', label: 'Every 10 Seconds (High Frequency)' },
                  { value: '30', label: 'Every 30 Seconds (Recommended)' },
                  { value: '60', label: 'Every 1 Minute' },
                  { value: '300', label: 'Every 5 Minutes' },
                  { value: '0', label: 'Disabled (Manual Refresh Only)' },
                ]}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Checkbox
                id="enableLiveWebSockets"
                checked={settings.enableLiveWebSockets}
                onChange={(e) => handleChange('enableLiveWebSockets', e.target.checked)}
                label="Enable Live Server-Sent Events (SSE) & WebSocket Telemetry Stream"
              />
              <Checkbox
                id="offlineCacheEnabled"
                checked={settings.offlineCacheEnabled}
                onChange={(e) => handleChange('offlineCacheEnabled', e.target.checked)}
                label="Cache recent telemetry locally for offline inspection resiliency"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 5: System Configuration Status */}
      {activeTab === 'STATUS' && configStatus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
            <StatCard
              title="SolarMind Core Version"
              value={configStatus.version}
              subtext={configStatus.environment}
              icon={Zap}
              variant="info"
            />
            <StatCard
              title="FastAPI Backend Status"
              value="Connected"
              subtext="REST endpoints /api/v1"
              icon={Server}
              variant="success"
            />
            <StatCard
              title="CV Model Engine"
              value="Provisioned"
              subtext="SolarMind-Vision-v1.4.2"
              icon={Cpu}
              variant="success"
            />
            <StatCard
              title="Database Engine"
              value="SQLite 3.x"
              subtext="SQLAlchemy 2.0 ORM"
              icon={Database}
              variant="default"
            />
          </div>

          <Card title="System Environment & Hardware Interface Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Configured API Base URL:</span>
                <strong style={{ color: 'var(--color-primary)' }}>{configStatus.apiBaseUrl}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Active Telemetry Sensor Feeds:</span>
                <strong>{configStatus.activeTelemetrySensors} Active Sensors</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-xs)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Last Diagnostics Health Ping:</span>
                <span>{configStatus.lastHealthCheck}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Save Button Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
        <Button variant="outline" onClick={handleReset}>
          Reset Defaults
        </Button>
        <Button variant="primary" icon={Save} onClick={handleSave} isLoading={isSaving}>
          Save All Preferences
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
