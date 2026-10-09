/**
 * SolarMind Technician Field Service & Work Order Management Service
 * 
 * Provides API integration for:
 * - GET /api/v1/technician/dashboard
 * - GET /api/v1/technician/work-orders
 * - GET /api/v1/technician/work-orders/{id}
 * - POST /api/v1/technician/work-orders/{id}/inspection
 * - POST /api/v1/technician/work-orders/{id}/completion
 * - POST /api/v1/work-orders/{id}/verify
 */

import apiClient from './api';

export const technicianService = {
  /**
   * Fetch technician personal overview and assigned tasks
   */
  async getDashboard() {
    const res = await apiClient.get('/technician/dashboard');
    return res.data;
  },

  /**
   * Fetch assigned work orders for the current technician
   */
  async getAssignedWorkOrders({ status = null, priority = null, limit = 50 } = {}) {
    const params = { limit };
    if (status && status !== 'ALL') params.status = status;
    if (priority && priority !== 'ALL') params.priority = priority;

    const res = await apiClient.get('/technician/work-orders', { params });
    return res.data?.items || res.data || [];
  },

  /**
   * Fetch single work order details with checklist, notes, and photos
   */
  async getWorkOrderById(workOrderId) {
    const res = await apiClient.get(`/technician/work-orders/${workOrderId}`);
    return res.data;
  },

  /**
   * Start or update technician inspection findings
   */
  async submitInspection(workOrderId, inspectionPayload) {
    const res = await apiClient.post(`/technician/work-orders/${workOrderId}/inspection`, inspectionPayload);
    return res.data;
  },

  /**
   * Submit technician completion with parts, checklist, and resolution notes
   */
  async submitCompletion(workOrderId, completionPayload) {
    const res = await apiClient.post(`/technician/work-orders/${workOrderId}/completion`, completionPayload);
    return res.data;
  },

  /**
   * Trigger electrical recovery verification on a completed work order
   */
  async verifyRecovery(workOrderId, payload = {}) {
    const res = await apiClient.post(`/work-orders/${workOrderId}/verify`, payload);
    return res.data;
  },

  /**
   * Update generic work order status or assignment
   */
  async updateWorkOrder(workOrderId, payload) {
    const res = await apiClient.patch(`/work-orders/${workOrderId}`, payload);
    return res.data;
  },

  /**
   * Upload inspection or repair verification photo
   */
  async uploadVerificationPhoto(workOrderId, file, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('work_order_id', workOrderId);
    if (metadata.phase) formData.append('phase', metadata.phase); // 'BEFORE' or 'AFTER'
    if (metadata.notes) formData.append('notes', metadata.notes);

    const res = await apiClient.post('/photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export default technicianService;
