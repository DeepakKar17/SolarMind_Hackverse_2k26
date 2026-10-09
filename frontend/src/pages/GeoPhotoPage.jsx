import { useState, useEffect, useRef } from 'react';
import { PageHeader, Card, Button, Badge, Input, Select, Textarea, StatCard, LoadingState, ErrorState, EmptyState } from '../components/common';
import {
  Camera,
  Upload,
  CheckCircle2,
  MapPin,
  Sparkles,
  AlertCircle,
  ShieldAlert,
  Compass,
  Layers,
  Wrench,
  RefreshCw,
  Eye,
  Info,
  Sliders,
  AlertTriangle,
  X,
  FileImage,
} from 'lucide-react';
import { photoService, CV_DEFECT_CLASSES } from '../services/photoService';
import { formatDateTime } from '../utils/formatters';
import WorkOrderModal from '../components/dashboard/WorkOrderModal';
import { useSolarData } from '../hooks/useSolarData';

export const GeoPhotoPage = () => {
  const { addWorkOrder } = useSolarData();
  const fileInputRef = useRef(null);

  // Form & File States
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [plantId, setPlantId] = useState('1');
  const [inverterId, setInverterId] = useState('INV-101');
  const [notes, setNotes] = useState('');

  // GPS States
  const [gpsMode, setGpsMode] = useState('DEVICE'); // 'DEVICE' | 'MANUAL'
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('IDLE'); // 'IDLE' | 'ACQUIRING' | 'ACQUIRED' | 'DENIED' | 'UNSUPPORTED'
  const [manualGps, setManualGps] = useState({ latitude: '12.9716', longitude: '77.5946', altitudeM: '920' });

  // Upload & Analysis States
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('IDLE'); // 'IDLE' | 'UPLOADING' | 'INFERENCE' | 'COMPLETED' | 'FAILED' | 'NOT_CONFIGURED'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  // Vision Model Availability State
  const [modelConfig, setModelConfig] = useState(null);
  const [simulateModelDisabled, setSimulateModelDisabled] = useState(false);
  const [simulateErrorToggle, setSimulateErrorToggle] = useState(false);

  // Work Order Modal
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Check model status on mount
  useEffect(() => {
    photoService.getModelStatus().then((cfg) => setModelConfig(cfg));
  }, []);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Handle File Drop / Selection
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnalysisError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    if (previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    const objectUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : 'blob:preview';
    setPreviewUrl(objectUrl);
    setAnalysisStatus('IDLE');
    setAnalysisResult(null);
    setAnalysisError(null);
  };

  const handleClearImage = () => {
    if (previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisStatus('IDLE');
    setAnalysisResult(null);
    setAnalysisError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Acquire Device GPS with explicit permission
  const handleAcquireDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('UNSUPPORTED');
      return;
    }

    setGpsStatus('ACQUIRING');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          altitudeM: position.coords.altitude ? Math.round(position.coords.altitude) : 920,
          accuracyM: Math.round(position.coords.accuracy),
          source: 'Live Browser Geolocation API',
        });
        setGpsStatus('ACQUIRED');
      },
      (error) => {
        setGpsStatus(error.code === error.PERMISSION_DENIED ? 'DENIED' : 'UNSUPPORTED');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Submit and Analyze
  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) return;

    try {
      setAnalysisError(null);
      setAnalysisStatus('UPLOADING');
      setUploadProgress(10);

      // Check if model is simulated as unconfigured
      if (simulateModelDisabled) {
        setAnalysisStatus('NOT_CONFIGURED');
        return;
      }

      const result = await photoService.analyzePhoto({
        file: selectedFile,
        plantId,
        inverterId,
        gpsCoordinates: gpsMode === 'DEVICE' ? gpsCoords : null,
        manualGps:
          gpsMode === 'MANUAL'
            ? {
                latitude: Number(manualGps.latitude) || 12.9716,
                longitude: Number(manualGps.longitude) || 77.5946,
                altitudeM: Number(manualGps.altitudeM) || 920,
                source: 'Manual Technician Coordinate Entry',
              }
            : null,
        notes,
        simulateNotConfigured: simulateModelDisabled,
        simulateFailure: simulateErrorToggle,
        onProgress: (p) => {
          setUploadProgress(p);
          if (p >= 80) setAnalysisStatus('INFERENCE');
        },
      });

      setAnalysisResult(result);
      setAnalysisStatus('COMPLETED');
    } catch (err) {
      setAnalysisError(err.message || 'Image defect classification failed.');
      if (err.code === 'MODEL_NOT_CONFIGURED') {
        setAnalysisStatus('NOT_CONFIGURED');
      } else {
        setAnalysisStatus('FAILED');
      }
    }
  };

  const handleCreateWorkOrder = (data) => {
    const created = addWorkOrder({
      ...data,
      plantId: Number(plantId),
      notes: `${notes} [Linked from Geo-Photo AI inspection ${analysisResult?.id || ''}]`,
    });
    setToastMessage(`Maintenance Work Order ${created.id} successfully created from photo inspection!`);
    setIsWorkOrderModalOpen(false);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <PageHeader
        title="Geo-Tagged Photo Inspection & Computer Vision"
        subtitle="Upload optical and thermal infrared drone / smartphone imagery to isolate cell hotspots, glass cracks, and soiling patterns."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Photo Inspection AI' },
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSimulateModelDisabled(!simulateModelDisabled)}
            >
              <Sliders size={14} />
              <span>Vision Model: {simulateModelDisabled ? 'OFF (Not Configured)' : 'ON'}</span>
            </Button>
          </div>
        }
      />

      {/* Action Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            &times;
          </button>
        </div>
      )}

      {/* Model Not Configured State Banner */}
      {analysisStatus === 'NOT_CONFIGURED' && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-2)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: 'var(--color-warning-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)', display: 'block' }}>
                Computer Vision Model Service Not Configured
              </strong>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                No active neural inference worker is configured on <code>/api/v1/photos/analyze</code>. To enable automatic optical defect detection and hotspot classification, provision a PyTorch / YOLOv8 vision sidecar or toggle the model state.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Button variant="primary" size="sm" onClick={() => setSimulateModelDisabled(false)}>
                  Re-Enable Vision Inference Engine
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top 4 Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <StatCard
          title="CV Inference Engine"
          value={simulateModelDisabled ? 'Unconfigured' : 'YOLOv8-SolarCV'}
          subtext="Model version v1.4.2"
          icon={Camera}
          variant={simulateModelDisabled ? 'warning' : 'success'}
        />
        <StatCard
          title="Defect Detection Classes"
          value="6 Categories"
          subtext="Hotspots, Soiling, Cracks, Shading"
          icon={Layers}
          variant="default"
        />
        <StatCard
          title="Geospatial Accuracy"
          value={gpsCoords ? `±${gpsCoords.accuracyM}m` : 'EXIF / GPS Ready'}
          subtext="Lat/Long coordinate anchoring"
          icon={Compass}
          variant="info"
        />
        <StatCard
          title="Median Inference Speed"
          value="380 ms"
          subtext="Edge / Cloud PyTorch worker"
          icon={Sparkles}
          variant="default"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Left Column: Image Selection & Form */}
        <Card title="Upload & Geotag Solar Inspection Image">
          <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Drag & Drop / File Input Box */}
            {!previewUrl ? (
              <div
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'var(--color-bg-canvas)',
                  transition: 'border-color var(--transition-fast)',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Upload size={24} />
                  </div>
                  <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                    Click to select or drag & drop array photo
                  </strong>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Supports high-resolution JPEG, PNG, WEBP with optical or thermal signatures (Max 25MB)
                  </span>
                </div>
              </div>
            ) : (
              /* Image Preview Box */
              <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img
                  src={previewUrl}
                  alt="Selected Solar Panel"
                  style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    display: 'flex',
                    gap: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleClearImage}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--radius-full)',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Remove selected image"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-bg-surface)',
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{selectedFile?.name}</span>
                  <span>{selectedFile?.size ? `${Math.round(selectedFile.size / 1024)} KB` : ''}</span>
                </div>
              </div>
            )}

            {/* Target Plant & Inverter Selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Select
                label="Target Solar Plant"
                value={plantId}
                onChange={(e) => setPlantId(e.target.value)}
                options={[
                  { value: '1', label: 'Residential Rooftop String-1 (5.2 kWp)' },
                  { value: '2', label: 'Bhartiya Villa Single-String (3.3 kWp)' },
                  { value: '3', label: 'Suburban Net-Metered Array C (6.0 kWp)' },
                  { value: '4', label: 'Kaveri Commercial Canopy D (10.0 kWp)' },
                ]}
              />

              <Select
                label="Target Inverter Unit"
                value={inverterId}
                onChange={(e) => setInverterId(e.target.value)}
                options={[
                  { value: 'INV-101', label: 'INV-101 (Single-String MPPT)' },
                  { value: 'INV-102', label: 'INV-102 (Bhartiya String 1)' },
                  { value: 'INV-103', label: 'INV-103 (Suburban Net-Meter)' },
                  { value: 'INV-104A', label: 'INV-104A (Canopy Inverter)' },
                ]}
              />
            </div>

            {/* GPS Geotag Section */}
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-bg-canvas)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
                  <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                    Geospatial GPS Coordinate Anchoring
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button
                    type="button"
                    variant={gpsMode === 'DEVICE' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setGpsMode('DEVICE')}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Device GPS
                  </Button>
                  <Button
                    type="button"
                    variant={gpsMode === 'MANUAL' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setGpsMode('MANUAL')}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Manual Coordinates
                  </Button>
                </div>
              </div>

              {gpsMode === 'DEVICE' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div>
                    {gpsStatus === 'ACQUIRED' && gpsCoords ? (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
                        ✓ Lat: {gpsCoords.latitude}°, Long: {gpsCoords.longitude}° (±{gpsCoords.accuracyM}m)
                      </span>
                    ) : gpsStatus === 'ACQUIRING' ? (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
                        Requesting browser geolocation permission...
                      </span>
                    ) : gpsStatus === 'DENIED' ? (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
                        Browser location permission denied. Use manual coordinates below.
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Click to request live GPS coordinates from device browser.
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAcquireDeviceGps}
                    isLoading={gpsStatus === 'ACQUIRING'}
                  >
                    Acquire GPS
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                  <Input
                    label="Latitude (°N)"
                    value={manualGps.latitude}
                    onChange={(e) => setManualGps({ ...manualGps, latitude: e.target.value })}
                  />
                  <Input
                    label="Longitude (°E)"
                    value={manualGps.longitude}
                    onChange={(e) => setManualGps({ ...manualGps, longitude: e.target.value })}
                  />
                  <Input
                    label="Altitude (m)"
                    value={manualGps.altitudeM}
                    onChange={(e) => setManualGps({ ...manualGps, altitudeM: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Inspection Field Notes */}
            <Textarea
              label="Field Observations & Inspection Notes"
              placeholder="e.g. Visual survey of String 1 lower module row after dust storm..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            {/* Upload Progress Bar */}
            {analysisStatus === 'UPLOADING' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  <span>Uploading payload to vision pipeline...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--color-bg-canvas)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${uploadProgress}%`,
                      backgroundColor: 'var(--color-primary)',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Neural Inference Spinner */}
            {analysisStatus === 'INFERENCE' && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <Sparkles size={18} style={{ color: 'var(--color-primary)', animation: 'spin 2s linear infinite' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                  Running PyTorch / YOLOv8 cell defect isolation & thermal segmentation...
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearImage}
                disabled={!selectedFile || analysisStatus === 'UPLOADING' || analysisStatus === 'INFERENCE'}
              >
                Reset Image
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || analysisStatus === 'UPLOADING' || analysisStatus === 'INFERENCE'}
                isLoading={analysisStatus === 'UPLOADING' || analysisStatus === 'INFERENCE'}
                icon={Sparkles}
              >
                Execute CV Defect Scan
              </Button>
            </div>
          </form>
        </Card>

        {/* Right Column: Results & Evidence Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {analysisStatus === 'FAILED' && (
            <ErrorState
              title="Inspection Processing Failure"
              message={analysisError || 'Unable to process image due to resolution or unreadable EXIF metadata.'}
              onRetry={handleAnalyze}
            />
          )}

          {analysisStatus === 'COMPLETED' && analysisResult && (
            <Card
              title="Computer Vision Defect Analysis Dossier"
              subtitle={`Classification ID: ${analysisResult.id} | Engine: ${analysisResult.visionEngine}`}
              headerRight={
                <Badge
                  variant={
                    analysisResult.severity === 'CRITICAL'
                      ? 'danger'
                      : analysisResult.severity === 'WARNING'
                      ? 'warning'
                      : 'success'
                  }
                  dot
                >
                  {analysisResult.severity}
                </Badge>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Defect Classification Banner */}
                <div
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor:
                      analysisResult.defectKey === 'CLEAN_ARRAY'
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(234, 179, 8, 0.1)',
                    border:
                      analysisResult.defectKey === 'CLEAN_ARRAY'
                        ? '1px solid var(--color-success)'
                        : '1px solid var(--color-warning-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {analysisResult.defectLabel}
                    </h3>
                    <Badge variant={analysisResult.confidence >= 90 ? 'success' : 'warning'}>
                      {analysisResult.confidence}% CV Match
                    </Badge>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                    {analysisResult.description}
                  </p>
                </div>

                {/* Evidence Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>Estimated Generation Loss</span>
                    <strong style={{ fontSize: 'var(--font-size-sm)', color: analysisResult.estimatedYieldImpactPercent > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {analysisResult.estimatedYieldImpactPercent > 0 ? `-${analysisResult.estimatedYieldImpactPercent}% Yield Deficit` : '0% (Nominal)'}
                    </strong>
                  </div>

                  <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>EXIF Geolocation</span>
                    <strong style={{ fontSize: '11px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <MapPin size={12} color="var(--color-primary)" />
                      {analysisResult.gps.latitude}°, {analysisResult.gps.longitude}°
                    </strong>
                  </div>
                </div>

                {/* Actionable Maintenance Recommendation */}
                <div
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderLeft: '3px solid var(--color-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '2px' }}>
                    Actionable Field Guidance:
                  </strong>
                  {analysisResult.recommendedAction}
                </div>

                {/* Dispatch Work Order Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Wrench}
                    onClick={() => setIsWorkOrderModalOpen(true)}
                  >
                    Dispatch Corrective Work Order
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {analysisStatus === 'IDLE' && (
            <Card style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--space-3)',
                }}
              >
                <FileImage size={24} />
              </div>
              <h4 style={{ margin: '0 0 var(--space-1) 0', color: 'var(--color-text-primary)' }}>
                No Inspection Image Analyzed
              </h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '300px', margin: '0 auto' }}>
                Select an optical photograph or thermal infrared capture of your rooftop array to evaluate cell hotspots and soiling.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Linked Work Order Modal */}
      <WorkOrderModal
        isOpen={isWorkOrderModalOpen}
        onClose={() => setIsWorkOrderModalOpen(false)}
        diagnosis={{
          faultClass: analysisResult?.defectKey || 'SURFACE_SOILING',
          rootCauseSummary: analysisResult?.recommendedAction || '',
          estimatedLostEnergyKwh: 2.8,
        }}
        onSubmit={handleCreateWorkOrder}
      />
    </div>
  );
};

export default GeoPhotoPage;
