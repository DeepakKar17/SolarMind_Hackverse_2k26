import { Card, DataTable } from '../common';
import { formatPower, formatVoltage, formatCurrent, formatIrradiance } from '../../utils/formatters';

export const PlantTelemetryTable = ({ telemetrySeries = [], plantName }) => {
  const columns = [
    {
      key: 'time',
      label: 'Sample Time',
      render: (val) => <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>,
    },
    {
      key: 'actualKw',
      label: 'Active AC Power',
      render: (val) => (
        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
          {formatPower(val)}
        </span>
      ),
    },
    {
      key: 'expectedKw',
      label: 'Expected Power',
      render: (val) => (
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {formatPower(val)}
        </span>
      ),
    },
    {
      key: 'irradiancePoa',
      label: 'POA Irradiance',
      render: (val) => formatIrradiance(val),
    },
    {
      key: 'dcVoltageV',
      label: 'DC String Voltage',
      render: (val) => formatVoltage(val),
    },
    {
      key: 'dcCurrentA',
      label: 'DC String Current',
      render: (val) => formatCurrent(val),
    },
    {
      key: 'gridVoltageV',
      label: 'Grid AC Voltage',
      render: (val) => formatVoltage(val),
    },
  ];

  return (
    <Card
      title="Recent Telemetry & Electrical Operating Parameters"
      subtitle={`High-frequency sensor telemetry log for ${plantName}`}
      style={{ padding: 0 }}
    >
      <DataTable
        columns={columns}
        data={telemetrySeries}
        keyField="time"
        emptyMessage="No telemetry samples recorded for the selected window."
      />
    </Card>
  );
};

export default PlantTelemetryTable;
