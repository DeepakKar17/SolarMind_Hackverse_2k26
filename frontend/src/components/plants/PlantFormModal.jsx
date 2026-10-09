import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, Badge } from '../common';
import { PLANT_SYSTEM_TYPES, validatePlantInput } from '../../services/plantService';
import { Save, AlertCircle, Building2, Zap, Settings2 } from 'lucide-react';

const INITIAL_FORM_STATE = {
  name: '',
  plantCode: '',
  location: '',
  systemType: PLANT_SYSTEM_TYPES[0],
  installedCapacityKwp: '',
  panelCount: '',
  panelWattage: 450,
  inverterModel: 'SolarMind Single-Phase Inverter',
  inverterCount: 1,
  tariffPerKwh: 7.50,
  tiltAngle: 18,
  azimuthAngle: 180,
  latitude: '',
  longitude: '',
  status: 'ONLINE',
};

export const PlantFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  isEditing = false,
}) => {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (initialData && isEditing) {
      setFormData({
        name: initialData.name || '',
        plantCode: initialData.plantCode || `PLANT-${initialData.id || ''}`,
        location: initialData.location || '',
        systemType: initialData.systemType || PLANT_SYSTEM_TYPES[0],
        installedCapacityKwp: initialData.installedCapacityKwp !== undefined ? String(initialData.installedCapacityKwp) : '',
        panelCount: initialData.panelCount !== undefined ? String(initialData.panelCount) : '',
        panelWattage: initialData.panelWattage !== undefined ? String(initialData.panelWattage) : 450,
        inverterModel: initialData.inverterModel || 'SolarMind Single-Phase Inverter',
        inverterCount: initialData.inverterCount !== undefined ? String(initialData.inverterCount) : 1,
        tariffPerKwh: initialData.tariffPerKwh !== undefined ? String(initialData.tariffPerKwh) : 7.50,
        tiltAngle: initialData.tiltAngle !== undefined ? String(initialData.tiltAngle) : 18,
        azimuthAngle: initialData.azimuthAngle !== undefined ? String(initialData.azimuthAngle) : 180,
        latitude: initialData.coordinates?.lat !== undefined ? String(initialData.coordinates.lat) : '',
        longitude: initialData.coordinates?.lng !== undefined ? String(initialData.coordinates.lng) : '',
        status: initialData.status || 'ONLINE',
      });
      setErrors({});
      setSubmitError(null);
    } else {
      setFormData(INITIAL_FORM_STATE);
      setErrors({});
      setSubmitError(null);
    }
  }, [initialData, isEditing, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate capacity when panelCount & panelWattage are filled and capacity is empty
      if (name === 'panelCount' || name === 'panelWattage') {
        const pCount = name === 'panelCount' ? Number(value) : Number(prev.panelCount);
        const pWatt = name === 'panelWattage' ? Number(value) : Number(prev.panelWattage);
        if (pCount > 0 && pWatt > 0 && (!prev.installedCapacityKwp || prev.installedCapacityKwp === '')) {
          updated.installedCapacityKwp = ((pCount * pWatt) / 1000).toFixed(2);
        }
      }

      return updated;
    });

    // Clear field-level error when modified
    if (errors[name]) {
      setErrors((prev) => {
        const newErr = { ...prev };
        delete newErr[name];
        return newErr;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate inputs
    const { isValid, errors: validationErrors } = validatePlantInput(formData);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Failed to save solar plant configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const systemTypeOptions = PLANT_SYSTEM_TYPES.map((type) => ({
    value: type,
    label: type,
  }));

  const statusOptions = [
    { value: 'ONLINE', label: 'Online / Normal' },
    { value: 'WARNING', label: 'Warning / Anomaly' },
    { value: 'DEGRADED', label: 'Degraded Yield' },
    { value: 'OFFLINE', label: 'Offline / Disconnected' },
    { value: 'MAINTENANCE', label: 'Under Maintenance' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Plant: ${formData.name || 'Configuration'}` : 'Register New Solar Generation Plant'}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', width: '100%' }}>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Save}
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isEditing ? 'Update Plant' : 'Save Plant'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {submitError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <AlertCircle size={16} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Section 1: General Information */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-2)' }}>
          <Building2 size={16} color="var(--color-primary)" />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            General & Identification
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Plant Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. GreenVilla Rooftop String-1"
            error={errors.name}
            required
          />

          <Input
            label="Plant Code / Identifier"
            name="plantCode"
            value={formData.plantCode}
            onChange={handleChange}
            placeholder="e.g. PLANT-107"
            helperText="Optional external identifier code"
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Installation Location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Bengaluru, Karnataka, India"
              error={errors.location}
              required
            />
          </div>
        </div>

        {/* Section 2: Electrical & Inverter Architecture */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <Zap size={16} color="var(--color-primary)" />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Electrical & Inverter Specifications
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <Select
            label="System Architecture Type"
            name="systemType"
            value={formData.systemType}
            onChange={handleChange}
            options={systemTypeOptions}
            error={errors.systemType}
            required
          />

          <Input
            label="Installed Capacity (kWp)"
            name="installedCapacityKwp"
            type="number"
            step="0.1"
            min="0.1"
            max="1000"
            value={formData.installedCapacityKwp}
            onChange={handleChange}
            placeholder="e.g. 5.4"
            error={errors.installedCapacityKwp}
            required
          />

          <Input
            label="Inverter Model"
            name="inverterModel"
            value={formData.inverterModel}
            onChange={handleChange}
            placeholder="e.g. SolarMind 5kW Single-Phase"
            error={errors.inverterModel}
            required
          />

          <Input
            label="Inverter Count"
            name="inverterCount"
            type="number"
            min="1"
            step="1"
            value={formData.inverterCount}
            onChange={handleChange}
            error={errors.inverterCount}
            required
          />

          <Input
            label="PV Panel Count"
            name="panelCount"
            type="number"
            min="1"
            step="1"
            value={formData.panelCount}
            onChange={handleChange}
            placeholder="e.g. 12"
            error={errors.panelCount}
            required
          />

          <Input
            label="Module Wattage (W)"
            name="panelWattage"
            type="number"
            min="50"
            max="800"
            step="5"
            value={formData.panelWattage}
            onChange={handleChange}
            placeholder="e.g. 450"
            error={errors.panelWattage}
            required
          />
        </div>

        {/* Section 3: Financial Tariff & Spatial Geometry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <Settings2 size={16} color="var(--color-primary)" />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tariff, Geometry & Initial Status
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Utility Tariff (₹ / kWh)"
            name="tariffPerKwh"
            type="number"
            step="0.01"
            min="0"
            value={formData.tariffPerKwh}
            onChange={handleChange}
            placeholder="e.g. 7.50"
            error={errors.tariffPerKwh}
            required
          />

          <Input
            label="Tilt Angle (°)"
            name="tiltAngle"
            type="number"
            min="0"
            max="90"
            value={formData.tiltAngle}
            onChange={handleChange}
            placeholder="e.g. 18"
            error={errors.tiltAngle}
            helperText="0° = horizontal, 90° = vertical"
          />

          <Input
            label="Azimuth Angle (°)"
            name="azimuthAngle"
            type="number"
            min="0"
            max="360"
            value={formData.azimuthAngle}
            onChange={handleChange}
            placeholder="e.g. 180 (South)"
            error={errors.azimuthAngle}
            helperText="180° = True South"
          />

          <Select
            label="Operational Status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={statusOptions}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Latitude (Optional)"
            name="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={formData.latitude}
            onChange={handleChange}
            placeholder="e.g. 12.9716"
            error={errors.latitude}
            helperText="Leave empty if unknown"
          />

          <Input
            label="Longitude (Optional)"
            name="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={formData.longitude}
            onChange={handleChange}
            placeholder="e.g. 77.5946"
            error={errors.longitude}
            helperText="Leave empty if unknown"
          />
        </div>
      </form>
    </Modal>
  );
};

export default PlantFormModal;
