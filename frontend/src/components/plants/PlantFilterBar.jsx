import { Search, Filter, Plus, ArrowUpDown, X } from 'lucide-react';
import { Button, SearchInput, Select } from '../common';
import { PLANT_SYSTEM_TYPES, PLANT_STATUS_OPTIONS } from '../../services/plantService';

export const PlantFilterBar = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  systemType,
  onSystemTypeChange,
  sortBy,
  onSortByChange,
  onOpenAddModal,
  totalResults,
}) => {
  const systemTypeOptions = [
    { value: 'ALL', label: 'All System Types' },
    ...PLANT_SYSTEM_TYPES.map((type) => ({ value: type, label: type })),
  ];

  const sortOptions = [
    { value: 'name-asc', label: 'Name (A to Z)' },
    { value: 'name-desc', label: 'Name (Z to A)' },
    { value: 'capacity-desc', label: 'Capacity (High to Low)' },
    { value: 'capacity-asc', label: 'Capacity (Low to High)' },
    { value: 'lastActivity-desc', label: 'Latest Telemetry' },
    { value: 'pr-desc', label: 'Performance Ratio (PR)' },
  ];

  const hasActiveFilters = search || status !== 'ALL' || systemType !== 'ALL';

  const handleResetFilters = () => {
    onSearchChange('');
    onStatusChange('ALL');
    onSystemTypeChange('ALL');
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
        {/* Search Bar */}
        <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
          <SearchInput
            placeholder="Search by plant name, location, or ID (e.g. PLANT-101)..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange('')}
            aria-label="Search plants"
          />
        </div>

        {/* Action Button: Add Plant */}
        <Button
          variant="primary"
          icon={Plus}
          onClick={onOpenAddModal}
          aria-label="Add New Solar Plant"
        >
          Add Solar Plant
        </Button>
      </div>

      {/* Filter and Sort Controls */}
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
          <div style={{ minWidth: '150px' }}>
            <Select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              options={PLANT_STATUS_OPTIONS}
              aria-label="Filter by operational status"
            />
          </div>

          {/* System Type Filter */}
          <div style={{ minWidth: '200px' }}>
            <Select
              value={systemType}
              onChange={(e) => onSystemTypeChange(e.target.value)}
              options={systemTypeOptions}
              aria-label="Filter by system architecture"
            />
          </div>

          {/* Clear Filters Indicator */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={handleResetFilters}
              aria-label="Clear active filters"
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Sort Selection & Result Count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Showing <strong>{totalResults}</strong> {totalResults === 1 ? 'plant' : 'plants'}
          </span>

          <div style={{ minWidth: '180px' }}>
            <Select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              options={sortOptions}
              aria-label="Sort plants by"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlantFilterBar;
