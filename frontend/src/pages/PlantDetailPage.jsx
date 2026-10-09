import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  Button,
  LoadingState,
  ErrorState,
  useToast,
} from '../components/common';
import { useSolarData } from '../hooks/useSolarData';
import { plantService } from '../services/plantService';
import PlantFormModal from '../components/plants/PlantFormModal';
import PlantInvertersCard from '../components/plants/PlantInvertersCard';
import PlantGenerationTrends from '../components/plants/PlantGenerationTrends';
import PlantFaultsCard from '../components/plants/PlantFaultsCard';
import PlantTelemetryTable from '../components/plants/PlantTelemetryTable';
import PlantMaintenanceCard from '../components/plants/PlantMaintenanceCard';
import {
  Building2,
  MapPin,
  Zap,
  Cpu,
  ArrowLeft,
  Edit2,
  Radio,
  Sun,
  Percent,
  Compass,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { formatCapacity, formatCurrency, formatEnergy } from '../utils/formatters';

export const PlantDetailPage = () => {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const { setSelectedPlantId } = useSolarData();
  const { addToast } = useToast();

  const [plant, setPlant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchPlantDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await plantService.getPlantById(plantId);
      setPlant(data);
      setSelectedPlantId(Number(plantId));
    } catch (err) {
      setError(err.message || `Plant with ID "${plantId}" not found.`);
    } finally {
      setIsLoading(false);
    }
  }, [plantId, setSelectedPlantId]);

  useEffect(() => {
    fetchPlantDetail();
  }, [fetchPlantDetail]);

  const handleUpdatePlant = async (formData) => {
    await plantService.updatePlant(plantId, formData);
    addToast({
      title: 'Plant Configuration Updated',
      message: `${formData.name} specifications have been saved.`,
      variant: 'success',
    });
    await fetchPlantDetail();
  };

  if (isLoading) {
    return <LoadingState message={`Loading details for Solar Plant #${plantId}...`} />;
  }

  if (error || !plant) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <PageHeader
          title="Plant Not Found"
          subtitle={`The solar installation with identifier "${plantId}" could not be located.`}
          breadcrumbs={[
            { label: 'Platform', href: '/dashboard' },
            { label: 'Plants', href: '/plants' },
            { label: 'Not Found' },
          ]}
        />
        <ErrorState
          title="Solar Plant Unavailable"
          message={error || 'The requested plant configuration does not exist in the fleet.'}
          actionText="Back to Plants Fleet"
          onAction={() => navigate('/plants')}
        />
      </div>
    );
  }

  // Active status color variant
  const statusVariant =
    plant.status === 'ONLINE'
      ? 'success'
      : plant.status === 'WARNING'
      ? 'warning'
      : plant.status === 'DEGRADED'
      ? 'warning'
      : 'danger';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Header with Breadcrumbs and Quick Navigation Actions */}
      <PageHeader
        title={plant.name}
        subtitle={`${plant.plantCode || `PLANT-${plant.id}`} • ${plant.location} • ${plant.systemType}`}
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Plants', href: '/plants' },
          { label: plant.name },
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Link
              to="/plants"
              className="sm-btn sm-btn-outline sm-btn-sm"
              style={{ textDecoration: 'none' }}
              aria-label="Back to Plants"
            >
              <ArrowLeft size={14} />
              <span>Fleet Overview</span>
            </Link>
            <Link
              to="/monitoring"
              className="sm-btn sm-btn-outline sm-btn-sm"
              style={{ textDecoration: 'none' }}
              aria-label="Live Telemetry Monitoring"
            >
              <Radio size={14} />
              <span>Live Telemetry</span>
            </Link>
            <Button
              variant="primary"
              size="sm"
              icon={Edit2}
              onClick={() => setIsEditModalOpen(true)}
              aria-label="Edit Plant Details"
            >
              Edit Plant
            </Button>
          </div>
        }
      />

      {/* 2. Primary KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="Installed Capacity"
          value={plant.installedCapacityKwp}
          unit="kWp"
          subtext={`${plant.panelCount}x ${plant.panelWattage}W PV Modules`}
          icon={Zap}
          variant="primary"
        />

        <StatCard
          title="Inverters Fleet"
          value={plant.inverters?.length || plant.inverterCount || 1}
          unit={plant.inverters?.length === 1 ? 'Unit' : 'Units'}
          subtext={plant.inverterModel}
          icon={Cpu}
          variant="info"
        />

        <StatCard
          title="Energy Generated Today"
          value={plant.todayYieldKwh !== undefined ? plant.todayYieldKwh : '--'}
          unit="kWh"
          subtext={plant.expectedTodayKwh ? `Expected: ${plant.expectedTodayKwh} kWh` : 'Model calibrated'}
          icon={Sun}
          variant="success"
        />

        <StatCard
          title="Performance Ratio (PR)"
          value={plant.performanceRatio !== undefined ? `${plant.performanceRatio}` : 'N/A'}
          unit={plant.performanceRatio !== undefined ? '%' : ''}
          subtext={plant.specificYield ? `Specific: ${plant.specificYield} kWh/kWp` : 'Irradiance normalized'}
          icon={Percent}
          variant={plant.performanceRatio >= 80 ? 'success' : 'warning'}
        />

        <StatCard
          title="Utility Tariff Rate"
          value={`₹ ${plant.tariffPerKwh}`}
          unit="/ kWh"
          subtext={`Currency: ${plant.currency || 'INR'}`}
          icon={DollarSign}
          variant="primary"
        />
      </div>

      {/* 3. Plant Electrical & Spatial Configuration Blueprint */}
      <Card title="Installation Blueprint & Electrical Topology">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
              Geographical Coordinates
            </div>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {plant.coordinates && plant.coordinates.lat !== undefined
                ? `${plant.coordinates.lat}° N, ${plant.coordinates.lng}° E`
                : 'Not configured / Unlisted'}
            </strong>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
              Array Tilt & Azimuth Orientation
            </div>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {plant.tiltAngle || 18}° Tilt • {plant.azimuthAngle || 180}° Azimuth (South)
            </strong>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
              Array String Configuration
            </div>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {plant.systemType} ({plant.panelCount} Series PV Modules)
            </strong>
          </div>

          <div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
              Operational Status & Provenance
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
              <Badge variant={statusVariant} dot>
                {plant.status}
              </Badge>
              <Badge variant="warning" dot>
                {plant.dataSource || 'SIMULATED'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Generation Trends (Power Curve & Weekly Yield) */}
      <PlantGenerationTrends
        telemetrySeries={plant.telemetrySeries}
        plantName={plant.name}
      />

      {/* 5. Associated Inverters Fleet */}
      <PlantInvertersCard
        inverters={plant.inverters}
        plantName={plant.name}
      />

      {/* 6. Active Diagnoses and Fault Alarms for this Plant */}
      <PlantFaultsCard
        alerts={plant.alerts}
        diagnoses={plant.diagnoses}
        plantName={plant.name}
      />

      {/* 7. Recent High-Frequency Telemetry Data Points */}
      <PlantTelemetryTable
        telemetrySeries={plant.telemetrySeries}
        plantName={plant.name}
      />

      {/* 8. Historical Maintenance and Service Records */}
      <PlantMaintenanceCard
        plantId={plant.id}
        plantName={plant.name}
      />

      {/* Edit Plant Modal */}
      <PlantFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdatePlant}
        initialData={plant}
        isEditing={true}
      />
    </div>
  );
};

export default PlantDetailPage;
