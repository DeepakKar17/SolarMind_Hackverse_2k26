import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, ArrowRight, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSolarData } from '../../hooks/useSolarData';
import { IconButton, Badge, Modal } from '../common';
import { formatRelativeTime } from '../../utils/formatters';
import GuidedTroubleshootingAssistant from '../diagnosis/GuidedTroubleshootingAssistant';

export const NotificationMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAlertForQuestion, setSelectedAlertForQuestion] = useState(null);
  const menuRef = useRef(null);
  const { alerts, resolveAlert } = useSolarData();

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOpenQuestion = (alert) => {
    setSelectedAlertForQuestion(alert);
    setIsOpen(false);
  };

  return (
    <>
      <div style={{ position: 'relative' }} ref={menuRef}>
        <div style={{ position: 'relative' }}>
          <IconButton
            icon={Bell}
            ariaLabel={`Notifications (${activeAlerts.length} unread)`}
            size="sm"
            onClick={() => setIsOpen((prev) => !prev)}
          />
          {activeAlerts.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-danger)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {isOpen && (
          <div
            className="sm-card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '360px',
              padding: 0,
              zIndex: 100,
              boxShadow: 'var(--shadow-xl)',
              animation: 'modalPop 150ms ease-out',
            }}
          >
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                System Alerts ({activeAlerts.length})
              </strong>
              <Link
                to="/alerts"
                onClick={() => setIsOpen(false)}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}
              >
                View All
              </Link>
            </div>

            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {activeAlerts.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  No active anomalies or pending alerts.
                </div>
              ) : (
                activeAlerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Badge variant={alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'WARNING' ? 'warning' : 'info'}>
                        {(alert.faultCategory || alert.code || 'ALERT').replace(/_/g, ' ')}
                      </Badge>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                        {formatRelativeTime(alert.detectedAt || alert.timestamp)}
                      </span>
                    </div>

                    <strong style={{ color: 'var(--color-text-primary)' }}>
                      {alert.title || alert.message}
                    </strong>

                    {/* Notification-to-Question Interactive Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px dashed var(--color-border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenQuestion(alert)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 0',
                        }}
                      >
                        <HelpCircle size={12} />
                        <span>Answer Clarifying Question</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => resolveAlert(alert.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-secondary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        <span>Resolve</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-subtle)',
                textAlign: 'center',
              }}
            >
              <Link
                to="/diagnosis"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500,
                }}
              >
                <span>Run Full AI Anomaly Evaluation</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Question Modal from Notification */}
      {selectedAlertForQuestion && (
        <Modal
          isOpen={Boolean(selectedAlertForQuestion)}
          onClose={() => setSelectedAlertForQuestion(null)}
          title={`Troubleshoot Alert: ${selectedAlertForQuestion.title || selectedAlertForQuestion.id}`}
          size="lg"
        >
          <GuidedTroubleshootingAssistant
            initialFaultCode={selectedAlertForQuestion.code?.includes('GRID') ? 'F35' : ''}
            onClose={() => setSelectedAlertForQuestion(null)}
          />
        </Modal>
      )}
    </>
  );
};

export default NotificationMenu;
