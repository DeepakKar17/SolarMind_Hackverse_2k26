/**
 * SolarMind Telemetry Service Module
 * 
 * Provides endpoints and utilities for timeseries electrical telemetry,
 * real-time snapshots, historical range queries, and batch CSV imports.
 */

import { apiClient, uploadMultipart, buildQueryParams } from './apiClient';

/**
 * Generate synthetic realistic telemetry history for offline or demo mode
 */
export const generateDemoTelemetryHistory = ({
  inverterId = 'INV-101',
  ratedPowerKw = 5.0,
  isOffline = false,
  hoursCount = 14,
} = {}) => {
  const points = [];
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0);

  for (let i = 0; i <= hoursCount; i++) {
    const timestamp = new Date(startOfDay.getTime() + i * 3600 * 1000);
    const hour = timestamp.getHours();
    
    // Solar irradiance bell-curve profile between 6 AM and 6 PM
    let profile = 0;
    if (hour >= 6 && hour <= 18) {
      profile = Math.sin(((hour - 6) / 12) * Math.PI);
    }

    if (isOffline) {
      points.push({
        inverter_id: inverterId,
        timestamp: timestamp.toISOString(),
        v_dc: 0.0,
        i_dc: 0.0,
        p_dc: 0.0,
        v_ac: 0.0,
        i_ac: 0.0,
        p_ac: 0.0,
        grid_frequency_hz: null,
        internal_temp_c: 28.5,
        ambient_temp_c: 27.0,
        daily_yield_kwh: 0.0,
        poa_irradiance_wm2: Number((profile * 950).toFixed(1)),
        inverter_status: 'OFFLINE',
        data_quality_flag: 'SUSPICIOUS',
        data_source: 'DEMO_SIMULATOR',
      });
      continue;
    }

    const pAc = Number((ratedPowerKw * profile * 0.95).toFixed(2));
    const pDc = Number((ratedPowerKw * profile * 1.02).toFixed(2));
    const vDc = profile > 0 ? Number((380 + profile * 12).toFixed(1)) : null;
    const iDc = profile > 0 && vDc ? Number(((pDc * 1000) / vDc).toFixed(2)) : (profile > 0 ? 0 : null);
    const vAc = Number((230 + (i % 3) * 1.5).toFixed(1));
    const iAc = profile > 0 ? Number(((pAc * 1000) / vAc).toFixed(2)) : 0;
    const yieldSoFar = Number((ratedPowerKw * (i / hoursCount) * 4.2).toFixed(2));

    points.push({
      inverter_id: inverterId,
      timestamp: timestamp.toISOString(),
      v_dc: vDc,
      i_dc: iDc,
      p_dc: pDc,
      v_ac: vAc,
      i_ac: iAc,
      p_ac: pAc,
      grid_frequency_hz: 50.0 + (i % 2 === 0 ? 0.02 : -0.01),
      internal_temp_c: Number((35 + profile * 15).toFixed(1)),
      ambient_temp_c: Number((26 + profile * 8).toFixed(1)),
      daily_yield_kwh: yieldSoFar,
      poa_irradiance_wm2: Number((profile * 980).toFixed(1)),
      inverter_status: 'ONLINE',
      data_quality_flag: 'VALID',
      data_source: 'DEMO_SIMULATOR',
    });
  }

  return points;
};

export const telemetryService = {
  /**
   * Fetch the latest real-time telemetry snapshot for an inverter or plant
   * 
   * @param {Object} options
   * @param {string} [options.inverterId] - Target inverter ID
   * @param {number} [options.plantId] - Target plant ID
   * @param {boolean} [options.useLiveApi=true] - Whether to call backend API
   * @returns {Promise<Object|Array>}
   */
  async getLatestTelemetry({ inverterId, plantId, useLiveApi = false } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({
        inverter_id: inverterId,
        plant_id: plantId,
      });
      const response = await apiClient.get('/telemetry/latest', { params });
      return response.data;
    }

    // Demo fallback
    const mockRecord = generateDemoTelemetryHistory({ inverterId: inverterId || 'INV-101' }).pop();
    return mockRecord;
  },

  /**
   * Query historical time-series telemetry records
   * 
   * @param {Object} options
   * @param {string} options.inverterId - Target inverter ID (required)
   * @param {string} [options.pvAssetId] - Optional PV asset / string ID
   * @param {Date|string} [options.startTime] - Start time in UTC
   * @param {Date|string} [options.endTime] - End time in UTC
   * @param {string} [options.dataQualityFlag] - Quality filter ('VALID', 'SUSPICIOUS', etc.)
   * @param {number} [options.limit=100] - Max items (1 - 1000)
   * @param {boolean} [options.useLiveApi=true]
   * @returns {Promise<Array>}
   */
  async getTelemetryHistory({
    inverterId,
    pvAssetId,
    startTime,
    endTime,
    dataQualityFlag,
    limit = 100,
    useLiveApi = false,
  } = {}) {
    if (!inverterId) {
      throw new Error('inverterId is required to query telemetry history.');
    }

    if (useLiveApi) {
      const params = buildQueryParams({
        inverter_id: inverterId,
        pv_asset_id: pvAssetId,
        start_time: startTime,
        end_time: endTime,
        data_quality_flag: dataQualityFlag,
        limit,
      });
      const response = await apiClient.get('/telemetry/history', { params });
      return response.data;
    }

    // Demo fallback
    return generateDemoTelemetryHistory({ inverterId, hoursCount: Math.min(limit, 24) });
  },

  /**
   * Bulk import telemetry records from a CSV file
   * 
   * @param {Object} options
   * @param {File|Blob} options.file - CSV file object
   * @param {string} [options.inverterId] - Optional target inverter ID
   * @param {Function} [options.onProgress] - Upload progress callback
   * @param {boolean} [options.useLiveApi=true]
   * @returns {Promise<Object>} Import summary response
   */
  async importTelemetryCsv({ file, inverterId, onProgress, useLiveApi = false } = {}) {
    if (!file) {
      throw new Error('A valid CSV file must be provided for telemetry import.');
    }

    if (useLiveApi) {
      const formData = new FormData();
      formData.append('file', file);
      
      const queryParams = inverterId ? `?inverter_id=${encodeURIComponent(inverterId)}` : '';
      const data = await uploadMultipart(`/telemetry/import${queryParams}`, formData, {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      });
      return data;
    }

    // Demo fallback
    if (onProgress) {
      onProgress(50);
      await new Promise((r) => setTimeout(r, 200));
      onProgress(100);
    }

    return {
      total_rows: 120,
      accepted_rows: 120,
      rejected_rows: 0,
      duplicate_rows: 0,
      inverter_id: inverterId || 'INV-101',
      source: 'CSV_IMPORT_SIMULATED',
      errors: [],
    };
  },
};

export default telemetryService;
