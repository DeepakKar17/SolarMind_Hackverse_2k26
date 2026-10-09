/**
 * SolarMind Fault Diagnosis & Anomaly Isolation Service Module
 * 
 * Provides an isolated, API-ready abstraction for AI-driven fault classifications,
 * deterministic electrical rule evaluations, sensor evidence matrices, why-low pipelines,
 * fault code lookups, and loss quantification.
 */

import { apiClient, buildQueryParams } from './apiClient';

/**
 * Diagnostic Engine Methodologies
 */
export const DIAGNOSIS_ENGINE_TYPES = {
  ML_CLASSIFIER: 'ML_CLASSIFIER',
  DETERMINISTIC_RULE: 'DETERMINISTIC_RULE',
  HEURISTIC: 'HEURISTIC',
};

/**
 * Fault Anomaly Categories
 */
export const FAULT_CATEGORIES = [
  { value: 'ALL', label: 'All Fault Categories' },
  { value: 'PARTIAL_SHADING', label: 'Partial Shading' },
  { value: 'SURFACE_SOILING', label: 'Surface Soiling / Dust' },
  { value: 'GRID_OVERVOLTAGE', label: 'Grid Overvoltage Trip' },
  { value: 'THERMAL_CLIPPING', label: 'Inverter Thermal Clipping' },
  { value: 'STRING_OPEN_CIRCUIT', label: 'String Open Circuit / Disconnect' },
  { value: 'POTENTIAL_HOTSPOT', label: 'Degraded Cell / Thermal Hotspot' },
];

/**
 * Diagnostic Status Options
 */
export const DIAGNOSIS_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active Anomaly' },
  { value: 'INVESTIGATING', label: 'Under Investigation' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed / False Positive' },
];

/**
 * Comprehensive Demo Diagnoses Fixtures
 */
