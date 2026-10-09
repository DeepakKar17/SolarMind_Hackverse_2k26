/**
 * SolarMind System Alarms & Diagnostic Alerts Service
 * 
 * Provides API integrations for monitoring, acknowledging, and resolving real-time alarms.
 */

import { apiClient, buildQueryParams } from './apiClient';

export const ALERT_SEVERITIES = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  WARNING: 'WARNING',
  INFO: 'INFO',
};

export const INITIAL_ALERTS_FIXTURES = [
  {
    id: 'ALT-901',
    severity: ALERT_SEVERITIES.CRITICAL,
    event_timestamp: '2026-10-09T13:00:00.000Z',
    timestamp: '2026-10-09T13:00:00.000Z',
    plant_id: 3,
    plantId: 3,
    plantName: 'Suburban Net-Metered Array C',
    inverter_id: 'INV-103',
    inverterId: 'INV-103',
    code: 'GRID_OVERVOLTAGE_TRIP',
    message: 'Grid line voltage reached 254.2V exceeding statutory limit.',
    status: 'ACTIVE',
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
    actionable_guidance: 'Verify DISCOM grid phase voltage and request transformer tap adjustment.',
    actionableGuidance: 'Verify DISCOM grid phase voltage and request transformer tap adjustment.',
  },
  {
    id: 'ALT-902',
    severity: ALERT_SEVERITIES.WARNING,
    event_timestamp: '2026-10-09T13:30:00.000Z',
    timestamp: '2026-10-09T13:30:00.000Z',
    plant_id: 1,
    plantId: 1,
    plantName: 'Residential Rooftop String-1',
    inverter_id: 'INV-101',
    inverterId: 'INV-101',
    code: 'SHADING_CURRENT_ATTENUATION',
    message: '34% DC string current deficit detected under high POA irradiance (>940 W/m²).',
    status: 'ACTIVE',
    acknowledged: true,
    acknowledged_by: 'Arun K.',
    acknowledged_at: '2026-10-09T13:45:00.000Z',
    actionable_guidance: 'Inspect southern array perimeter for tree branch encroachment.',
    actionableGuidance: 'Inspect southern array perimeter for tree branch encroachment.',
  },
  {
    id: 'ALT-903',
    severity: ALERT_SEVERITIES.WARNING,
    event_timestamp: '2026-10-09T14:15:00.000Z',
    timestamp: '2026-10-09T14:15:00.000Z',
    plant_id: 2,
    plantId: 2,
    plantName: 'Commercial Solar Canopy B',
    inverter_id: 'INV-102',
    inverterId: 'INV-102',
    code: 'IGBT_OVERTEMP_WARNING',
    message: 'IGBT Thermal derating threshold approaching limit (78.5°C).',
    status: 'ACTIVE',
    acknowledged: false,
    acknowledged_by: null,
    acknowledged_at: null,
    actionable_guidance: 'Check inverter heat sink ventilation louvers for obstruction.',
    actionableGuidance: 'Check inverter heat sink ventilation louvers for obstruction.',
  },
];

let localAlerts = [...INITIAL_ALERTS_FIXTURES];

export const alertService = {
  /**
   * Fetch paginated list of alerts with filters
   */
  async getAlerts({
    plantId = 'ALL',
    inverterId,
    severity = 'ALL',
    status = 'ALL',
    acknowledged = 'ALL',
    search = '',
    page = 1,
    pageSize = 20,
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const ackBool = acknowledged === 'ACKNOWLEDGED' ? true : (acknowledged === 'UNACKNOWLEDGED' ? false : (typeof acknowledged === 'boolean' ? acknowledged : undefined));
      const params = buildQueryParams({
        plant_id: plantId !== 'ALL' ? plantId : undefined,
        inverter_id: inverterId !== 'ALL' ? inverterId : undefined,
        severity: severity !== 'ALL' ? severity : undefined,
        status: status !== 'ALL' ? status : undefined,
        acknowledged: ackBool,
        search: search || undefined,
        page,
        page_size: pageSize,
      });
      const response = await apiClient.get('/alerts', { params });
      return response.data;
    }

    // Demo fallback
    let filtered = [...localAlerts];

    if (plantId && plantId !== 'ALL') {
      filtered = filtered.filter((a) => String(a.plant_id || a.plantId) === String(plantId));
    }
    if (inverterId && inverterId !== 'ALL') {
      filtered = filtered.filter((a) => (a.inverter_id || a.inverterId) === inverterId);
    }
    if (severity && severity !== 'ALL') {
      filtered = filtered.filter((a) => a.severity === severity);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((a) => a.status === status);
    }
    if (acknowledged !== 'ALL') {
      const isAck = acknowledged === 'ACKNOWLEDGED' || acknowledged === true;
      filtered = filtered.filter((a) => a.acknowledged === isAck);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          (a.id && a.id.toLowerCase().includes(q)) ||
          (a.code && a.code.toLowerCase().includes(q)) ||
          (a.message && a.message.toLowerCase().includes(q)) ||
          (a.inverterId && a.inverterId.toLowerCase().includes(q)) ||
          (a.plantName && a.plantName.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const items = filtered;

    // In demo mode, return array that also has .items for pagination compatibility
    Object.defineProperty(filtered, 'items', { value: items, enumerable: false });
    Object.defineProperty(filtered, 'total', { value: total, enumerable: false });
    Object.defineProperty(filtered, 'page', { value: page, enumerable: false });
    Object.defineProperty(filtered, 'page_size', { value: pageSize, enumerable: false });
    Object.defineProperty(filtered, 'total_pages', { value: Math.max(1, Math.ceil(total / pageSize)), enumerable: false });

    return filtered;
  },

  /**
   * Batch acknowledge alerts
   */
  async batchAcknowledge(alertIds, { actor = 'Lead Solar Engineer' } = {}) {
    const updated = [];
    localAlerts.forEach((a) => {
      if (alertIds.includes(a.id) && !a.acknowledged) {
        a.acknowledged = true;
        a.acknowledged_by = actor;
        a.acknowledged_at = new Date().toISOString();
        updated.push(a);
      }
    });
    return updated;
  },

  /**
   * Fetch single alert by ID
   */
  async getAlertById(alertId, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const res = await apiClient.get(`/alerts/${alertId}`);
      return res.data;
    }
    const alert = localAlerts.find((a) => a.id === alertId);
    if (!alert) throw new Error(`Alert '${alertId}' not found.`);
    return alert;
  },

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, { acknowledgedBy = 'Current User', useLiveApi = false } = {}) {
    if (useLiveApi) {
      const res = await apiClient.post(`/alerts/${alertId}/acknowledge`, {
        acknowledged_by: acknowledgedBy,
      });
      return res.data;
    }

    const alert = localAlerts.find((a) => a.id === alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found.`);

    alert.acknowledged = true;
    alert.acknowledged_by = acknowledgedBy;
    alert.acknowledged_at = new Date().toISOString();
    return alert;
  },

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const res = await apiClient.post(`/alerts/${alertId}/resolve`);
      return res.data;
    }

    const alert = localAlerts.find((a) => a.id === alertId);
    if (alert) {
      alert.status = 'RESOLVED';
      alert.resolved_at = new Date().toISOString();
    }
    return alert;
  },

  /**
   * Reset alerts store to initial fixtures
   */
  resetStore() {
    localAlerts = [...INITIAL_ALERTS_FIXTURES];
  },
};

export default alertService;
