import { useState } from 'react';
import AlertsTable from '../components/tables/AlertsTable';
import { Upload, CheckCircle2, Cpu, Sparkles } from 'lucide-react';
import { PageHeader, Card, Button, Badge } from '../components/common';

export const DiagnosticsPage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [visionResult, setVisionResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSimulateInspect = (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    // Simulate computer vision inspection analysis
    setTimeout(() => {
      setIsUploading(false);
      setVisionResult({
        detectedAnomaly: 'SURFACE_SOILING_DUST',
        confidence: 0.89,
        details: 'Granular particulate coating detected across lower quadrant cell arrays.',
        recommendation: 'Demineralized water rinse recommended. Estimated recoverable generation: +8.4%.',
      });
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="AI Fault Diagnostic Center"
        subtitle="Real-time electrical anomaly isolation and visual solar panel defect classification."
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Fault Diagnostics' },
        ]}
      />

      {/* Active & Historical Electrical Faults */}
      <AlertsTable showAll={true} />

      {/* Computer Vision Module Section */}
      <Card
        title="Modular Computer Vision (CV) Inspection"
        subtitle="Upload high-resolution optical or thermal images of your single-string array to detect hotspots, soiling, or physical microcracks."
        headerRight={
          <Badge variant="info">
            <Cpu size={12} style={{ marginRight: '2px' }} />
            <span>Pillow Vision Engine</span>
          </Badge>
        }
      >
        <form onSubmit={handleSimulateInspect} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
          >
            <input
              type="file"
              id="panel-photo-upload"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="panel-photo-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Upload size={22} />
              </div>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {selectedFile ? selectedFile.name : 'Select or drop solar array image here'}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Supports JPEG, PNG, WEBP (Optical RGB or Thermal IR)
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="primary"
              disabled={!selectedFile || isUploading}
              isLoading={isUploading}
              icon={Sparkles}
            >
              Run Vision Diagnosis
            </Button>
          </div>
        </form>

        {visionResult && (
          <div
            style={{
              marginTop: 'var(--space-5)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-secondary-light)',
              border: '1px solid var(--color-success-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <CheckCircle2 size={18} color="var(--color-secondary)" />
              <strong style={{ color: 'var(--color-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Vision Inspection Result: {visionResult.detectedAnomaly} ({(visionResult.confidence * 100).toFixed(0)}% confidence)
              </strong>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
              {visionResult.details}
            </p>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-surface)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
              💡 {visionResult.recommendation}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DiagnosticsPage;
