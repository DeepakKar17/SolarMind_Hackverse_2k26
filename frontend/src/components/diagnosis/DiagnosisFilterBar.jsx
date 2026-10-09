import PropTypes from 'prop-types';
import { SearchInput, Select, Button } from '../common';
import { Sparkles, X } from 'lucide-react';
import { FAULT_CATEGORIES, DIAGNOSIS_STATUS_OPTIONS } from '../../services/diagnosisService';

export const DiagnosisFilterBar = ({
  filters,
  onFilterChange,
  onReset,
  search: searchProp,
  onSearchChange,
  severity: severityProp,
  onSeverityChange,
  category: categoryProp,
  onCategoryChange,
  status: statusProp,
  onStatusChange,
  plantId: plantIdProp,
  onPlantChange,
  plants = [],
  sortBy: sortByProp,
  onSortByChange,
  onOpenAnalyzeModal,
  totalResults,
}) => {
  // Support either filters object or individual props
  const search = filters ? filters.search : (searchProp || '');
  const severity = filters ? filters.severity : (severityProp || 'ALL');
  const category = filters ? filters.category : (categoryProp || 'ALL');
  const status = filters ? filters.status : (statusProp || 'ALL');
  const plantId = filters ? filters.plantId : (plantIdProp || 'ALL');
  const sortBy = filters ? `${filters.sortBy}-${filters.sortOrder || 'desc'}` : (sortByProp || 'date-desc');

  const handleSearch = (val) => {
    if (onFilterChange) onFilterChange({ search: val });
    else if (onSearchChange) onSearchChange(val);
  };

  const handleSeverity = (val) => {
    if (onFilterChange) onFilterChange({ severity: val });
    else if (onSeverityChange) onSeverityChange(val);
  };

  const handleCategory = (val) => {
    if (onFilterChange) onFilterChange({ category: val });
    else if (onCategoryChange) onCategoryChange(val);
  };

  const handleStatus = (val) => {
    if (onFilterChange) onFilterChange({ status: val });
    else if (onStatusChange) onStatusChange(val);
  };

  const handlePlant = (val) => {
    if (onFilterChange) onFilterChange({ plantId: val });
    else if (onPlantChange) onPlantChange(val);
  };

  const handleSort = (val) => {
    const [field, order] = val.split('-');
    if (onFilterChange) onFilterChange({ sortBy: field, sortOrder: order });
    else if (onSortByChange) onSortByChange(val);
  };

  const severityOptions = [
    { value: 'ALL', label: 'All Severities' },
    { value: 'CRITICAL', label: 'Critical / Trip' },
    { value: 'WARNING', label: 'Warning / Anomaly' },
    { value: 'INFO', label: 'Informational' },
  ];

  const plantOptions = [
    { value: 'ALL', label: 'All Solar Plants' },
    { value: '1', label: 'Residential Rooftop String-1' },
    { value: '2', label: 'Bhartiya Villa Single-String' },
    { value: '3', label: 'Suburban Net-Metered Array C' },
    { value: '4', label: 'Kaveri Commercial Canopy D' },
    { value: '5', label: 'Green Acres Agri-PV' },
    { value: '6', label: 'Deccan Heights Rooftop F' },
    ...plants.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const sortOptions = [
    { value: 'date-desc', label: 'Detection Time (Newest First)' },
    { value: 'date-asc', label: 'Detection Time (Oldest First)' },
    { value: 'loss-desc', label: 'Lost Energy Impact (High to Low)' },
    { value: 'confidence-desc', label: 'AI Confidence Score' },
    { value: 'severity-desc', label: 'Severity Level' },
  ];

  const hasActiveFilters =
    search ||
    severity !== 'ALL' ||
    category !== 'ALL' ||
    status !== 'ALL' ||
    plantId !== 'ALL';

  const handleResetFilters = () => {
    if (onReset) {
      onReset();
    } else {
      handleSearch('');
      handleSeverity('ALL');
      handleCategory('ALL');
      handleStatus('ALL');
      handlePlant('ALL');
    }
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
            placeholder="Search diagnoses by ID, fault, plant, inverter..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onClear={() => handleSearch('')}
            aria-label="Search diagnoses"
          />
        </div>

        {/* Action: Run Diagnostic Scan */}
        <Button
          variant="primary"
          icon={Sparkles}
          onClick={onOpenAnalyzeModal}
          aria-label="Trigger AI Diagnostic Scan"
        >
          Run AI Diagnostic Scan
        </Button>
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
          borderTop: '1px solid var(--color-border)',
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
          {/* Severity */}
          <div style={{ minWidth: '150px' }}>
            <Select
              value={severity}
              onChange={(e) => handleSeverity(e.target.value)}
              options={severityOptions}
              aria-label="Filter by fault severity"
            />
          </div>

          {/* Fault Category */}
          <div style={{ minWidth: '190px' }}>
            <Select
              value={category}
              onChange={(e) => handleCategory(e.target.value)}
              options={FAULT_CATEGORIES}
              aria-label="Filter by fault category"
            />
          </div>

          {/* Status */}
          <div style={{ minWidth: '160px' }}>
            <Select
              value={status}
              onChange={(e) => handleStatus(e.target.value)}
              options={DIAGNOSIS_STATUS_OPTIONS}
              aria-label="Filter by diagnosis status"
            />
          </div>

          {/* Plant */}
          <div style={{ minWidth: '180px' }}>
            <Select
              value={plantId}
              onChange={(e) => handlePlant(e.target.value)}
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
              aria-label="Reset diagnostic filters"
            >
              Reset Filters
            </Button>
          )}
        </div>

        {/* Sorting & Result count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {totalResults !== undefined && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Showing <strong>{totalResults}</strong> {totalResults === 1 ? 'diagnosis' : 'diagnoses'}
            </span>
          )}

          <div style={{ minWidth: '220px' }}>
            <Select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
              options={sortOptions}
              aria-label="Sort diagnoses by"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

DiagnosisFilterBar.propTypes = {
  filters: PropTypes.object,
  onFilterChange: PropTypes.func,
  onReset: PropTypes.func,
  search: PropTypes.string,
  onSearchChange: PropTypes.func,
  severity: PropTypes.string,
  onSeverityChange: PropTypes.func,
  category: PropTypes.string,
  onCategoryChange: PropTypes.func,
  status: PropTypes.string,
  onStatusChange: PropTypes.func,
  plantId: PropTypes.string,
  onPlantChange: PropTypes.func,
  plants: PropTypes.array,
  sortBy: PropTypes.string,
  onSortByChange: PropTypes.func,
  onOpenAnalyzeModal: PropTypes.func,
  totalResults: PropTypes.number,
};

export default DiagnosisFilterBar;
