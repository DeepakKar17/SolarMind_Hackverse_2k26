import { Link } from 'react-router-dom';
import { Card, Button, Badge } from '../common';
import { CheckSquare, Wrench, Camera, ArrowRight, ExternalLink } from 'lucide-react';

export const DiagnosisInspectionChecklist = ({
  recommendedInspectionSteps = [],
  relatedImages = [],
  workOrderId = null,
  onOpenWorkOrderModal,
}) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
      {/* Field Inspection Checklist */}
      <Card
        title="Recommended Field Inspection Checklist"
        subtitle="Standard operating procedures for technician dispatch & verification"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {recommendedInspectionSteps.map((stepItem, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-canvas)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '11px',
                  flexShrink: 0,
                }}
              >
                {stepItem.step || idx + 1}
              </div>
              <span style={{ color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {stepItem.text}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Linked Work Orders & Visual Imagery */}
      <Card
        title="Related Work Orders & Inspection Imagery"
        subtitle="Connected field maintenance tickets and drone / optical inspection assets"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Work Order Section */}
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wrench size={16} color="var(--color-primary)" />
                <strong style={{ fontSize: 'var(--font-size-sm)' }}>Maintenance Work Order</strong>
              </div>
              {workOrderId ? (
                <Badge variant="success" dot>Dispatched</Badge>
              ) : (
                <Badge variant="warning">Not Created</Badge>
              )}
            </div>

            {workOrderId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Linked Ticket: <strong>{workOrderId}</strong>
                </span>
                <Link
                  to={`/work-orders/${workOrderId}`}
                  className="sm-btn sm-btn-outline sm-btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  <span>Open Ticket</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  No corrective work order dispatched yet.
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Wrench}
                  onClick={onOpenWorkOrderModal}
                >
                  Create Work Order
                </Button>
              </div>
            )}
          </div>

          {/* Related Images Section */}
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={16} color="var(--color-primary)" />
                <strong style={{ fontSize: 'var(--font-size-sm)' }}>Geo-Tagged Photo Assets</strong>
              </div>
              <Link
                to="/geo-photo"
                style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <span>Upload New</span>
                <ExternalLink size={11} />
              </Link>
            </div>

            {relatedImages && relatedImages.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {relatedImages.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2)',
                      backgroundColor: 'var(--color-bg-canvas)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <span>{img.label}</span>
                    <Badge variant="success" size="sm">{img.confidence}% CV Match</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                No optical or thermal drone imagery currently tagged to this diagnosis incident.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DiagnosisInspectionChecklist;
