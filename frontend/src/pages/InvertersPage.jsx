import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  DataTable,
  Pagination,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/common';
import { useSolarData } from '../hooks/useSolarData';
import { inverterService } from '../services/inverterService';
import InverterFilterBar from '../components/inverters/InverterFilterBar';
import InverterDiagnosticBadge from '../components/inverters/InverterDiagnosticBadge';
import {
  Cpu,
  Eye,
  Zap,
  Activity,
  Thermometer,
  Gauge,
  Clock,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import {
  formatCapacity,
  formatPower,
  formatVoltage,
  formatCurrent,
  formatRelativeTime,
} from '../utils/formatters';

export const InvertersPage = () => {
  const { plants, setSelectedPlantId } = useSolarData();

  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [plantId, setPlantId] = useState('ALL');
  const [sortBy, setSortBy] = useState('id-asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);

  // Data States
  const [invertersData, setInvertersData] = useState({ items: [], totalCount: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [field, order] = sortBy.split('-');

  const fetchInverters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await inverterService.getInverters({
        search,
        status,
        plantId,
        sortBy: field === 'power' ? 'ratedAcPowerKw' : field === 'output' ? 'acPowerKw' : field === 'temp' ? 'temperatureC' : field,
        sortOrder: order || 'asc',
        page,
        pageSize,
      });

      setInvertersData(result);
    } catch (err) {
      setError(err.message || 'Failed to load inverters fleet telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, [search, status, plantId, field, order, page, pageSize]);

  useEffect(() => {
    fetchInverters();
  }, [fetchInverters]);

  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    setPage(1);
  };

  const handlePlantChange = (val) => {
    setPlantId(val);
    setPage(1);
  };

  const handleSortByChange = (val) => {
    setSortBy(val);
    setPage(1);
  };

  // Table Columns Definition
  const columns = [
    {
      key: 'id',
      label: 'Inverter Identifier',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-primary)' }}>{val}</strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            SN: {row.serialNumber}
          </span>
        </div>
      ),
    },
    {
      key: 'model',
      label: 'Model & Installation Plant',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
          <Link
            to={`/plants/${row.plantId}`}
            onClick={() => setSelectedPlantId(row.plantId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              marginTop: '2px',
            }}
          >
            <Building2 size={11} />
            {row.plantName}
          </Link>
        </div>
      ),
    },
    {
      key: 'ratedAcPowerKw',
      label: 'Rated AC Capacity',
      render: (val) => formatCapacity(val),
    },
    {
      key: 'acPowerKw',
      label: 'Active AC Power',
      render: (val, row) => {
        // Data rule: missing reading must not be displayed as zero
        if (val === null || val === undefined) {
          return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>--</span>;
        }
        return (
          <span style={{ fontWeight: 700, color: val > 0 ? 'var(--color-secondary)' : 'var(--color-text-muted)' }}>
            {formatPower(val)}
          </span>
        );
      },
    },
    {
      key: 'dcVoltageV',
      label: 'DC MPPT Input',
      render: (val, row) => {
        if (val === null || val === undefined) {
          return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>--</span>;
        }
        return (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {formatVoltage(val)} • {formatCurrent(row.dcCurrentA)}
          </span>
        );
      },
    },
    {
      key: 'temperatureC',
      label: 'Operating Temp',
      render: (val) => {
        // Missing readings rule: do not show zero for missing temperature
        if (val === null || val === undefined) {
          return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>--</span>;
        }
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: val > 60 ? 'var(--color-danger)' : val > 50 ? 'var(--color-warning)' : 'var(--color-text-primary)',
            }}
          >
            <Thermometer size={13} color="var(--color-text-muted)" />
            {val} °C
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Diagnostic State',
      render: (val) => <InverterDiagnosticBadge status={val} size="sm" />,
    },
    {
      key: 'lastSuccessfulUpdate',
      label: 'Last Telemetry',
      render: (val) => (
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={11} />
          {formatRelativeTime(val)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Inspect',
      align: 'right',
      render: (_, row) => (
        <Link
          to={`/inverters/${row.id}`}
          className="sm-btn sm-btn-outline sm-btn-sm"
          style={{ textDecoration: 'none' }}
          aria-label={`Inspect ${row.id}`}
        >
          <Eye size={13} />
          <span>Inspect</span>
        </Link>
      ),
    },
  ];

  // Fleet Summary Metrics
  const totalFleetCapacity = invertersData.items.reduce(
    (acc, inv) => acc + (Number(inv.ratedAcPowerKw) || 0),
    0
  );
  const activeGeneratingCount = invertersData.items.filter(
    (inv) => inv.status === 'NORMAL' && (inv.acPowerKw || 0) > 0
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Page Header */}
      <PageHeader
        title="Single-String & Multi-MPPT Inverters Fleet"
        subtitle="Real-time multi-channel electrical monitoring, PV string telemetry, and diagnostic health states."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Inverters' },
        ]}
      />

      {/* Fleet Metrics Overview Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Registered Inverters
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {invertersData.totalCount} Units
            </div>
          </div>
          <Cpu size={24} color="var(--color-primary)" />
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Actively Generating
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>
              {activeGeneratingCount} / {invertersData.items.length} Online
            </div>
          </div>
          <Zap size={24} color="var(--color-success)" />
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Rated Fleet Capacity
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {totalFleetCapacity.toFixed(1)} kW
            </div>
          </div>
          <Gauge size={24} color="var(--color-primary)" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <InverterFilterBar
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        plantId={plantId}
        onPlantChange={handlePlantChange}
        plants={plants}
        sortBy={sortBy}
        onSortByChange={handleSortByChange}
        totalResults={invertersData.totalCount}
      />

      {/* Data Table View */}
      {isLoading ? (
        <LoadingState message="Loading inverters fleet telemetry..." />
      ) : error ? (
        <ErrorState
          title="Error Loading Inverters"
          message={error}
          onRetry={fetchInverters}
        />
      ) : invertersData.items.length === 0 ? (
        <EmptyState
          title="No Inverters Found"
          message="No inverter hardware units matched your search keywords or diagnostic filters."
        />
      ) : (
        <Card style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={invertersData.items}
            keyField="id"
          />

          {invertersData.totalPages > 1 && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <Pagination
                currentPage={invertersData.page}
                totalPages={invertersData.totalPages}
                onPageChange={(p) => setPage(p)}
                totalItems={invertersData.totalCount}
                pageSize={invertersData.pageSize}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default InvertersPage;
