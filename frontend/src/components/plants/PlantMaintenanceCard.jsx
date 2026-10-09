import { Card, Badge, DataTable } from '../common';
import { CalendarCheck, Wrench, CheckCircle2 } from 'lucide-react';

export const PlantMaintenanceCard = ({ plantId, plantName }) => {
  // Historical maintenance records associated with this plant
  const allLogs = [
    {
      id: 'MNT-101',
      plantId: 1,
      date: '2026-09-28',
      type: 'Demineralized Water Washing',
      technician: 'CleanSolar Services',
      result: 'Recovered ~7.2% generation yield',
      status: 'COMPLETED',
    },
    {
      id: 'MNT-102',
      plantId: 2,
      date: '2026-08-15',
      type: 'DC Switch & Fuse Check',
      technician: 'Certified Field Tech',
      result: 'Contact resistance normal (<0.2Ω)',
      status: 'COMPLETED',
    },
    {
      id: 'MNT-103',
      plantId: 1,
      date: '2026-07-10',
      type: 'Tree Branch Trimming & Clearance',
      technician: 'Arun Kumar',
      result: 'Eliminated morning shading deficit',
      status: 'COMPLETED',
    },
    {
      id: 'MNT-104',
      plantId: 3,
      date: '2026-09-12',
      type: 'Inverter Firmware Upgrade v2.4.1',
      technician: 'Firmware Support Team',
      result: 'Updated MPPT tracking algorithm',
      status: 'COMPLETED',
    },
    {
      id: 'MNT-105',
      plantId: 4,
      date: '2026-08-20',
      type: 'Thermal Imaging Drone Audit',
      technician: 'AeroSolar Inspections',
      result: 'Zero hot spots detected across 30 modules',
      status: 'COMPLETED',
    },
  ];

  const plantLogs = allLogs.filter((log) => log.plantId === Number(plantId));

  const columns = [
    {
      key: 'id',
      label: 'Log ID',
      render: (val) => <strong style={{ color: 'var(--color-primary)' }}>{val}</strong>,
    },
    { key: 'date', label: 'Completed Date' },
    {
      key: 'type',
      label: 'Maintenance Action',
      render: (val) => <strong style={{ color: 'var(--color-text-primary)' }}>{val}</strong>,
    },
    { key: 'technician', label: 'Assigned Specialist' },
    { key: 'result', label: 'Operational Outcome' },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant="success" dot>
          {val}
        </Badge>
      ),
    },
  ];

  return (
    <Card
      title={`Maintenance & Service History (${plantLogs.length})`}
      subtitle={`Past preventive maintenance, module washing, and electrical inspections for ${plantName}`}
      style={{ padding: 0 }}
    >
      <DataTable
        columns={columns}
        data={plantLogs}
        keyField="id"
        emptyMessage="No historical maintenance logs on record for this solar installation."
      />
    </Card>
  );
};

export default PlantMaintenanceCard;
