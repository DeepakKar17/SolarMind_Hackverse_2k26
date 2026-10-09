/**
 * SolarMind Work Order & Field Service Management Module
 * 
 * Provides API integrations for ticketing, technician assignments, field inspections,
 * status transitions, recovery verification, and audit trail history.
 */

import { apiClient, buildQueryParams } from './apiClient';

export const WORK_ORDER_STATUSES = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const WORK_ORDER_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const DEMO_WORK_ORDERS = [
  {
    id: 'WO-801',
    plant_id: 1,
    diagnosis_id: 'DIAG-401',
    title: 'Afternoon Tree Foliage Shading Remediation',
    priority: WORK_ORDER_PRIORITIES.HIGH,
    status: WORK_ORDER_STATUSES.COMPLETED,
    assigned_to: 'Arun Kumar',
    scheduled_date: '2026-10-09',
    due_date: '2026-10-10',
    instructions: 'Trim overgrown branches along south-west roof perimeter back by 3.0 meters.',
    checklist: [
      { item: 'Measure line of sight from south panels', completed: true },
      { item: 'Trim branches obstructing azimuth 180-220 degrees', completed: true },
      { item: 'Take post-service power verification reading', completed: true },
    ],
    notes: 'Completed tree trimming. Verified 33.4% recovery in string power.',
    created_at: '2026-10-09T08:00:00.000Z',
    updated_at: '2026-10-09T14:30:00.000Z',
  },
  {
    id: 'WO-802',
    plant_id: 1,
    diagnosis_id: 'DIAG-402',
    title: 'Demineralized Water Array Wash & Dust Removal',
    priority: WORK_ORDER_PRIORITIES.MEDIUM,
    status: WORK_ORDER_STATUSES.COMPLETED,
    assigned_to: 'SolarField Wash Crew #2',
    scheduled_date: '2026-10-08',
    due_date: '2026-10-09',
    instructions: 'Perform soft wash on panel array using demineralized water (<50 ppm TDS).',
    checklist: [
      { item: 'Inspect glass surface for cracks', completed: true },
      { item: 'Apply demineralized water squeegee wash', completed: true },
      { item: 'Check MC4 connectors for moisture ingress', completed: true },
    ],
    notes: 'Array washed clean. +8.0% yield improvement confirmed.',
    created_at: '2026-10-08T07:00:00.000Z',
    updated_at: '2026-10-08T10:00:00.000Z',
  },
  {
    id: 'WO-803',
    plant_id: 3,
    diagnosis_id: 'DIAG-403',
    title: 'DISCOM Distribution Grid High Voltage Line Audit',
    priority: WORK_ORDER_PRIORITIES.CRITICAL,
    status: WORK_ORDER_STATUSES.IN_PROGRESS,
    assigned_to: 'Ramesh Patel',
    scheduled_date: '2026-10-09',
    due_date: '2026-10-11',
    instructions: 'Coordinate with DISCOM substation engineer for transformer tap step-down.',
    checklist: [
      { item: 'Log grid voltage fluctuation profile', completed: true },
      { item: 'Submit formal tap change request to DISCOM', completed: true },
      { item: 'Verify voltage stabilization below 250V', completed: false },
    ],
    notes: 'Awaiting utility maintenance crew dispatch.',
    created_at: '2026-10-09T09:00:00.000Z',
    updated_at: '2026-10-09T13:00:00.000Z',
  },
];

let localWorkOrders = [...DEMO_WORK_ORDERS];

export const workOrderService = {
  /**
   * Retrieve paginated work orders with filtering
   */
  async getWorkOrders({
    plantId,
    assignedTo,
    status,
    priority,
    dueBefore,
    page = 1,
    pageSize = 20,
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({
        plant_id: plantId,
        assigned_to: assignedTo,
        status,
        priority,
        due_before: dueBefore,
        page,
        page_size: pageSize,
      });
      const response = await apiClient.get('/work-orders', { params });
      return response.data;
    }

    // Demo fallback
    let filtered = [...localWorkOrders];
    if (plantId && plantId !== 'ALL') {
      filtered = filtered.filter((w) => String(w.plant_id) === String(plantId));
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((w) => w.status === status);
    }
    if (priority && priority !== 'ALL') {
      filtered = filtered.filter((w) => w.priority === priority);
    }
    if (assignedTo) {
      filtered = filtered.filter((w) => (w.assigned_to || '').toLowerCase().includes(assignedTo.toLowerCase()));
    }

    const total = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /**
   * Retrieve single work order detail
   */
  async getWorkOrderById(id, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/work-orders/${id}`);
      return response.data;
    }

    const wo = localWorkOrders.find((w) => w.id === id);
    if (!wo) {
      throw new Error(`Work order '${id}' was not found.`);
    }
    return wo;
  },

  /**
   * Create a new work order
   */
  async createWorkOrder(workOrderData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.post('/work-orders', workOrderData);
      return response.data;
    }

    const newWo = {
      id: `WO-${800 + localWorkOrders.length + 1}`,
      ...workOrderData,
      status: workOrderData.status || WORK_ORDER_STATUSES.PENDING,
      priority: workOrderData.priority || WORK_ORDER_PRIORITIES.MEDIUM,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localWorkOrders = [newWo, ...localWorkOrders];
    return newWo;
  },

  /**
   * Update work order details / status
   */
  async updateWorkOrder(id, updateData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.patch(`/work-orders/${id}`, updateData);
      return response.data;
    }

    const idx = localWorkOrders.findIndex((w) => w.id === id);
    if (idx === -1) {
      throw new Error(`Work order '${id}' not found.`);
    }
    localWorkOrders[idx] = {
      ...localWorkOrders[idx],
      ...updateData,
      updated_at: new Date().toISOString(),
    };
    return localWorkOrders[idx];
  },

  /**
   * Submit technician field inspection checklist & findings
   */
  async submitInspection(id, inspectionData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.post(`/work-orders/${id}/inspection`, inspectionData);
      return response.data;
    }

    const wo = await this.getWorkOrderById(id, { useLiveApi: false });
    wo.status = WORK_ORDER_STATUSES.COMPLETED;
    wo.notes = `${wo.notes || ''}\nInspection completed: ${inspectionData.observations || ''}`;
    return wo;
  },

  /**
   * Verify post-repair generation recovery against baseline
   */
  async verifyRecovery(id, verificationData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.post(`/work-orders/${id}/verify`, verificationData);
      return response.data;
    }

    return {
      work_order_id: id,
      verified: true,
      recovery_percentage: 94.5,
      actual_power_kw: 4.85,
      baseline_expected_kw: 5.0,
      timestamp: new Date().toISOString(),
      verification_status: 'SUCCESS',
      message: 'Generation recovery meets or exceeds expected baseline criteria.',
    };
  },

  /**
   * Get work order status transition history audit trail
   */
  async getWorkOrderHistory(id, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/work-orders/${id}/history`);
      return response.data;
    }

    return [
      {
        id: `WOH-${id}-1`,
        work_order_id: id,
        from_status: null,
        to_status: WORK_ORDER_STATUSES.PENDING,
        actor: 'System Auto-Dispatcher',
        notes: 'Work order ticket created from AI fault diagnosis.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `WOH-${id}-2`,
        work_order_id: id,
        from_status: WORK_ORDER_STATUSES.PENDING,
        to_status: WORK_ORDER_STATUSES.ASSIGNED,
        actor: 'Admin Dispatcher',
        notes: 'Assigned to field technician.',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ];
  },

  /**
   * Reset local demo store
   */
  resetStore() {
    localWorkOrders = [...DEMO_WORK_ORDERS];
  },
};

export default workOrderService;
