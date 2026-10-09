import { useState } from 'react';
import {
  Button,
  IconButton,
  Card,
  Badge,
  StatCard,
  Input,
  Select,
  Textarea,
  Checkbox,
  Modal,
  Drawer,
  DataTable,
  Pagination,
  SearchInput,
  DateRangeFilter,
  PageHeader,
  LoadingState,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  Skeleton,
  StatusIndicator,
  useToast,
} from '../components/common';
import {
  Sun,
  Zap,
  Battery,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const DesignSystemPage = () => {
  const { addToast } = useToast();

  // State for interactive modals & drawers
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [selectVal, setSelectVal] = useState('STRING_1');
  const [inputVal, setInputVal] = useState('Inverter-Alpha-01');
  const [activeDatePreset, setActiveDatePreset] = useState('30D');

  // Sample data for DataTable
  const sampleTableData = [
    { id: 1, name: 'String 1 - Panels 1-6', status: 'ONLINE', power: '2.45 kW', health: 98 },
    { id: 2, name: 'String 1 - Panels 7-12', status: 'SHADING', power: '1.20 kW', health: 74 },
    { id: 3, name: 'Inverter DC Input A', status: 'ONLINE', power: '3.65 kW', health: 95 },
    { id: 4, name: 'AC Utility Feed', status: 'ONLINE', power: '3.52 kW', health: 99 },
  ];

  const tableColumns = [
    { key: 'name', label: 'Component / String', width: '40%' },
    {
      key: 'status',
      label: 'Operational Status',
      render: (val) => (
        <Badge variant={val === 'ONLINE' ? 'success' : 'warning'} dot>
          {val}
        </Badge>
      ),
    },
    { key: 'power', label: 'Active Power (kW)' },
    {
      key: 'health',
      label: 'Health Score',
      render: (val) => (
        <span style={{ fontWeight: 600, color: val > 80 ? 'var(--color-secondary)' : 'var(--color-warning)' }}>
          {val}%
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <PageHeader
        title="SolarMind Design System & UI Kit"
        subtitle="Reusable accessible component library and design token verification."
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Design System' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              size="sm"
              icon={Sliders}
              onClick={() => setDrawerOpen(true)}
            >
              Open Drawer
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setModalOpen(true)}
            >
              Open Modal
            </Button>
          </div>
        }
      />

      {/* 1. StatCards & Metrics */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          1. Stat Cards (Telemetry & KPI)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          <StatCard
            title="Instantaneous AC Power"
            value="3.64"
            unit="kW"
            icon={Zap}
            trend={4.2}
            subtext="vs. 1h ago"
            variant="primary"
          />
          <StatCard
            title="Today's Yield"
            value="21.4"
            unit="kWh"
            icon={Sun}
            trend={12.5}
            subtext="Above clear-sky baseline"
            variant="success"
          />
          <StatCard
            title="Estimated Loss"
            value="2.8"
            unit="kWh"
            icon={AlertTriangle}
            trend={-8.1}
            subtext="Partial shading deficit"
            variant="warning"
          />
          <StatCard
            title="Performance Ratio"
            value="88.4"
            unit="%"
            icon={Battery}
            subtext="Nominal efficiency"
            variant="info"
          />
        </div>
      </section>

      {/* 2. Buttons & Actions */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          2. Buttons & Interactive Controls
        </h2>
        <Card>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary" icon={CheckCircle}>Secondary Green</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
              Delete / Danger
            </Button>
            <Button variant="primary" isLoading>
              Saving...
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Sizes & IconButtons:</span>
            <Button size="sm" variant="outline">Small</Button>
            <Button size="md" variant="outline">Medium</Button>
            <Button size="lg" variant="outline">Large</Button>
            <IconButton icon={Eye} size="sm" ariaLabel="View details" />
            <IconButton icon={Sliders} size="md" ariaLabel="Configure" />
            <IconButton icon={Sparkles} size="lg" variant="primary" ariaLabel="AI Diagnose" />
          </div>
        </Card>
      </section>

      {/* 3. Badges, Indicators & Toast Triggers */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          3. Badges, Status Indicators & Feedback
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          <Card title="Badges & Status Dots">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <Badge variant="primary">Primary</Badge>
              <Badge variant="success" dot>Online (Grid Tied)</Badge>
              <Badge variant="warning" dot>Shading Detected</Badge>
              <Badge variant="danger" dot>Inverter Tripped</Badge>
              <Badge variant="info">Standby</Badge>
              <Badge variant="neutral">Neutral</Badge>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <StatusIndicator status="ONLINE" pulse label="Live Stream" />
              <StatusIndicator status="WARNING" label="Derating" />
              <StatusIndicator status="CRITICAL" label="Alarm" />
            </div>
          </Card>

          <Card title="Toast Notification Triggers">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addToast({ title: 'Telemetry Refreshed', message: 'Inverter snapshot successfully retrieved.', variant: 'success' })}
              >
                Success Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addToast({ title: 'Shading Anomaly', message: 'Current dropped 35% below expected irradiance model.', variant: 'warning' })}
              >
                Warning Toast
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addToast({ title: 'API Connection Error', message: 'FastAPI server unreachable at localhost:8000.', variant: 'danger' })}
              >
                Error Toast
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. Form Controls */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          4. Accessible Form Controls & Search
        </h2>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <Input
              label="Inverter String Label"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              helperText="Single-string residential identifier"
              required
            />

            <Select
              label="Active PV Inverter String"
              value={selectVal}
              onChange={(e) => setSelectVal(e.target.value)}
              options={[
                { value: 'STRING_1', label: 'String 1 (12x 415W Panels)' },
                { value: 'STRING_2', label: 'String 2 (Reserved)' },
              ]}
            />

            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder="Filter telemetry logs..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <Textarea
              label="Maintenance Notes"
              placeholder="Add observation regarding rooftop shading or panel soiling..."
              rows={2}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <Checkbox
                label="Enable AI Automated Clear-Sky Fault Detection"
                checked={checkboxVal}
                onChange={(e) => setCheckboxVal(e.target.checked)}
              />
              <DateRangeFilter
                activePreset={activeDatePreset}
                onPresetSelect={(p) => setActiveDatePreset(p)}
              />
            </div>
          </div>
        </Card>
      </section>

      {/* 5. DataTable & Pagination */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          5. Data Table, Skeleton & Pagination
        </h2>
        <Card style={{ padding: 0 }}>
          <DataTable
            columns={tableColumns}
            data={sampleTableData}
            keyField="id"
          />
          <Pagination
            currentPage={currentPage}
            totalPages={3}
            pageSize={4}
            totalItems={12}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </Card>
      </section>

      {/* 6. Feedback & Empty States */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          6. Loading, Empty & Error States
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          <LoadingState message="Calculating Physics Clear-Sky Baseline..." size="sm" />
          <EmptyState
            title="No Inverter Alarms"
            description="All single-string electrical metrics are nominal."
          />
          <ErrorState
            title="Telemetry Stream Timeout"
            message="Lost connection to solar inverter gateway."
            onRetry={() => addToast({ title: 'Retrying connection', variant: 'info' })}
          />
        </div>
      </section>

      {/* 7. Skeleton Placeholders */}
      <section>
        <h2 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-3)' }}>
          7. Skeleton Loading Shapes
        </h2>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
            <Skeleton variant="circular" width="48px" height="48px" />
            <div style={{ flex: 1 }}>
              <Skeleton width="40%" height="20px" style={{ marginBottom: '6px' }} />
              <Skeleton width="70%" height="14px" />
            </div>
          </div>
          <Skeleton variant="rectangular" height="80px" />
        </Card>
      </section>

      {/* Interactive Overlays */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Telemetry Source"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { setModalOpen(false); addToast({ title: 'Configuration Saved', variant: 'success' }); }}>
              Save Source
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Configure live Modbus TCP or REST ingestion parameters for your single-string inverter.
        </p>
        <Input label="Inverter IP Address / Gateway" placeholder="192.168.1.150" />
      </Modal>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="String Diagnostics Detail"
        footer={
          <Button variant="primary" onClick={() => setDrawerOpen(false)}>Done</Button>
        }
      >
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Detailed string telemetry parameters and diagnostic thresholds.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <StatCard title="Measured Current" value="9.85" unit="A" variant="primary" />
          <StatCard title="Operating Voltage" value="382.4" unit="V" variant="info" />
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          addToast({ title: 'Item deleted', variant: 'danger' });
        }}
        title="Delete Inverter Log Record?"
        message="This will permanently delete the historical telemetry cache for this date."
        isDanger
      />
    </div>
  );
};

export default DesignSystemPage;