export const DEMO_DIAGNOSES_FIXTURES = [
  {
    id: 'DIAG-401',
    plantId: 1,
    plant_id: 1,
    plantName: 'Residential Rooftop String-1',
    inverterId: 'INV-101',
    inverter_id: 'INV-101',
    affectedString: 'String 1 (South Roof)',
    faultClass: 'PARTIAL_SHADING',
    fault_class: 'PARTIAL_SHADING',
    faultTitle: 'Afternoon DC String Partial Shading Deficit',
    fault_title: 'Afternoon DC String Partial Shading Deficit',
    severity: 'WARNING',
    engineType: DIAGNOSIS_ENGINE_TYPES.ML_CLASSIFIER,
    engine_type: DIAGNOSIS_ENGINE_TYPES.ML_CLASSIFIER,
    confidenceScore: 92.4,
    confidence_score: 92.4,
    confidenceTier: 'HIGH_CONFIDENCE',
    confidence_tier: 'HIGH_CONFIDENCE',
    isSuspicionOnly: false,
    timestamp: '2026-10-09T13:30:00.000Z',
    status: 'ACTIVE',
    estimatedLostEnergyKwh: 3.45,
    estimated_lost_energy_kwh: 3.45,
    cumulativeLostEnergyKwh: 24.15,
    financialDeficitInr: 25.88,
    financial_deficit_inr: 25.88,
    probableCause: 'Localized tree foliage overgrowth along south-western perimeter.',
    probable_cause: 'Localized tree foliage overgrowth along south-western perimeter.',
    rootCauseSummary: '34% DC string current reduction observed during peak POA irradiance (>940 W/m²).',
    root_cause_summary: '34% DC string current reduction observed during peak POA irradiance (>940 W/m²).',
    electricalSignatures: {
      vDcDeltaPercent: -2.1,
      iDcDeltaPercent: -34.8,
      inverterTempC: 43.5,
      poaIrradianceWm2: 960,
      vAcGridV: 235.4,
      gridFrequencyHz: 50.02,
    },
    comparisonMetrics: [
      { parameter: 'Active AC Power', measured: '3.45 kW', expected: '5.20 kW', deviation: '-33.6%' },
      { parameter: 'DC String Current', measured: '9.20 A', expected: '13.62 A', deviation: '-32.5%' },
    ],
    recommendedInspectionSteps: [
      { step: 1, text: 'Inspect southern and south-western array perimeter for tree branch encroachment.' },
    ],
    history: [
      { date: '2026-10-09T13:30:00.000Z', action: 'Anomaly Detected', actor: 'SolarMind AI Engine', note: 'Confidence 92.4%' },
    ],
  },
  {
    id: 'DIAG-402',
    plantId: 1,
    plant_id: 1,
    plantName: 'Residential Rooftop String-1',
    inverterId: 'INV-101',
    inverter_id: 'INV-101',
    faultClass: 'SURFACE_SOILING',
    fault_class: 'SURFACE_SOILING',
    faultTitle: 'Progressive Array Surface Particulate Soiling',
    fault_title: 'Progressive Array Surface Particulate Soiling',
    severity: 'INFO',
    engineType: DIAGNOSIS_ENGINE_TYPES.HEURISTIC,
    engine_type: DIAGNOSIS_ENGINE_TYPES.HEURISTIC,
    confidenceScore: 84.0,
    confidence_score: 84.0,
    timestamp: '2026-10-08T17:00:00.000Z',
    status: 'ACTIVE',
    estimatedLostEnergyKwh: 2.10,
    estimated_lost_energy_kwh: 2.10,
    financialDeficitInr: 15.75,
    financial_deficit_inr: 15.75,
    probableCause: 'Gradual dust accumulation and soiling over 18 rain-free daylight cycles.',
    probable_cause: 'Gradual dust accumulation and soiling over 18 rain-free daylight cycles.',
    rootCauseSummary: 'Broadband 7.5% current reduction across daylight hours.',
    root_cause_summary: 'Broadband 7.5% current reduction across daylight hours.',
    comparisonMetrics: [
      { parameter: 'Active AC Power', measured: '4.80 kW', expected: '5.20 kW', deviation: '-7.7%' },
    ],
    recommendedInspectionSteps: [
      { step: 1, text: 'Schedule module washing using demineralized water.' },
    ],
    history: [],
  },
  {
    id: 'DIAG-403',
    plantId: 3,
    plant_id: 3,
    plantName: 'Suburban Net-Metered Array C',
    inverterId: 'INV-103',
    inverter_id: 'INV-103',
    faultClass: 'GRID_OVERVOLTAGE',
    fault_class: 'GRID_OVERVOLTAGE',
    faultTitle: 'Distribution Grid High Voltage Anti-Islanding Trip',
    fault_title: 'Distribution Grid High Voltage Anti-Islanding Trip',
    severity: 'CRITICAL',
    engineType: DIAGNOSIS_ENGINE_TYPES.DETERMINISTIC_RULE,
    engine_type: DIAGNOSIS_ENGINE_TYPES.DETERMINISTIC_RULE,
    confidenceScore: null,
    confidence_score: null,
    timestamp: '2026-10-07T13:00:00.000Z',
    status: 'ACTIVE',
    estimatedLostEnergyKwh: 4.70,
    estimated_lost_energy_kwh: 4.70,
    financialDeficitInr: 38.07,
    financial_deficit_inr: 38.07,
    probableCause: 'DISCOM line voltage exceeded 253V threshold under high feed-in.',
    probable_cause: 'DISCOM line voltage exceeded 253V threshold under high feed-in.',
    rootCauseSummary: 'Overvoltage trip at 254.2V triggered anti-islanding disconnect.',
    root_cause_summary: 'Overvoltage trip at 254.2V triggered anti-islanding disconnect.',
    comparisonMetrics: [],
    recommendedInspectionSteps: [
      { step: 1, text: 'Contact DISCOM utility for distribution transformer tap adjustment.' },
    ],
    history: [],
  },
  {
    id: 'DIAG-404',
    plantId: 4,
    plant_id: 4,
    plantName: 'Kaveri Commercial Canopy D',
    inverterId: 'INV-104A',
    inverter_id: 'INV-104A',
    faultClass: 'THERMAL_CLIPPING',
    fault_class: 'THERMAL_CLIPPING',
    faultTitle: 'IGBT Thermal Throttling Suspicion',
    fault_title: 'IGBT Thermal Throttling Suspicion',
    severity: 'WARNING',
    engineType: DIAGNOSIS_ENGINE_TYPES.HEURISTIC,
    engine_type: DIAGNOSIS_ENGINE_TYPES.HEURISTIC,
    confidenceScore: 64.5,
    confidence_score: 64.5,
    isSuspicionOnly: true,
    timestamp: '2026-10-09T14:10:00.000Z',
    status: 'ACTIVE',
    estimatedLostEnergyKwh: 1.80,
    estimated_lost_energy_kwh: 1.80,
    financialDeficitInr: 16.56,
    financial_deficit_inr: 16.56,
    probableCause: 'Ambient temperature probe uncalibrated; sensor drift suspected.',
    probable_cause: 'Ambient temperature probe uncalibrated; sensor drift suspected.',
    rootCauseSummary: 'Internal temperature threshold exceeded with uncalibrated ambient sensor.',
    root_cause_summary: 'Internal temperature threshold exceeded with uncalibrated ambient sensor.',
    comparisonMetrics: [],
    recommendedInspectionSteps: [
      { step: 1, text: 'Clean inverter heatsink fins and inspect cooling airflow.' },
    ],
    history: [],
  },
  {
    id: 'DIAG-405',
    plantId: 6,
    plant_id: 6,
    plantName: 'Deccan Heights Rooftop F',
    inverterId: 'INV-106A',
    inverter_id: 'INV-106A',
    faultClass: 'STRING_OPEN_CIRCUIT',
    fault_class: 'STRING_OPEN_CIRCUIT',
    faultTitle: 'Suspected String Intermittent Disconnect',
    fault_title: 'Suspected String Intermittent Disconnect',
    severity: 'WARNING',
    engineType: DIAGNOSIS_ENGINE_TYPES.HEURISTIC,
    engine_type: DIAGNOSIS_ENGINE_TYPES.HEURISTIC,
    confidenceScore: null,
    confidence_score: null,
    hasInsufficientEvidence: true,
    isSuspicionOnly: true,
    dataQualityWarning: 'CRITICAL DATA WARNING: Stale telemetry gateway stream (>24 hours lag) with 45% missing packet rate. Data volume is insufficient to definitively classify electrical fault.',
    timestamp: '2026-10-09T11:00:00.000Z',
    status: 'ACTIVE',
    estimatedLostEnergyKwh: null,
    estimated_lost_energy_kwh: null,
    financialDeficitInr: null,
    financial_deficit_inr: null,
    probableCause: 'Stale telemetry stream; insufficient continuous samples to isolate fault.',
    probable_cause: 'Stale telemetry stream; insufficient continuous samples to isolate fault.',
    rootCauseSummary: 'Data coverage below threshold for definitive diagnostic verdict.',
    root_cause_summary: 'Data coverage below threshold for definitive diagnostic verdict.',
    comparisonMetrics: [],
    recommendedInspectionSteps: [
      { step: 1, text: 'Check telemetry logger connection and cellular signal strength.' },
    ],
    history: [],
  },
];

let localDiagnoses = [...DEMO_DIAGNOSES_FIXTURES];

export const diagnosisService = {
  /**
   * Fetch diagnoses with filtering, search, and pagination
   */
  async getDiagnoses({
    plantId = 'ALL',
    inverterId = 'ALL',
    pvAssetId,
    faultClass = 'ALL',
    category = 'ALL',
    severity = 'ALL',
    status = 'ALL',
    search = '',
    startTime,
    endTime,
    page = 1,
    pageSize = 10,
    useLiveApi = false,
  } = {}) {
    const targetCategory = category !== 'ALL' ? category : (faultClass !== 'ALL' ? faultClass : undefined);

    if (useLiveApi) {
      const params = buildQueryParams({
        plant_id: plantId !== 'ALL' ? plantId : undefined,
        inverter_id: inverterId !== 'ALL' ? inverterId : undefined,
        pv_asset_id: pvAssetId,
        fault_class: targetCategory,
        severity: severity !== 'ALL' ? severity : undefined,
        status: status !== 'ALL' ? status : undefined,
        search,
        start_time: startTime,
        end_time: endTime,
        page,
        page_size: pageSize,
      });
      const response = await apiClient.get('/diagnoses', { params });
      return response.data;
    }

    // Demo fallback
    let filtered = [...localDiagnoses];

    if (plantId && plantId !== 'ALL') {
      filtered = filtered.filter((d) => String(d.plantId || d.plant_id) === String(plantId));
    }
    if (inverterId && inverterId !== 'ALL') {
      filtered = filtered.filter((d) => (d.inverterId || d.inverter_id) === inverterId);
    }
    if (targetCategory && targetCategory !== 'ALL') {
      filtered = filtered.filter((d) => (d.faultClass || d.fault_class) === targetCategory);
    }
    if (severity && severity !== 'ALL') {
      filtered = filtered.filter((d) => d.severity === severity);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((d) => d.status === status);
    }

    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      filtered = filtered.filter((d) => {
        const title = (d.faultTitle || d.fault_title || '').toLowerCase();
        const cause = (d.probableCause || d.probable_cause || '').toLowerCase();
        const root = (d.rootCauseSummary || d.root_cause_summary || '').toLowerCase();
        const plant = (d.plantName || '').toLowerCase();
        const fClass = (d.faultClass || d.fault_class || '').toLowerCase();
        const id = (d.id || '').toLowerCase();
        return (
          title.includes(query) ||
          cause.includes(query) ||
          root.includes(query) ||
          plant.includes(query) ||
          fClass.includes(query) ||
          id.includes(query)
        );
      });
    }

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
   * Fetch single diagnosis detail by ID
   */
  async getDiagnosisById(id, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/diagnoses/${id}`);
      return response.data;
    }

    const diagnosis = localDiagnoses.find((d) => d.id === id);
    if (!diagnosis) {
      throw new Error(`Diagnosis record with ID "${id}" was not found.`);
    }
    return diagnosis;
  },

  /**
   * Trigger AI Fault Analysis
   */
  async runAnalysis({ plantId = 1, inverterId, startTime, endTime, dryRun = false, useLiveApi = false } = {}) {
    if (useLiveApi) {
      const payload = {
        plant_id: Number(plantId),
        inverter_id: inverterId || null,
        start_time: startTime ? new Date(startTime).toISOString() : null,
        end_time: endTime ? new Date(endTime).toISOString() : null,
        dry_run: dryRun,
      };
      const response = await apiClient.post('/diagnoses/analyze', payload);
      return response.data;
    }

    const newScanId = `DIAG-${Math.floor(406 + Math.random() * 90)}`;
    const newDiagnosis = {
      id: newScanId,
      plantId: Number(plantId),
      plant_id: Number(plantId),
      plantName: plantId === 1 ? 'Residential Rooftop String-1' : `Solar Installation #${plantId}`,
      inverterId: inverterId || 'INV-101',
      inverter_id: inverterId || 'INV-101',
      faultClass: 'PARTIAL_SHADING',
      fault_class: 'PARTIAL_SHADING',
      faultTitle: 'Real-Time Evaluated Anomaly Scan',
      fault_title: 'Real-Time Evaluated Anomaly Scan',
      severity: 'WARNING',
      confidenceScore: 88.5,
      confidence_score: 88.5,
      timestamp: new Date().toISOString(),
      status: 'ACTIVE',
      estimatedLostEnergyKwh: 2.80,
      estimated_lost_energy_kwh: 2.80,
      financialDeficitInr: 21.00,
      financial_deficit_inr: 21.00,
      probableCause: 'Live signature analysis detected current attenuation.',
      probable_cause: 'Live signature analysis detected current attenuation.',
      rootCauseSummary: 'Completed physical model comparison.',
      root_cause_summary: 'Completed physical model comparison.',
      comparisonMetrics: [],
      history: [
        { date: new Date().toISOString(), action: 'AI Scan Executed', actor: 'SolarMind AI Engine', note: 'Scan completed.' },
      ],
    };

    localDiagnoses = [newDiagnosis, ...localDiagnoses];
    return newDiagnosis;
  },

  /**
   * Execute Why-Low generation shortfall evaluation workflow
   */
  async diagnoseWhyLow({
    plantId,
    inverterId,
    targetDate,
    baselinePeriodDays = 7,
    toleranceBandPercent = 10.0,
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const payload = {
        plant_id: Number(plantId),
        inverter_id: inverterId || null,
        target_date: targetDate || new Date().toISOString().slice(0, 10),
        baseline_period_days: baselinePeriodDays,
        tolerance_band_percent: toleranceBandPercent,
      };
      const response = await apiClient.post('/diagnoses/why-low', payload);
      return response.data;
    }

    return {
      plant_id: plantId,
      inverter_id: inverterId || 'INV-101',
      target_date: targetDate || new Date().toISOString().slice(0, 10),
      evaluation_summary: 'Comprehensive 10-step physical diagnostic evaluation complete.',
      has_shortfall: true,
      actual_yield_kwh: 18.2,
      expected_yield_kwh: 24.5,
      shortfall_kwh: 6.3,
      shortfall_percentage: 25.7,
      primary_cause: 'PARTIAL_SHADING',
      secondary_causes: ['SURFACE_SOILING'],
      recommended_action: 'Trim tree foliage encroaching south-west perimeter.',
      confidence_score: 91.2,
    };
  },

  /**
   * Manufacturer fault code knowledge lookup
   */
  async lookupFaultCode({ manufacturer, code, model, useLiveApi = false } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({ manufacturer, code, model });
      const response = await apiClient.get('/diagnoses/fault-code/lookup', { params });
      return response.data;
    }

    return {
      manufacturer,
      code,
      model,
      description: 'Documented grid-tied inverter operational alarm code.',
      severity: 'WARNING',
      source_document: 'OEM Technical Manual',
      official_troubleshooting_steps: ['Check AC grid voltage connection', 'Verify inverter DC breaker switch'],
      electrical_hazard_warnings: ['Ensure DC isolator is opened prior to servicing'],
      solarmind_interpretation: 'Transient grid disturbance or line impedance peak.',
      is_resolved: true,
    };
  },

  /**
   * List supported manufacturers in fault knowledge base
   */
  async listFaultCodeManufacturers({ useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get('/diagnoses/fault-code/manufacturers');
      return response.data;
    }
    return ['Deye', 'SMA', 'Fronius', 'SolarEdge', 'Growatt', 'Sungrow'];
  },

  /**
   * List fault code catalog entries
   */
  async listFaultCodeCatalog({ manufacturer, useLiveApi = false } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({ manufacturer });
      const response = await apiClient.get('/diagnoses/fault-code/catalog', { params });
      return response.data;
    }
    return [];
  },

  /**
   * Estimate energy loss and prioritized recommendations
   */
  async estimateEnergyLoss(lossRequest, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.post('/diagnoses/energy-loss/estimate', lossRequest);
      return response.data;
    }

    return {
      plant_id: lossRequest.plant_id || 1,
      estimated_energy_shortfall_kwh: 4.85,
      estimated_financial_loss_inr: 31.52,
      confidence_interval_kwh: [4.2, 5.5],
      calculation_method: 'PHYSICAL_CLEAR_SKY_BASELINE',
      recommendations: [
        { priority: 'HIGH', action: 'Vegetation trimming', estimated_recovery_kwh: 3.45 },
      ],
    };
  },

  /**
   * Update diagnosis status & notes
   */
  async updateDiagnosis(id, updateData, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.patch(`/diagnoses/${id}`, updateData);
      return response.data;
    }

    const diag = localDiagnoses.find((d) => d.id === id);
    if (!diag) throw new Error(`Diagnosis ${id} not found.`);
    Object.assign(diag, updateData);
    return diag;
  },

  /**
   * Update diagnosis status with audit note
   */
  async updateDiagnosisStatus(id, newStatus, { note = '', actor = 'Operator' } = {}) {
    const diag = localDiagnoses.find((d) => d.id === id);
    if (!diag) throw new Error(`Diagnosis ${id} not found.`);

    diag.status = newStatus;
    diag.history = [
      {
        date: new Date().toISOString(),
        action: `Status changed to ${newStatus}`,
        actor,
        note: note || `Updated status to ${newStatus}.`,
      },
      ...(diag.history || []),
    ];

    return diag;
  },

  /**
   * Link a work order to a diagnosis
   */
  async linkWorkOrder(diagnosisId, workOrderId) {
    const diag = localDiagnoses.find((d) => d.id === diagnosisId);
    if (diag) {
      diag.workOrderId = workOrderId;
      diag.history = [
        {
          date: new Date().toISOString(),
          action: 'Work Order Linked',
          actor: 'System',
          note: `Work Order ${workOrderId} dispatched and linked.`,
        },
        ...(diag.history || []),
      ];
    }
    return diag;
  },

  /**
   * Reset in-memory dataset to default fixtures
   */
  resetStore() {
    localDiagnoses = [...DEMO_DIAGNOSES_FIXTURES];
  },
};

export default diagnosisService;
