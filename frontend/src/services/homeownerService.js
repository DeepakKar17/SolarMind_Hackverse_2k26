/**
 * SolarMind Homeowner Service
 * 
 * Provides direct API integration with Homeowner Portal endpoints:
 * - GET /api/v1/home/dashboard
 * - GET /api/v1/home/plants
 * - GET /api/v1/home/alerts
 * - GET /api/v1/home/diagnoses
 * - GET /api/v1/home/work-orders
 */

import apiClient from './api';

export const homeownerService = {
  /**
   * Fetch aggregate homeowner dashboard overview
   */
  async getDashboard(plantId = null) {
    const params = plantId ? { plant_id: plantId } : {};
    const res = await apiClient.get('/home/dashboard', { params });
    return res.data;
  },

  /**
   * Fetch solar plants permitted for current homeowner
   */
  async getPlants() {
    const res = await apiClient.get('/home/plants');
    return res.data?.items || res.data || [];
  },

  /**
   * Fetch active alerts for homeowner plants
   */
  async getAlerts(plantId = null) {
    const params = plantId ? { plant_id: plantId } : {};
    const res = await apiClient.get('/home/alerts', { params });
    return res.data?.items || res.data || [];
  },

  /**
   * Fetch diagnoses for homeowner plants
   */
  async getDiagnoses(plantId = null) {
    const params = plantId ? { plant_id: plantId } : {};
    const res = await apiClient.get('/home/diagnoses', { params });
    return res.data?.items || res.data || [];
  },

  /**
   * Fetch work orders permitted for homeowner
   */
  async getWorkOrders(plantId = null) {
    const params = plantId ? { plant_id: plantId } : {};
    const res = await apiClient.get('/home/work-orders', { params });
    return res.data?.items || res.data || [];
  },
};

export default homeownerService;
