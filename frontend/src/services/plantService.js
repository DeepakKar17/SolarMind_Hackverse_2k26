/**
 * SolarMind Plant Service Module
 * 
 * Provides an isolated, API-ready abstraction layer for solar plant CRUD operations,
 * filtering, searching, sorting, and pagination.
 * 
 * Supports both local simulated storage (demo state) and live FastAPI integration
 * (/api/v1/plants) without requiring UI structural modifications.
 */

import { DEMO_PLANTS, DEMO_ALERTS, DEMO_DIAGNOSES, DEMO_TELEMETRY_SERIES } from '../data/demoFixtures';
import { apiClient, buildQueryParams } from './apiClient';

// In-memory store for isolated demo operations
let localPlants = [...DEMO_PLANTS];

/**
 * System type definitions supported by the platform
 */
export const PLANT_SYSTEM_TYPES = [
  'Single-String Inverter On-Grid PV',
  'Dual-String Rooftop',
  'Commercial Canopy Array',
  'Residential Hybrid PV',
];

/**
 * Operational status options
 */
export const PLANT_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ONLINE', label: 'Online / Normal' },
  { value: 'WARNING', label: 'Warning / Anomaly' },
  { value: 'DEGRADED', label: 'Degraded Yield' },
  { value: 'OFFLINE', label: 'Offline / Disconnected' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
];

/**
 * Validates a plant form input payload
 */
