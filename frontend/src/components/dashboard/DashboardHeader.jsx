import { MapPin, Zap, Clock, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';
import { formatCapacity, formatRelativeTime, formatDateTime } from '../../utils/formatters';
import { Badge, DateRangeFilter } from '../common';

export const DashboardHeader = () => {
  const {
    plants,
    selectedPlant,
    selectedPlantId,
    setSelectedPlantId,
    datePreset,
    setDatePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useSolarData();

  return (
    <div
      className="sm-card"
      style={{
        padding: 'var(--space-5) var(--space-6)',
        marginBottom: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {/* Top Bar: Plant Selector + Explicit Demo Indicator */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label htmlFor="plant-selector" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
              Selected Plant:
            </label>
            <select
              id="plant-selector"
              value={selectedPlantId}
              onChange={(e) => setSelectedPlantId(Number(e.target.value))}
              className="sm-input-control"
              style={{
                fontWeight: 700,
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-primary)',
                padding: '4px 12px',
                height: '38px',
                width: 'auto',
                minWidth: '260px',
                cursor: 'pointer',
              }}
            >
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name} ({formatCapacity(plant.installedCapacityKwp)})
                </option>
              ))}
            </select>
          </div>

          {/* Explicit Demo Data Tag */}
          <Badge variant="warning" dot>
            <ShieldAlert size={12} style={{ marginRight: '2px' }} />
            <span>DEMO SIMULATION</span>
          </Badge>
        </div>

        {/* Date Filter Controls */}
        <div>
          <DateRangeFilter
            activePreset={datePreset}
            onPresetSelect={(p) => setDatePreset(p)}
            startDate={customStartDate}
            endDate={customEndDate}
            onStartChange={setCustomStartDate}
            onEndChange={setCustomEndDate}
          />
        </div>
      </div>

      {/* Plant Metadata Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--space-4)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <MapPin size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Location</div>
            <strong style={{ color: 'var(--color-text-primary)' }}>{selectedPlant.location}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Zap size={16} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>System Architecture</div>
            <strong style={{ color: 'var(--color-text-primary)' }}>{selectedPlant.systemType}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <SlidersHorizontal size={16} style={{ color: 'var(--color-accent-amber)', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Installed Capacity</div>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatCapacity(selectedPlant.installedCapacityKwp)} ({selectedPlant.panelCount}x {selectedPlant.panelWattage}W)
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Clock size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Last Telemetry Sync</div>
            <strong style={{ color: 'var(--color-text-primary)' }} title={formatDateTime(selectedPlant.lastUpdated)}>
              {formatRelativeTime(selectedPlant.lastUpdated)} ({formatDateTime(selectedPlant.lastUpdated)})
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
