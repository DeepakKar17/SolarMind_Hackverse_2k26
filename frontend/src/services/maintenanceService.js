/**
 * SolarMind Maintenance History & Field Service Verification Service
 */

import { apiClient } from './api';

export const INITIAL_MAINTENANCE_LOGS = [
  {
    id: 'MNT-801',
    workOrderId: 'WO-801',
    plantId: 1,
    plantName: 'Residential Rooftop String-1',
    inverterId: 'INV-101',
    stringId: 'String 1 (South Roof)',
    issueTitle: 'Afternoon Tree Foliage Shading Remediation',
    issueCategory: 'VEGETATION_TRIMMING',
    technician: 'Arun Kumar (Lead Field Specialist)',
    serviceProvider: 'CleanSolar Field Services',
    scheduledDate: '2026-10-09',
    completedDate: '2026-10-09',
    durationHours: 1.5,
    status: 'COMPLETED',
    costInr: 850,
    actionsTaken: [
      'Trimmed overgrown neem & coconut branches along south-west roof perimeter back by 3.0 meters.',
      'Cleared rooftop gutter debris obstructing panel frame lower edge.',
      'Validated clear line-of-sight during peak azimuth window (13:00 - 14:30).',
    ],
    verificationEvidence: {
      preServicePowerKw: 3.45,
      postServicePowerKw: 5.18,
      yieldGainPercent: '+33.4%',
      stringVocVolts: 382.4,
      stringIscAmps: 13.55,
      hasPhotoEvidence: true,
      technicianSignoff: 'Verified optimal irradiance recovery under 960 W/m² POA.',
    },
  },
  {
    id: 'MNT-802',
    workOrderId: 'WO-802',
    plantId: 1,
    plantName: 'Residential Rooftop String-1',
    inverterId: 'INV-101',
    stringId: 'All Strings (12 Modules)',
    issueTitle: 'Demineralized Water Array Wash & Dust Removal',
    issueCategory: 'MODULE_WASHING',
    technician: 'SolarField Wash Crew #2',
    serviceProvider: 'SolarField Maintenance Ltd',
    scheduledDate: '2026-10-08',
    completedDate: '2026-10-08',
    durationHours: 2.0,
    status: 'COMPLETED',
    costInr: 600,
    actionsTaken: [
      'Early morning wash (07:30 AM) using demineralized water (<35 ppm TDS) and non-abrasive microfiber squeegee.',
      'Removed dry particulate crust, urban soot, and bird droppings from panels 1 through 12.',
      'Inspected panel clamping torque and aluminum racking integrity.',
    ],
    verificationEvidence: {
      preServicePowerKw: 4.85,
      postServicePowerKw: 5.24,
      yieldGainPercent: '+8.0%',
      stringVocVolts: 385.0,
      stringIscAmps: 13.62,
      hasPhotoEvidence: true,
      technicianSignoff: 'Visual clarity verified; no micro-cracking or frame corrosion detected.',
    },
  },
  {
    id: 'MNT-803',
    workOrderId: 'WO-803',
    plantId: 3,
    plantName: 'Suburban Net-Metered Array C',
    inverterId: 'INV-103',
    stringId: 'AC Distribution Port',
    issueTitle: 'DISCOM Distribution Grid High Voltage Line Audit',
    issueCategory: 'GRID_COMPLIANCE',
    technician: 'Ramesh Patel (DISCOM Certified Electrician)',
    serviceProvider: 'DISCOM Utility Technical Liaison',
    scheduledDate: '2026-10-07',
    completedDate: '2026-10-08',
    durationHours: 3.5,
    status: 'COMPLETED',
    costInr: 1200,
    actionsTaken: [
      'Logged 24-hour phase voltage waveform at plant net-metering interface.',
      'Identified local substation distribution transformer tap set to +5% elevated voltage.',
      'Executed 1-tap reduction at distribution transformer down to nominal 230V base.',
    ],
    verificationEvidence: {
      preServiceVoltageV: 254.2,
      postServiceVoltageV: 242.0,
      yieldGainPercent: 'Restored Grid Continuity',
      stringVocVolts: 410.0,
      stringIscAmps: 14.10,
      hasPhotoEvidence: false,
      technicianSignoff: 'Grid anti-islanding trip eliminated; stable export confirmed.',
    },
  },
  {
    id: 'MNT-804',
    workOrderId: 'WO-804',
    plantId: 4,
    plantName: 'Kaveri Commercial Canopy D',
    inverterId: 'INV-104A',
    stringId: 'Inverter Heat Sink & Cooling Fans',
    issueTitle: 'Inverter Ventilation Cleanout & Thermal Audit',
    issueCategory: 'PREVENTIVE_INSPECTION',
    technician: 'Suresh Nair (Thermal Systems Tech)',
    serviceProvider: 'Kaveri O&M Services',
    scheduledDate: '2026-10-10',
    completedDate: null,
    durationHours: null,
    status: 'SCHEDULED',
    costInr: 500,
    actionsTaken: [
      'Scheduled to clean external heat sink fins with compressed dry nitrogen.',
      'Check fan bearing noise and verify minimum 35cm clearance from canopy frame.',
    ],
    verificationEvidence: null,
  },
];

let localMaintenanceLogs = [...INITIAL_MAINTENANCE_LOGS];

export const maintenanceService = {
  /**
   * Fetch maintenance records with filtering
   */
  async getMaintenanceLogs({
    search = '',
    plantId = 'ALL',
    status = 'ALL',
    category = 'ALL',
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const res = await apiClient.get('/maintenance', {
        params: { search, plant_id: plantId, status, category },
      });
      return res.data;
    }

    let filtered = [...localMaintenanceLogs];

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.workOrderId.toLowerCase().includes(q) ||
          m.issueTitle.toLowerCase().includes(q) ||
          m.plantName.toLowerCase().includes(q) ||
          m.technician.toLowerCase().includes(q) ||
          m.inverterId.toLowerCase().includes(q)
      );
    }

    if (plantId && plantId !== 'ALL') {
      filtered = filtered.filter((m) => String(m.plantId) === String(plantId));
    }

    if (status && status !== 'ALL') {
      filtered = filtered.filter((m) => m.status === status);
    }

    if (category && category !== 'ALL') {
      filtered = filtered.filter((m) => m.issueCategory === category);
    }

    return filtered;
  },

  /**
   * Get single maintenance record details
   */
  async getMaintenanceById(id) {
    const record = localMaintenanceLogs.find((m) => m.id === id || m.workOrderId === id);
    if (!record) throw new Error(`Maintenance record ${id} not found.`);
    return record;
  },

  /**
   * Reset maintenance store
   */
  resetStore() {
    localMaintenanceLogs = [...INITIAL_MAINTENANCE_LOGS];
  },
};

export default maintenanceService;
