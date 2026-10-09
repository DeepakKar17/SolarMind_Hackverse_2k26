export const StatusBadge = ({ status = 'ONLINE', label }) => {
  const getBadgeClass = (st) => {
    switch (st?.toUpperCase()) {
      case 'ONLINE':
      case 'NORMAL':
      case 'HEALTHY':
      case 'RESOLVED':
        return 'badge-success';
      case 'WARNING':
      case 'PARTIAL_SHADING':
      case 'SOILING':
        return 'badge-warning';
      case 'CRITICAL':
      case 'ERROR':
      case 'DISCONNECTED':
        return 'badge-danger';
      case 'INFO':
      default:
        return 'badge-info';
    }
  };

  return (
    <span className={`badge ${getBadgeClass(status)}`}>
      {label || status}
    </span>
  );
};

export default StatusBadge;
