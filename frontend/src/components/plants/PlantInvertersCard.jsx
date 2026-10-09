import { Link } from 'react-router-dom';
import { Card, Badge, DataTable } from '../common';
import { Cpu, Eye, Zap, Thermometer, Activity } from 'lucide-react';
import { formatCapacity, formatPower } from '../../utils/formatters';

export const PlantInvertersCard = ({ inverters = [], plantName }) => {
  const columns = [
    {
      key: 'id',
      label: 'Inverter Serial / ID',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-primary)' }}>{val}</strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            SN: {row.serialNumber}
          </span>
        </div>
      ),
    },
    {
      key: 'model',
      label: 'Hardware Model & String Topology',
      render: (val, row) => (
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {row.stringCount}x MPPT String ({row.panelCountPerString} Modules)
          </span>
        </div>
      ),
    },
    {
      key: 'ratedPowerKw',
      label: 'Rated AC Capacity',
      render: (val) => formatCapacity(val),
    },
    {
      key: 'mpptVoltageV',
      label: 'MPPT Voltage & Current',
      render: (val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {val} V / {row.mpptCurrentA} A
        </span>
      ),
    },
    {
      key: 'efficiencyPercent',
      label: 'Inverter Efficiency',
      render: (val) => (
        <span style={{ fontWeight: 600, color: val > 95 ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {val > 0 ? `${val}%` : '--'}
        </span>
      ),
    },
    {
      key: 'temperatureC',
      label: 'Operating Temp',
      render: (val) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <Thermometer size={13} color="var(--color-text-muted)" />
          {val} °C
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant={val === 'ONLINE' ? 'success' : val === 'WARNING' ? 'warning' : 'danger'} dot>
          {val}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Inspect',
      align: 'right',
      render: (_, row) => (
        <Link
          to={`/inverters/${row.id}`}
          className="sm-btn sm-btn-outline sm-btn-sm"
          style={{ textDecoration: 'none' }}
        >
          <Eye size={13} />
          <span>Inspect</span>
        </Link>
      ),
    },
  ];

  return (
    <Card
      title={`Associated Inverters Fleet (${inverters.length})`}
      subtitle={`Inverter hardware and MPPT strings registered to ${plantName}`}
      style={{ padding: 0 }}
    >
      <DataTable
        columns={columns}
        data={inverters}
        keyField="id"
        emptyMessage="No inverters registered for this plant installation."
      />
    </Card>
  );
};

export default PlantInvertersCard;
