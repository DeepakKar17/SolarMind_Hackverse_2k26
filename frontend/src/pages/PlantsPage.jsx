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
  useToast,
} from '../components/common';
import { useSolarData } from '../hooks/useSolarData';
import { plantService } from '../services/plantService';
import PlantFilterBar from '../components/plants/PlantFilterBar';
import PlantFormModal from '../components/plants/PlantFormModal';
import {
  Building2,
  Eye,
  Edit2,
  MapPin,
  Zap,
  Cpu,
  Clock,
  Activity,
  Plus,
  TrendingUp,
} from 'lucide-react';
import {
  formatCapacity,
  formatEnergy,
  formatRelativeTime,
} from '../utils/formatters';

export const PlantsPage = () => {
  const { setSelectedPlantId } = useSolarData();
  const { addToast } = useToast();

  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [systemType, setSystemType] = useState('ALL');
  const [sortBy, setSortBy] = useState('name-asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);

  // Data & Async States
  const [plantsData, setPlantsData] = useState({ items: [], totalCount: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal States for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);

  // Parse sortBy value
  const [field, order] = sortBy.split('-');

  // Fetch plants function
  const fetchPlants = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await plantService.getPlants({
        search,
        status,
        systemType,
        sortBy: field === 'capacity' ? 'installedCapacityKwp' : field === 'pr' ? 'performanceRatio' : field,
        sortOrder: order || 'asc',
        page,
        pageSize,
      });

      setPlantsData(result);
    } catch (err) {
      setError(err.message || 'Failed to load solar plants fleet.');
    } finally {
      setIsLoading(false);
    }
  }, [search, status, systemType, field, order, page, pageSize]);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  // Reset to page 1 whenever filters or search changes
  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    setPage(1);
  };

  const handleSystemTypeChange = (val) => {
    setSystemType(val);
    setPage(1);
  };

  const handleSortByChange = (val) => {
    setSortBy(val);
    setPage(1);
  };

  // Add / Edit handlers
  const handleOpenAddModal = () => {
    setEditingPlant(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plant) => {
    setEditingPlant(plant);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    if (editingPlant) {
      await plantService.updatePlant(editingPlant.id, formData);
      addToast({
        title: 'Plant Updated Successfully',
        message: `${formData.name} configurations have been updated.`,
        variant: 'success',
      });
    } else {
      const created = await plantService.createPlant(formData);
      addToast({
        title: 'New Plant Registered',
        message: `${created.name} (${created.plantCode}) added to the fleet.`,
        variant: 'success',
      });
    }
    await fetchPlants();
  };

  // Table Columns Definition
  const columns = [
    {
      key: 'name',
      label: 'Plant Identifier & Name',
      render: (val, row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--color-primary)',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              {row.plantCode || `PLANT-${row.id}`}
            </span>
          </div>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              marginTop: '3px',
            }}
          >
            <MapPin size={11} />
            {row.location}
          </span>
        </div>
      ),
    },
    {
      key: 'systemType',
      label: 'System Type',
      render: (val) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {val}
        </span>
      ),
    },
    {
      key: 'installedCapacityKwp',
      label: 'Capacity (kWp)',
      render: (val) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {formatCapacity(val)}
        </span>
      ),
    },
    {
      key: 'inverterCount',
      label: 'Inverters Fleet',
      render: (val, row) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <Cpu size={13} color="var(--color-text-muted)" />
          {val || 1} {val === 1 ? 'Inverter' : 'Inverters'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const variant =
          val === 'ONLINE'
            ? 'success'
            : val === 'WARNING'
            ? 'warning'
            : val === 'DEGRADED'
            ? 'warning'
            : 'danger';
        return (
          <Badge variant={variant} dot>
            {val}
          </Badge>
        );
      },
    },
    {
      key: 'performanceRatio',
      label: 'Performance (PR / Yield)',
      render: (val, row) => (
        <div>
          <span
            style={{
              fontWeight: 700,
              color:
                val >= 85
                  ? 'var(--color-success)'
                  : val >= 70
                  ? 'var(--color-warning)'
                  : 'var(--color-danger)',
            }}
          >
            {val !== undefined && val !== null ? `${val}% PR` : '--'}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              marginTop: '1px',
            }}
          >
            {row.todayYieldKwh !== undefined ? `Today: ${formatEnergy(row.todayYieldKwh)}` : '--'}
          </span>
        </div>
      ),
    },
    {
      key: 'lastUpdated',
      label: 'Last Telemetry',
      render: (val, row) => (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
          }}
        >
          <Clock size={12} />
          {formatRelativeTime(val || row.lastTelemetry)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Link
            to={`/plants/${row.id}`}
            onClick={() => setSelectedPlantId(row.id)}
            className="sm-btn sm-btn-outline sm-btn-sm"
            style={{ textDecoration: 'none' }}
            aria-label={`View details for ${row.name}`}
          >
            <Eye size={13} />
            <span>View</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon={Edit2}
            onClick={() => handleOpenEditModal(row)}
            aria-label={`Edit ${row.name}`}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  // Fleet Totals Summary
  const totalFleetCapacity = plantsData.items.reduce(
    (sum, p) => sum + (Number(p.installedCapacityKwp) || 0),
    0
  );
  const onlineCount = plantsData.items.filter((p) => p.status === 'ONLINE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Page Header */}
      <PageHeader
        title="Solar Generation Plants"
        subtitle="Comprehensive management, fleet monitoring, and configuration for distributed solar installations."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Plants' },
        ]}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleOpenAddModal}
            aria-label="Add Solar Plant"
          >
            Add Solar Plant
          </Button>
        }
      />

      {/* Fleet Metric Summary Banner */}
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
              Registered Fleet Total
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {plantsData.totalCount} Plants
            </div>
          </div>
          <Building2 size={24} color="var(--color-primary)" />
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
              Online & Normal
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-success)', marginTop: '2px' }}>
              {onlineCount} / {plantsData.items.length} Active
            </div>
          </div>
          <Activity size={24} color="var(--color-success)" />
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
              Fleet Total Capacity
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
              {totalFleetCapacity.toFixed(1)} kWp
            </div>
          </div>
          <Zap size={24} color="var(--color-primary)" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <PlantFilterBar
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        systemType={systemType}
        onSystemTypeChange={handleSystemTypeChange}
        sortBy={sortBy}
        onSortByChange={handleSortByChange}
        onOpenAddModal={handleOpenAddModal}
        totalResults={plantsData.totalCount}
      />

      {/* Table Data View or Loading / Error / Empty States */}
      {isLoading ? (
        <LoadingState message="Loading solar generation plants..." />
      ) : error ? (
        <ErrorState
          title="Error Loading Plants"
          message={error}
          onRetry={fetchPlants}
        />
      ) : plantsData.items.length === 0 ? (
        <EmptyState
          title="No Solar Plants Match Criteria"
          message="Try adjusting your search keywords, status filter, or system type selection."
          actionText="Add New Solar Plant"
          onAction={handleOpenAddModal}
        />
      ) : (
        <Card style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={plantsData.items}
            keyField="id"
          />

          {/* Pagination Controls */}
          {plantsData.totalPages > 1 && (
            <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <Pagination
                currentPage={plantsData.page}
                totalPages={plantsData.totalPages}
                onPageChange={(p) => setPage(p)}
                totalItems={plantsData.totalCount}
                pageSize={plantsData.pageSize}
              />
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Modal */}
      <PlantFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingPlant}
        isEditing={Boolean(editingPlant)}
      />
    </div>
  );
};

export default PlantsPage;
