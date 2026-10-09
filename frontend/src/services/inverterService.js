/**
 * SolarMind Inverter & String Telemetry Service Module
 * 
 * Provides an isolated, API-ready abstraction for inverters, MPPT channels,
 * PV string configurations, multi-dimensional electrical trends, and diagnostic states.
 */

import { apiClient, buildQueryParams } from './apiClient';

/**
 * Diagnostic operating states for solar inverters
 */
export const INVERTER_STATUS_TYPES = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  FAULT: 'FAULT',
  STALE_TELEMETRY: 'STALE_TELEMETRY',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Mock / Initial Inverter Fleet Dataset
 */
export const DEMO_INVERTERS = [
  {
    id: 'INV-101',
    serial_number: 'SM-1010-09884',
    serialNumber: 'SM-1010-09884',
    name: 'Single-String Inverter Alpha',
    manufacturer: 'SolarMind Electric',
    model: 'SM-5000-SP (Single-Phase 5kW)',
    plant_id: 1,
    plantId: 1,
    plantName: 'Residential Rooftop String-1',
    rated_ac_power_kw: 5.0,
    ratedAcPowerKw: 5.0,
    max_dc_power_kw: 6.5,
    maxDcPowerKw: 6.5,
    mppt_count: 1,
    strings_count: 1,
    status: INVERTER_STATUS_TYPES.NORMAL,
    firmware_version: 'v2.4.1-rc3',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date().toISOString(),
    dataFreshnessSec: 15,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 27.2,
    cumulativeEnergyMwh: 14.82,
    dcVoltageV: 382.4,
    dcCurrentA: 9.85,
    dcPowerKw: 3.77,
    acVoltageV: 234.8,
    acCurrentA: 15.65,
    acFrequencyHz: 50.02,
    acPowerKw: 3.64,
    efficiencyPercent: 96.5,
    temperatureC: 41.5,
    maxTempThresholdC: 65.0,
    mpptConfiguration: [
      {
        mpptId: 'MPPT-1',
        name: 'MPPT Channel A',
        voltageV: 382.4,
        currentA: 9.85,
        powerKw: 3.77,
        status: INVERTER_STATUS_TYPES.NORMAL,
        strings: [
          {
            stringId: 'STR-1-1',
            name: 'String 1 (South Roof)',
            panelCount: 12,
            panelWattage: 450,
            panelType: 'Monocrystalline PERC',
            tiltAngle: 18,
            azimuthAngle: 180,
            voltageV: 382.4,
            currentA: 9.85,
            powerKw: 3.77,
            status: INVERTER_STATUS_TYPES.NORMAL,
          },
        ],
      },
    ],
    activeFaults: [],
  },
  {
    id: 'INV-102',
    serial_number: 'SM-1020-05741',
    serialNumber: 'SM-1020-05741',
    name: 'EcoVilla Main Inverter',
    manufacturer: 'SolarMind Electric',
    model: 'SM-4200-SP (Single-Phase 4.2kW)',
    plant_id: 2,
    plantId: 2,
    plantName: 'EcoVilla Solar Array B',
    rated_ac_power_kw: 4.2,
    ratedAcPowerKw: 4.2,
    max_dc_power_kw: 5.5,
    maxDcPowerKw: 5.5,
    mppt_count: 1,
    strings_count: 1,
    status: INVERTER_STATUS_TYPES.NORMAL,
    firmware_version: 'v2.3.0',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date().toISOString(),
    dataFreshnessSec: 25,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 21.8,
    cumulativeEnergyMwh: 9.45,
    dcVoltageV: 355.0,
    dcCurrentA: 8.80,
    dcPowerKw: 3.12,
    acVoltageV: 232.0,
    acCurrentA: 13.0,
    acFrequencyHz: 50.01,
    acPowerKw: 3.01,
    efficiencyPercent: 96.5,
    temperatureC: 39.2,
    mpptConfiguration: [
      {
        mpptId: 'MPPT-1',
        name: 'MPPT Channel A',
        voltageV: 355.0,
        currentA: 8.80,
        powerKw: 3.12,
        status: INVERTER_STATUS_TYPES.NORMAL,
        strings: [],
      },
    ],
    activeFaults: [],
  },
  {
    id: 'INV-103',
    serial_number: 'SM-1030-11209',
    serialNumber: 'SM-1030-11209',
    name: 'Suburban Net-Metered Inverter',
    manufacturer: 'SolarMind Electric',
    model: 'SM-6000-SP (Single-Phase 6kW)',
    plant_id: 3,
    plantId: 3,
    plantName: 'Suburban Net-Metered Array C',
    rated_ac_power_kw: 6.0,
    ratedAcPowerKw: 6.0,
    max_dc_power_kw: 7.8,
    maxDcPowerKw: 7.8,
    mppt_count: 2,
    strings_count: 2,
    status: INVERTER_STATUS_TYPES.WARNING,
    firmware_version: 'v2.4.0',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date().toISOString(),
    dataFreshnessSec: 45,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 18.5,
    cumulativeEnergyMwh: 16.20,
    dcVoltageV: 395.0,
    dcCurrentA: 5.20,
    dcPowerKw: 2.05,
    acVoltageV: 254.2,
    acCurrentA: 7.85,
    acFrequencyHz: 50.15,
    acPowerKw: 1.98,
    efficiencyPercent: 96.0,
    temperatureC: 48.2,
    mpptConfiguration: [
      {
        mpptId: 'MPPT-1',
        name: 'MPPT Channel A',
        voltageV: 395.0,
        currentA: 5.20,
        powerKw: 2.05,
        status: INVERTER_STATUS_TYPES.WARNING,
        strings: [],
      },
    ],
    activeFaults: [
      {
        id: 'FLT-103',
        faultCode: 'GRID_VOLT_HIGH_TRANSIENT',
        description: 'AC grid voltage reached 254.2V exceeding permissible limit.',
        occurredAt: new Date().toISOString(),
        severity: 'WARNING',
      },
    ],
  },
  {
    id: 'INV-104A',
    serial_number: 'SG-8000-00122',
    serialNumber: 'SG-8000-00122',
    name: 'Kaveri Commercial Inverter A',
    manufacturer: 'Sungrow',
    model: 'Sungrow SG8.0RT (Three-Phase 8kW)',
    plant_id: 4,
    plantId: 4,
    plantName: 'Kaveri Commercial Canopy D',
    rated_ac_power_kw: 8.0,
    ratedAcPowerKw: 8.0,
    max_dc_power_kw: 10.0,
    maxDcPowerKw: 10.0,
    mppt_count: 2,
    strings_count: 2,
    mpptCount: 2,
    stringsCount: 2,
    status: INVERTER_STATUS_TYPES.NORMAL,
    firmware_version: 'v2.4.0',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date().toISOString(),
    dataFreshnessSec: 10,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 42.5,
    cumulativeEnergyMwh: 28.60,
    dcVoltageV: 620.0,
    dcCurrentA: 11.5,
    dcPowerKw: 7.13,
    acVoltageV: 400.0,
    acCurrentA: 10.2,
    acFrequencyHz: 50.0,
    acPowerKw: 6.95,
    efficiencyPercent: 97.5,
    temperatureC: 44.0,
    mpptConfiguration: [
      {
        mpptId: 'MPPT-1',
        name: 'MPPT Channel 1 (East Canopy)',
        voltageV: 620.0,
        currentA: 5.8,
        powerKw: 3.6,
        status: INVERTER_STATUS_TYPES.NORMAL,
        strings: [
          { stringId: 'STR-4A-1', name: 'String 1 (Canopy East 1)', panelCount: 16, panelWattage: 500, voltageV: 620.0, currentA: 5.8, powerKw: 3.6, status: INVERTER_STATUS_TYPES.NORMAL },
        ],
      },
      {
        mpptId: 'MPPT-2',
        name: 'MPPT Channel 2 (West Canopy)',
        voltageV: 618.0,
        currentA: 5.7,
        powerKw: 3.53,
        status: INVERTER_STATUS_TYPES.NORMAL,
        strings: [
          { stringId: 'STR-4A-2', name: 'String 2 (Canopy West 1)', panelCount: 16, panelWattage: 500, voltageV: 618.0, currentA: 5.7, powerKw: 3.53, status: INVERTER_STATUS_TYPES.NORMAL },
        ],
      },
    ],
    activeFaults: [],
  },
  {
    id: 'INV-104B',
    serial_number: 'SG-8000-00123',
    serialNumber: 'SG-8000-00123',
    name: 'Kaveri Commercial Inverter B',
    manufacturer: 'Sungrow',
    model: 'Sungrow SG8.0RT (Three-Phase 8kW)',
    plant_id: 4,
    plantId: 4,
    plantName: 'Kaveri Commercial Canopy D',
    rated_ac_power_kw: 8.0,
    ratedAcPowerKw: 8.0,
    max_dc_power_kw: 10.0,
    maxDcPowerKw: 10.0,
    mppt_count: 2,
    strings_count: 4,
    status: INVERTER_STATUS_TYPES.NORMAL,
    firmware_version: 'v2.4.0',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date().toISOString(),
    dataFreshnessSec: 10,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 41.8,
    cumulativeEnergyMwh: 27.90,
    dcVoltageV: 615.0,
    dcCurrentA: 11.2,
    dcPowerKw: 6.88,
    acVoltageV: 400.0,
    acCurrentA: 9.9,
    acFrequencyHz: 50.0,
    acPowerKw: 6.72,
    efficiencyPercent: 97.6,
    temperatureC: 43.5,
    mpptConfiguration: [
      { mpptId: 'MPPT-1', name: 'MPPT Channel 1', voltageV: 615.0, currentA: 5.6, powerKw: 3.44, status: INVERTER_STATUS_TYPES.NORMAL, strings: [] },
      { mpptId: 'MPPT-2', name: 'MPPT Channel 2', voltageV: 614.0, currentA: 5.6, powerKw: 3.44, status: INVERTER_STATUS_TYPES.NORMAL, strings: [] },
    ],
    activeFaults: [],
  },
  {
    id: 'INV-105',
    serial_number: 'GW-5000-99881',
    serialNumber: 'GW-5000-99881',
    name: 'Bhubaneswar Hybrid Inverter',
    manufacturer: 'Growatt',
    model: 'Growatt MIN 5000TL-X',
    plant_id: 5,
    plantId: 5,
    plantName: 'Bhubaneswar Resi Rooftop E',
    rated_ac_power_kw: 5.0,
    ratedAcPowerKw: 5.0,
    max_dc_power_kw: 6.5,
    maxDcPowerKw: 6.5,
    mppt_count: 2,
    strings_count: 2,
    status: INVERTER_STATUS_TYPES.NORMAL,
    firmware_version: 'v1.8.2',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date().toISOString(),
    dataFreshnessSec: 30,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 25.1,
    cumulativeEnergyMwh: 8.90,
    dcVoltageV: 375.0,
    dcCurrentA: 9.1,
    dcPowerKw: 3.41,
    acVoltageV: 231.5,
    acCurrentA: 14.2,
    acFrequencyHz: 50.02,
    acPowerKw: 3.29,
    efficiencyPercent: 96.5,
    temperatureC: null,
    mpptConfiguration: [
      { mpptId: 'MPPT-1', name: 'MPPT 1', voltageV: 375.0, currentA: 9.1, powerKw: 3.41, status: INVERTER_STATUS_TYPES.NORMAL, strings: [] },
    ],
    activeFaults: [],
  },
  {
    id: 'INV-106A',
    serial_number: 'SM-1060-44311',
    serialNumber: 'SM-1060-44311',
    name: 'Deccan Heights Main',
    manufacturer: 'SolarMind Electric',
    model: 'SM-5000-SP (Single-Phase 5kW)',
    plant_id: 6,
    plantId: 6,
    plantName: 'Deccan Heights Rooftop F',
    rated_ac_power_kw: 5.0,
    ratedAcPowerKw: 5.0,
    max_dc_power_kw: 6.5,
    maxDcPowerKw: 6.5,
    mppt_count: 1,
    strings_count: 1,
    status: INVERTER_STATUS_TYPES.STALE_TELEMETRY,
    firmware_version: 'v2.2.0',
    antiIslandingArmed: true,
    lastSuccessfulUpdate: new Date(Date.now() - 3600000).toISOString(),
    dataFreshnessSec: 3600,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 26.5,
    cumulativeEnergyMwh: 12.10,
    dcVoltageV: 380.0,
    dcCurrentA: 9.6,
    dcPowerKw: 3.65,
    acVoltageV: 233.0,
    acCurrentA: 15.1,
    acFrequencyHz: 50.01,
    acPowerKw: 3.52,
    efficiencyPercent: 96.4,
    temperatureC: 40.8,
    mpptConfiguration: [
      { mpptId: 'MPPT-1', name: 'MPPT Channel A', voltageV: 380.0, currentA: 9.6, powerKw: 3.65, status: INVERTER_STATUS_TYPES.STALE_TELEMETRY, strings: [] },
    ],
    activeFaults: [],
  },
  {
    id: 'INV-106B',
    serial_number: 'SM-1060-44312',
    serialNumber: 'SM-1060-44312',
    name: 'Deccan Heights Secondary (Fault Isolated)',
    manufacturer: 'SolarMind Electric',
    model: 'SM-5000-SP (Single-Phase 5kW)',
    plant_id: 6,
    plantId: 6,
    plantName: 'Deccan Heights Rooftop F',
    rated_ac_power_kw: 5.0,
    ratedAcPowerKw: 5.0,
    max_dc_power_kw: 6.5,
    maxDcPowerKw: 6.5,
    mppt_count: 1,
    strings_count: 1,
    status: INVERTER_STATUS_TYPES.OFFLINE,
    firmware_version: 'v2.2.0',
    antiIslandingArmed: false,
    lastSuccessfulUpdate: new Date(Date.now() - 86400000).toISOString(),
    dataFreshnessSec: 86400,
    dataSource: 'SIMULATED / DEMO',
    todayEnergyKwh: 0.0,
    cumulativeEnergyMwh: 7.20,
    dcVoltageV: 0.0,
    dcCurrentA: 0.0,
    dcPowerKw: 0.0,
    acVoltageV: 0.0,
    acCurrentA: 0.0,
    acFrequencyHz: null,
    acPowerKw: 0.0,
    efficiencyPercent: 0.0,
    temperatureC: 26.5,
    mpptConfiguration: [
      { mpptId: 'MPPT-1', name: 'MPPT Channel A', voltageV: 0.0, currentA: 0.0, powerKw: 0.0, status: INVERTER_STATUS_TYPES.OFFLINE, strings: [] },
    ],
    activeFaults: [
      {
        id: 'FLT-106B',
        faultCode: 'DC_ISOLATION_FAULT_SHUTDOWN',
        description: 'Negative string to ground resistance below 50kΩ threshold.',
        occurredAt: new Date(Date.now() - 86400000).toISOString(),
        severity: 'CRITICAL',
      },
    ],
  },
];

