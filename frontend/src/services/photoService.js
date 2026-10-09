/**
 * SolarMind Geo-Photo AI & Computer Vision Inspection Service
 * 
 * Provides multipart binary photo uploads, computer vision analysis,
 * processing status checks, and inspection photo catalog management.
 */

import { apiClient, uploadMultipart, buildQueryParams, API_BASE_URL } from './apiClient';

export const CV_DEFECT_CLASSES = {
  HOTSPOT_CELL: {
    label: 'Localized Thermal Hotspot',
    category: 'CELL_DEFECT',
    severity: 'CRITICAL',
    description: 'Severe localized thermal overheating (>15°C above adjacent cells) indicating bypass diode failure or cell crack.',
  },
  SURFACE_SOILING: {
    label: 'Surface Particulate Soiling & Dust',
    category: 'SURFACE_CONTAMINATION',
    severity: 'WARNING',
    description: 'Broadband dust and particulate buildup across module glass causing optical transmission losses.',
  },
  PHYSICAL_CRACK: {
    label: 'Front Glass Micro-Crack',
    category: 'PHYSICAL_DAMAGE',
    severity: 'CRITICAL',
    description: 'Mechanical impact fracture along module surface with moisture ingress risk.',
  },
  BIRD_DROPPINGS: {
    label: 'Localized Bird Dropping Occlusion',
    category: 'SURFACE_CONTAMINATION',
    severity: 'WARNING',
    description: 'Opaque localized bird drop causing localized reverse-bias hot-spotting risk.',
  },
  VEGETATION_SHADING: {
    label: 'Peripheral Vegetation Shadow',
    category: 'EXTERNAL_OBSTRUCTION',
    severity: 'WARNING',
    description: 'Tree foliage encroaching along array edge causing seasonal shading deficit.',
  },
  CLEAN_ARRAY: {
    label: 'Clean & Undamaged Surface',
    category: 'NORMAL',
    severity: 'INFO',
    description: 'No anomalies, hot spots, or significant soiling detected across module array.',
  },
};

export const photoService = {
  /**
   * Check if backend CV model is provisioned and online
   */
  async getModelStatus({ useLiveApi = false } = {}) {
    if (useLiveApi) {
      try {
        const res = await apiClient.get('/photos/model-status');
        return res.data;
      } catch {
        return { isConfigured: false, modelVersion: null, backend: 'UNAVAILABLE' };
      }
    }
    return {
      isConfigured: true,
      modelVersion: 'SolarMind-Vision-v1.4.2',
      modelType: 'PyTorch / YOLOv8-Solar Defect Classifier',
      targetInferenceMs: 380,
      supportedFormats: ['JPEG', 'PNG', 'WEBP'],
      maxResolutionMb: 25,
    };
  },

  /**
   * List paginated photo inspections
   */
  async getPhotos({
    plantId,
    inverterId,
    pvAssetId,
    faultDetected,
    processingStatus,
    page = 1,
    pageSize = 20,
    useLiveApi = false,
  } = {}) {
    if (useLiveApi) {
      const params = buildQueryParams({
        plant_id: plantId,
        inverter_id: inverterId,
        pv_asset_id: pvAssetId,
        fault_detected: faultDetected,
        processing_status: processingStatus,
        page,
        page_size: pageSize,
      });
      const response = await apiClient.get('/photos', { params });
      return response.data;
    }

    return {
      items: [],
      total: 0,
      page,
      page_size: pageSize,
      total_pages: 1,
    };
  },

  /**
   * Upload site inspection photo binary with multipart form data
   */
  async uploadPhotoFile({
    file,
    plantId,
    inverterId,
    pvAssetId,
    diagnosisId,
    latitude,
    longitude,
    gpsAccuracyM,
    notes,
    onProgress,
    useLiveApi = false,
  } = {}) {
    if (!file) {
      throw new Error('Image file is required for photo upload.');
    }
    if (!plantId) {
      throw new Error('plantId is required for photo upload.');
    }

    if (useLiveApi) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('plant_id', plantId);
      if (inverterId) formData.append('inverter_id', inverterId);
      if (pvAssetId) formData.append('pv_asset_id', pvAssetId);
      if (diagnosisId) formData.append('diagnosis_id', diagnosisId);
      if (latitude !== undefined && latitude !== null) formData.append('latitude', latitude);
      if (longitude !== undefined && longitude !== null) formData.append('longitude', longitude);
      if (gpsAccuracyM !== undefined && gpsAccuracyM !== null) formData.append('gps_accuracy_m', gpsAccuracyM);
      if (notes) formData.append('notes', notes);

      const data = await uploadMultipart('/photos/upload-file', formData, {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      });
      return data;
    }

    if (onProgress) {
      onProgress(100);
    }
    return {
      id: `PHOTO-${Math.floor(1000 + Math.random() * 9000)}`,
      plant_id: Number(plantId),
      inverter_id: inverterId || null,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || 'image/jpeg',
      uploaded_at: new Date().toISOString(),
      processing_status: 'COMPLETED',
      fault_detected: true,
      confidence_score: 92.5,
    };
  },

  /**
   * Retrieve photo inspection detail & metadata
   */
  async getPhotoDetail(photoId, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/photos/${photoId}`);
      return response.data;
    }
    return { id: photoId, processing_status: 'COMPLETED' };
  },

  /**
   * Check asynchronous vision processing status
   */
  async getPhotoStatus(photoId, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/photos/${photoId}/status`);
      return response.data;
    }
    return { photo_id: photoId, processing_status: 'COMPLETED', is_analyzed: true };
  },

  /**
   * Request Computer Vision defect inference on photo or upload payload
   */
  async analyzePhoto(param, options = {}) {
    if (typeof param === 'string') {
      const photoId = param;
      if (options.useLiveApi) {
        const response = await apiClient.post(`/photos/${photoId}/analyze`);
        return response.data;
      }
      return {
        photo_id: photoId,
        status: 'COMPLETED',
        detections: [
          { label: 'Surface Particulate Soiling', confidence: 0.92, category: 'SURFACE_CONTAMINATION', severity: 'WARNING' },
        ],
      };
    }

    const {
      file,
      plantId = 1,
      inverterId = 'INV-101',
      gpsCoordinates = null,
      manualGps = null,
      notes = '',
      simulateNotConfigured = false,
      simulateFailure = false,
      onProgress,
    } = param || {};

    if (simulateNotConfigured) {
      const err = new Error('Computer Vision model service is not configured. Please provision a vision inference worker.');
      err.code = 'MODEL_NOT_CONFIGURED';
      throw err;
    }

    if (simulateFailure) {
      const err = new Error('Failed to process image: Corrupted EXIF data or resolution below 640x480px.');
      err.code = 'PROCESSING_ERROR';
      throw err;
    }

    if (onProgress) {
      onProgress(100);
    }

    const finalGps = gpsCoordinates || manualGps || {
      latitude: 12.9716,
      longitude: 77.5946,
      altitudeM: 920,
      accuracyM: 4.5,
      source: 'Default Plant Geospatial Center',
    };

    const fileName = file?.name?.toLowerCase() || '';
    let defectKey = 'SURFACE_SOILING';

    if (fileName.includes('hotspot') || fileName.includes('thermal')) {
      defectKey = 'HOTSPOT_CELL';
    } else if (fileName.includes('crack') || fileName.includes('broken')) {
      defectKey = 'PHYSICAL_CRACK';
    } else if (fileName.includes('shade') || fileName.includes('tree')) {
      defectKey = 'VEGETATION_SHADING';
    } else if (fileName.includes('clean') || fileName.includes('normal')) {
      defectKey = 'CLEAN_ARRAY';
    }

    const defectInfo = CV_DEFECT_CLASSES[defectKey] || CV_DEFECT_CLASSES.SURFACE_SOILING;
    const confidence = defectKey === 'CLEAN_ARRAY' ? 96.8 : Number((88.5 + Math.random() * 8.5).toFixed(1));

    return {
      id: `PHOTO-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      plantId: Number(plantId),
      inverterId,
      fileName: file?.name || 'solar-array-capture.jpg',
      fileSizeKb: file?.size ? Math.round(file.size / 1024) : 1840,
      defectKey,
      defectLabel: defectInfo.label,
      category: defectInfo.category,
      severity: defectInfo.severity,
      confidence,
      description: defectInfo.description,
      gps: finalGps,
      notes: notes || 'Technician routine optical survey.',
      estimatedYieldImpactPercent: defectKey === 'CLEAN_ARRAY' ? 0 : defectKey === 'HOTSPOT_CELL' ? 14.5 : 7.8,
      recommendedAction:
        defectKey === 'HOTSPOT_CELL'
          ? 'Perform bypass diode continuity test and thermal imaging under >800 W/m² load.'
          : defectKey === 'PHYSICAL_CRACK'
          ? 'Isolate module string immediately to prevent DC earth leakage faults.'
          : defectKey === 'SURFACE_SOILING'
          ? 'Schedule morning demineralized water rinse with soft squeegee.'
          : defectKey === 'VEGETATION_SHADING'
          ? 'Trim overhang branches back by >=2.5 meters.'
          : 'Array is in optimal optical operating condition.',
      detections: [
        {
          box: [0.15, 0.22, 0.48, 0.65],
          label: defectInfo.label,
          confidence,
        },
      ],
      visionEngine: 'SolarMind-Vision-v1.4.2 (ResNet-50 + YOLOv8)',
    };
  },

  /**
   * Retrieve Vision AI analysis results for photo
   */
  async getPhotoResults(photoId, { useLiveApi = false } = {}) {
    if (useLiveApi) {
      const response = await apiClient.get(`/photos/${photoId}/results`);
      return response.data;
    }
    return { photo_id: photoId, status: 'COMPLETED', detections: [] };
  },

  /**
   * Get direct streamable URL for inspection image file
   */
  getPhotoFileUrl(photoId) {
    return `${API_BASE_URL}/photos/${photoId}/file`;
  },
};

export default photoService;
