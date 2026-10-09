import { Badge } from '../common';
import { INVERTER_STATUS_TYPES } from '../../services/inverterService';
import { CheckCircle2, AlertTriangle, AlertOctagon, Clock, PowerOff, HelpCircle } from 'lucide-react';

export const InverterDiagnosticBadge = ({ status, size = 'sm' }) => {
  switch (status) {
    case INVERTER_STATUS_TYPES.NORMAL:
      return (
        <Badge variant="success" size={size} dot>
          Normal Operation
        </Badge>
      );
    case INVERTER_STATUS_TYPES.WARNING:
      return (
        <Badge variant="warning" size={size} dot>
          Warning / Anomaly
        </Badge>
      );
    case INVERTER_STATUS_TYPES.FAULT:
      return (
        <Badge variant="danger" size={size} dot>
          Active Fault
        </Badge>
      );
    case INVERTER_STATUS_TYPES.STALE_TELEMETRY:
      return (
        <Badge variant="neutral" size={size} dot>
          Stale Telemetry (&gt;2h)
        </Badge>
      );
    case INVERTER_STATUS_TYPES.OFFLINE:
      return (
        <Badge variant="danger" size={size} dot>
          Offline / Shutdown
        </Badge>
      );
    case INVERTER_STATUS_TYPES.UNKNOWN:
    default:
      return (
        <Badge variant="neutral" size={size} dot>
          Unknown State
        </Badge>
      );
  }
};

export default InverterDiagnosticBadge;