/**
 * Generates dynamic high-resolution time series telemetry for a given inverter
 */
export const generateInverterTelemetryHistory = (inverter, range = 'TODAY') => {
  const isStaleOrOffline =
    inverter.status === INVERTER_STATUS_TYPES.OFFLINE ||
    inverter.status === INVERTER_STATUS_TYPES.UNKNOWN;

  const baseVoltage = inverter.dcVoltageV || inverter.v_dc || 380;
  const baseAcV = inverter.acVoltageV || inverter.v_ac || 235;
  const baseTemp = inverter.temperatureC !== undefined ? inverter.temperatureC : (inverter.temperature_c !== undefined ? inverter.temperature_c : 40);
  const ratedKw = inverter.ratedAcPowerKw || inverter.rated_ac_power_kw || 5.0;

  const hours = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  ];

  return hours.map((time, idx) => {
    if (isStaleOrOffline) {
      return {
        time,
        dcVoltageV: 0,
        dcCurrentA: 0,
        dcPowerKw: 0,
        acVoltageV: inverter.status === INVERTER_STATUS_TYPES.OFFLINE ? 0 : 230,
        acCurrentA: 0,
        acPowerKw: 0,
        acFrequencyHz: 50.0,
        efficiencyPercent: 0,
        temperatureC: baseTemp !== null ? 28 + idx * 0.5 : null,
      };
    }

    const profile = Math.sin((idx / (hours.length - 1)) * Math.PI);
    const dcPower = Number((ratedKw * 1.08 * profile).toFixed(2));
    const acPower = Number((ratedKw * profile * 0.96).toFixed(2));
    const dcCurrent = dcPower > 0 ? Number(((dcPower * 1000) / baseVoltage).toFixed(2)) : 0;
    const acCurrent = acPower > 0 ? Number(((acPower * 1000) / baseAcV).toFixed(2)) : 0;
    const eff = dcPower > 0 ? Number(((acPower / dcPower) * 100).toFixed(1)) : 0;
    const temp = baseTemp !== null ? Number((baseTemp - 8 + profile * 14).toFixed(1)) : null;

    return {
      time,
      dcVoltageV: Number((baseVoltage - 10 + profile * 15).toFixed(1)),
      dcCurrentA: dcCurrent,
      dcPowerKw: dcPower,
      acVoltageV: Number((baseAcV - 2 + (idx % 3) * 1.5).toFixed(1)),
      acCurrentA: acCurrent,
      acPowerKw: acPower,
      acFrequencyHz: Number((50.0 + (idx % 2 === 0 ? 0.02 : -0.03)).toFixed(2)),
      efficiencyPercent: eff,
      temperatureC: temp,
    };
  });
};

/**
 * Inverter Service Implementation
 */
export const inverterService = {
  /**
   * Fetch inverters with search, plant filtering, status filtering, sorting, pagination
   */
  async getInverters({
    search = '',
    status = 'ALL',
    plantId = 'ALL',
    sortBy = 'id',
    sortOrder = 'asc',
    page = 1,
    pageSize = 10,
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({
        plant_id: plantId !== 'ALL' ? plantId : undefined,
        status: status !== 'ALL' ? status : undefined,
        page,
        page_size: pageSize,
      });
      const response = await apiClient.get('/inverters', { params });
      return response.data;
    }

    let filtered = [...DEMO_INVERTERS];

    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      filtered = filtered.filter((inv) => {
        return (
          inv.id.toLowerCase().includes(query) ||
          (inv.serial_number || inv.serialNumber || '').toLowerCase().includes(query) ||
          (inv.name || '').toLowerCase().includes(query) ||
          (inv.model || '').toLowerCase().includes(query) ||
          (inv.manufacturer || '').toLowerCase().includes(query) ||
          (inv.plantName || '').toLowerCase().includes(query)
        );
      });
    }

    if (status && status !== 'ALL') {
      filtered = filtered.filter((inv) => inv.status === status);
    }

    if (plantId && plantId !== 'ALL') {
      filtered = filtered.filter((inv) => String(inv.plant_id || inv.plantId) === String(plantId));
    }

    // Sorting
    filtered.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'power' || sortBy === 'ratedAcPowerKw' || sortBy === 'rated_ac_power_kw') {
        valA = Number(a.ratedAcPowerKw || a.rated_ac_power_kw) || 0;
        valB = Number(b.ratedAcPowerKw || b.rated_ac_power_kw) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      if (sortBy === 'temperatureC' || sortBy === 'temp') {
        valA = a.temperatureC !== null ? Number(a.temperatureC) : -999;
        valB = b.temperatureC !== null ? Number(b.temperatureC) : -999;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
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
   * Fetch single inverter details
   */
  async getInverterById(id, { range = 'TODAY', useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/inverters/${id}`);
      const inv = response.data;
      return {
        ...inv,
        telemetryHistory: generateInverterTelemetryHistory(inv, range),
      };
    }

    const inverter = DEMO_INVERTERS.find(
      (inv) => inv.id.toLowerCase() === String(id).toLowerCase() || (inv.serial_number || inv.serialNumber || '').toLowerCase() === String(id).toLowerCase()
    );

    if (!inverter) {
      throw new Error(`Inverter unit with identifier "${id}" was not found.`);
    }

    const telemetryHistory = generateInverterTelemetryHistory(inverter, range);

    return {
      ...inverter,
      telemetryHistory,
    };
  },

  /**
   * Create / register a new inverter
   */
  async createInverter(inverterData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const payload = {
        id: inverterData.id,
        plant_id: Number(inverterData.plant_id || inverterData.plantId),
        serial_number: inverterData.serial_number || inverterData.serialNumber,
        manufacturer: inverterData.manufacturer || 'SolarMind Electric',
        model: inverterData.model || 'SM-5000-SP',
        rated_ac_power_kw: Number(inverterData.rated_ac_power_kw || inverterData.ratedAcPowerKw || 5.0),
        max_dc_power_kw: inverterData.max_dc_power_kw ? Number(inverterData.max_dc_power_kw) : null,
        mppt_count: inverterData.mppt_count ? Number(inverterData.mppt_count) : 1,
        strings_count: inverterData.strings_count ? Number(inverterData.strings_count) : 1,
        status: inverterData.status || 'NORMAL',
        firmware_version: inverterData.firmware_version || null,
      };
      const response = await apiClient.post('/inverters', payload);
      return response.data;
    }

    const newInv = {
      ...inverterData,
      status: inverterData.status || INVERTER_STATUS_TYPES.NORMAL,
    };
    return newInv;
  },

  /**
   * Update an existing inverter
   */
  async updateInverter(id, updateData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.put(`/inverters/${id}`, updateData);
      return response.data;
    }

    return { id, ...updateData };
  },
};

export default inverterService;
