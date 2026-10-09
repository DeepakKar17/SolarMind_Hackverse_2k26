/**
 * SolarMind Weather & Outage Detection Service
 * 
 * Provides API integration for:
 * - GET /api/v1/weather/plant/{plant_id}
 * - GET /api/v1/weather/plant/{plant_id}/forecast
 * - GET /api/v1/outages
 * - GET /api/v1/outages/plant/{plant_id}
 * - GET /api/v1/outages/{outage_id}
 */

import apiClient from './api';

export const weatherService = {
  /**
   * Get latest weather observations and irradiance for a plant
   */
  async getPlantWeather(plantId) {
    const res = await apiClient.get(`/weather/plant/${plantId}`);
    return res.data;
  },

  /**
   * Get weather forecast for a plant
   */
  async getPlantForecast(plantId, days = 3) {
    const res = await apiClient.get(`/weather/plant/${plantId}/forecast`, {
      params: { days },
    });
    return res.data;
  },

  /**
   * List detected grid outage and power-cut events
   */
  async getOutages({ plantId = null, status = null, limit = 50 } = {}) {
    const params = { limit };
    if (plantId) params.plant_id = plantId;
    if (status) params.status = status;

    const res = await apiClient.get('/outages', { params });
    return res.data?.items || res.data || [];
  },

  /**
   * Get outage events for a specific plant
   */
  async getPlantOutages(plantId) {
    const res = await apiClient.get(`/outages/plant/${plantId}`);
    return res.data?.items || res.data || [];
  },

  /**
   * Get single outage detail
   */
  async getOutageById(outageId) {
    const res = await apiClient.get(`/outages/${outageId}`);
    return res.data;
  },
};

export default weatherService;