export const validatePlantInput = (data = {}) => {
  const errors = {};

  // 1. Plant Name (Required, min 3 chars, max 100 chars)
  if (!data.name || !data.name.trim()) {
    errors.name = 'Plant name is required.';
  } else if (data.name.trim().length < 3) {
    errors.name = 'Plant name must be at least 3 characters.';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Plant name must not exceed 100 characters.';
  }

  // 2. Location (Required)
  if (!data.location || !data.location.trim()) {
    errors.location = 'Location description is required.';
  }

  // 3. System Type (Required)
  if (!data.systemType && !data.system_type) {
    errors.systemType = 'System architecture type is required.';
  }

  // 4. Installed Capacity kWp
  const rawCap = data.installedCapacityKwp !== undefined ? data.installedCapacityKwp : data.installed_capacity_kwp;
  const capacity = Number(rawCap);
  if (rawCap === undefined || rawCap === '' || isNaN(capacity)) {
    errors.installedCapacityKwp = 'Installed capacity is required and must be a number.';
  } else if (capacity <= 0) {
    errors.installedCapacityKwp = 'Installed capacity must be greater than 0 kWp.';
  } else if (capacity > 1000) {
    errors.installedCapacityKwp = 'Capacity exceeds maximum allowed threshold (1,000 kWp).';
  }

  // 5. Panel Count
  if (data.panelCount !== undefined && data.panelCount !== '' && data.panelCount !== null) {
    const panelCount = Number(data.panelCount);
    if (!Number.isInteger(panelCount) || panelCount < 1) {
      errors.panelCount = 'Panel count must be a whole positive integer (at least 1).';
    }
  }

  // 6. Panel Wattage
  if (data.panelWattage !== undefined && data.panelWattage !== '' && data.panelWattage !== null) {
    const panelWattage = Number(data.panelWattage);
    if (isNaN(panelWattage) || panelWattage < 50 || panelWattage > 800) {
      errors.panelWattage = 'Panel wattage must be between 50W and 800W.';
    }
  }

  // 7. Tariff per kWh
  const rawTariff = data.tariffPerKwh !== undefined ? data.tariffPerKwh : data.tariff_rate_inr;
  if (rawTariff !== undefined && rawTariff !== '' && rawTariff !== null) {
    const tariff = Number(rawTariff);
    if (isNaN(tariff) || tariff < 0) {
      errors.tariffPerKwh = 'Tariff rate cannot be negative.';
    }
  }

  // 8. Coordinates validation
  if (data.latitude !== undefined && data.latitude !== '' && data.latitude !== null) {
    const lat = Number(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90 and 90 degrees.';
    }
  }

  if (data.longitude !== undefined && data.longitude !== '' && data.longitude !== null) {
    const lng = Number(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be between -180 and 180 degrees.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Plant Service implementation
 */
export const plantService = {
  /**
   * Fetch plants with filtering, search, sorting, and pagination
   */
  async getPlants({
    search = '',
    status = 'ALL',
    systemType = 'ALL',
    sortBy = 'name',
    sortOrder = 'asc',
    page = 1,
    pageSize = 10,
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({
        search,
        status: status !== 'ALL' ? status : undefined,
        system_type: systemType !== 'ALL' ? systemType : undefined,
        page,
        page_size: pageSize,
      });
      const response = await apiClient.get('/plants', { params });
      return response.data;
    }

    // Isolated Demo / Simulated Service
    let filtered = [...localPlants];

    // 1. Search filter
    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      filtered = filtered.filter((plant) => {
        const plantCode = `plant-${plant.id}`.toLowerCase();
        const customCode = (plant.plantCode || '').toLowerCase();
        const name = (plant.name || '').toLowerCase();
        const loc = (plant.location || '').toLowerCase();
        return (
          plantCode.includes(query) ||
          customCode.includes(query) ||
          name.includes(query) ||
          loc.includes(query) ||
          String(plant.id) === query
        );
      });
    }

    // 2. Status filter
    if (status && status !== 'ALL') {
      filtered = filtered.filter((plant) => (plant.status || '').toUpperCase() === status.toUpperCase());
    }

    // 3. System type filter
    if (systemType && systemType !== 'ALL') {
      filtered = filtered.filter((plant) => (plant.systemType || plant.system_type) === systemType);
    }

    // 4. Sorting
    filtered.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (sortBy === 'capacity' || sortBy === 'installedCapacityKwp' || sortBy === 'installed_capacity_kwp') {
        valA = Number(a.installedCapacityKwp || a.installed_capacity_kwp) || 0;
        valB = Number(b.installedCapacityKwp || b.installed_capacity_kwp) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (sortBy === 'lastActivity' || sortBy === 'lastUpdated' || sortBy === 'updated_at') {
        valA = new Date(a.lastUpdated || a.updated_at || a.lastTelemetry || 0).getTime();
        valB = new Date(b.lastUpdated || b.updated_at || b.lastTelemetry || 0).getTime();
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      return 0;
    });

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedItems,
      total: totalCount,
      totalCount,
      page: safePage,
      pageSize,
      page_size: pageSize,
      totalPages,
      total_pages: totalPages,
    };
  },

  /**
   * Fetch detailed plant record by ID
   */
  async getPlantById(id, { useLiveApi = false } = {}) {
    const numId = Number(id);

    if (useLiveApi) {
      const response = await apiClient.get(`/plants/${numId}`);
      return response.data;
    }

    const plant = localPlants.find((p) => p.id === numId);
    if (!plant) {
      throw new Error(`Plant with identifier ID "${id}" was not found.`);
    }

    const plantAlerts = DEMO_ALERTS.filter((a) => a.plantId === numId);
    const plantDiagnoses = DEMO_DIAGNOSES.filter((d) => d.plantId === numId);

    const inverterCount = plant.inverterCount || plant.inverters_count || 1;
    const inverters = Array.from({ length: inverterCount }, (_, i) => {
      const invId = `INV-${plant.id}0${i + 1}`;
      const capacity = plant.installedCapacityKwp || plant.installed_capacity_kwp || 5.0;
      const shareCapacity = Number((capacity / inverterCount).toFixed(2));
      return {
        id: invId,
        serialNumber: `SM-${plant.id * 1000 + i + 1}-SN`,
        model: plant.inverterModel || 'SolarMind Inverter',
        ratedPowerKw: shareCapacity,
        stringCount: 1,
        panelCountPerString: 12,
        mpptVoltageV: 382.4,
        mpptCurrentA: shareCapacity > 0 ? Number((shareCapacity / 0.38).toFixed(2)) : 0,
        efficiencyPercent: plant.status === 'ONLINE' ? 97.8 : 92.4,
        temperatureC: plant.status === 'ONLINE' ? 41.5 : 35.0,
        status: plant.status || 'ONLINE',
      };
    });

    return {
      ...plant,
      inverters,
      alerts: plantAlerts,
      diagnoses: plantDiagnoses,
      telemetrySeries: DEMO_TELEMETRY_SERIES,
    };
  },

  /**
   * Create a new plant
   */
  async createPlant(plantData, { useLiveApi = false } = {}) {
    const { isValid, errors } = validatePlantInput(plantData);
    if (!isValid) {
      const err = new Error('Validation failed for new plant creation.');
      err.validationErrors = errors;
      throw err;
    }

    if (useLiveApi) {
      const payload = {
        name: plantData.name.trim(),
        location: plantData.location.trim(),
        system_type: plantData.systemType || plantData.system_type || 'Single-String Inverter On-Grid PV',
        installed_capacity_kwp: Number(plantData.installedCapacityKwp || plantData.installed_capacity_kwp),
        tariff_rate_inr: Number(plantData.tariffPerKwh || plantData.tariff_rate_inr || 6.5),
        latitude: plantData.latitude ? Number(plantData.latitude) : null,
        longitude: plantData.longitude ? Number(plantData.longitude) : null,
        timezone: plantData.timezone || 'Asia/Kolkata',
        owner_id: plantData.owner_id || plantData.ownerId || null,
      };
      const response = await apiClient.post('/plants', payload);
      return response.data;
    }

    const nextId = localPlants.length > 0 ? Math.max(...localPlants.map((p) => p.id)) + 1 : 1;
    const newPlant = {
      id: nextId,
      plantCode: plantData.plantCode || `PLANT-${nextId}`,
      name: plantData.name.trim(),
      location: plantData.location.trim(),
      coordinates:
        plantData.latitude && plantData.longitude
          ? { lat: Number(plantData.latitude), lng: Number(plantData.longitude) }
          : null,
      systemType: plantData.systemType || plantData.system_type,
      installedCapacityKwp: Number(plantData.installedCapacityKwp || plantData.installed_capacity_kwp),
      tariffPerKwh: Number(plantData.tariffPerKwh || plantData.tariff_rate_inr || 6.5),
      currency: plantData.currency || 'INR',
      currencySymbol: plantData.currencySymbol || '₹',
      timezone: plantData.timezone || 'Asia/Kolkata',
      isDemo: true,
      dataSource: 'SIMULATED',
      lastUpdated: new Date().toISOString(),
      status: plantData.status || 'ONLINE',
      todayYieldKwh: Number(((plantData.installedCapacityKwp || 5) * 4.8).toFixed(1)),
      performanceRatio: 88.5,
    };

    localPlants = [newPlant, ...localPlants];
    return newPlant;
  },

  /**
   * Update an existing plant
   */
  async updatePlant(id, plantData, { useLiveApi = false } = {}) {
    const numId = Number(id);

    if (useLiveApi) {
      const payload = {
        name: plantData.name ? plantData.name.trim() : undefined,
        location: plantData.location ? plantData.location.trim() : undefined,
        system_type: plantData.systemType || plantData.system_type,
        installed_capacity_kwp: plantData.installedCapacityKwp !== undefined ? Number(plantData.installedCapacityKwp) : (plantData.installed_capacity_kwp !== undefined ? Number(plantData.installed_capacity_kwp) : undefined),
        tariff_rate_inr: plantData.tariffPerKwh !== undefined ? Number(plantData.tariffPerKwh) : (plantData.tariff_rate_inr !== undefined ? Number(plantData.tariff_rate_inr) : undefined),
        latitude: plantData.latitude !== undefined ? Number(plantData.latitude) : undefined,
        longitude: plantData.longitude !== undefined ? Number(plantData.longitude) : undefined,
        status: plantData.status,
      };
      const response = await apiClient.put(`/plants/${numId}`, payload);
      return response.data;
    }

    const index = localPlants.findIndex((p) => p.id === numId);
    if (index === -1) {
      throw new Error(`Plant with ID ${id} was not found.`);
    }

    const existing = localPlants[index];
    const updated = {
      ...existing,
      ...plantData,
      id: numId,
      lastUpdated: new Date().toISOString(),
    };

    localPlants[index] = updated;
    return updated;
  },

  /**
   * Reset local in-memory demo store to default fixtures
   */
  resetStore() {
    localPlants = [...DEMO_PLANTS];
  },
};

export default plantService;
