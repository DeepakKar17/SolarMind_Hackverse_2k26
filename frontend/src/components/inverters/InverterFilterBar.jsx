import { Search, Filter, X } from 'lucide-react';
import { SearchInput, Select, Button } from '../common';
import { INVERTER_STATUS_TYPES } from '../../services/inverterService';

export const InverterFilterBar = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  plantId,
  onPlantChange,
  plants = [],
  sortBy,
  onSortByChange,
  totalResults,
}) => {
  const statusOptions = [
    { value: 'ALL', label: 'All Diagnostic States' },
    { value: INVERTER_STATUS_TYPES.NORMAL, label: 'Normal Operation' },
    { value: INVERTER_STATUS_TYPES.WARNING, label: 'Warning / Anomaly' },
    { value: INVERTER_STATUS_TYPES.FAULT, label: 'Active Fault' },
    { value: INVERTER_STATUS_TYPES.STALE_TELEMETRY, label: 'Stale Telemetry' },
    { value: INVERTER_STATUS_TYPES.OFFLINE, label: 'Offline' },
    { value: INVERTER_STATUS_TYPES.UNKNOWN, label: 'Unknown' },
  ];

  const plantOptions = [
    { value: 'ALL', label: 'All Solar Plants' },
    ...plants.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const sortOptions = [
    { value: 'id-asc', label: 'Inverter Serial # (Ascending)' },
    { value: 'id-desc', label: 'Inverter Serial # (Descending)' },
    { value: 'power-desc', label: 'Rated AC Capacity (High to Low)' },
    { value: 'power-asc', label: 'Rated AC Capacity (Low to High)' },
    { value: 'output-desc', label: 'Active Output Power' },
    { value: 'temp-desc', label: 'Operating Temperature' },
  ];

  const hasActiveFilters = search || status !== 'ALL' || plantId !== 'ALL';

  const handleResetFilters = () => {
    onSearchChange('');
    onStatusChange('ALL');
    onPlantChange('ALL');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 320px', minWidth: '240px' }}>
          <SearchInput
            placeholder="Search by inverter ID, serial #, model, or plant..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange('')}
            aria-label="Search inverters"
          />
        </div>

        {/* Sort */}
        <div style={{ minWidth: '220px' }}>
          <Select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            options={sortOptions}
            aria-label="Sort inverters by"
          />
        </div>
      </div>

      {/* Filter Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-border-light)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flex: '1 1 auto',
          }}
        >
          {/* Status Filter */}
          <div style={{ minWidth: '180px' }}>
            <Select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              options={statusOptions}
              aria-label="Filter by diagnostic state"
            />
          </div>

          {/* Plant Filter */}
          <div style={{ minWidth: '220px' }}>
            <Select
              value={plantId}
              onChange={(e) => onPlantChange(e.target.value)}
              options={plantOptions}
              aria-label="Filter by solar plant"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={handleResetFilters}
              aria-label="Reset inverter filters"
            >
              Reset Filters
            </Button>
          )}
        </div>

        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          Showing <strong>{totalResults}</strong> {totalResults === 1 ? 'inverter' : 'inverters'}
        </span>
      </div>
    </div>
  );
};

export default InverterFilterBar;
