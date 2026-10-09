import { useState } from 'react';
import {
  Modal,
  Input,
  Select,
  Textarea,
  Button,
} from '../common';
import { Wrench } from 'lucide-react';

export const WorkOrderModal = ({ isOpen, onClose, diagnosis, onSubmit }) => {
  const [title, setTitle] = useState(
    diagnosis ? `Remediate ${diagnosis.faultClass.replace(/_/g, ' ')}` : ''
  );
  const [priority, setPriority] = useState('HIGH');
  const [assignedTo, setAssignedTo] = useState('SolarField Services');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [estimatedCostInr, setEstimatedCostInr] = useState('800');
  const [notes, setNotes] = useState(
    diagnosis ? diagnosis.rootCauseSummary : ''
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title) return;

    if (onSubmit) {
      onSubmit({
        title,
        priority,
        assignedTo,
        scheduledDate,
        estimatedCostInr: Number(estimatedCostInr) || 0,
        notes,
        diagnosisId: diagnosis?.id || null,
        expectedKwhRecovery: diagnosis?.estimatedLostEnergyKwh || 2.5,
      });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Solar Maintenance Work Order"
      maxWidth="500px"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Wrench} onClick={handleSubmit}>
            Create Order
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Input
          label="Work Order Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            label="Priority Level"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={[
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ]}
          />

          <Select
            label="Assigned Technician"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            options={[
              { value: 'SolarField Services', label: 'SolarField Services' },
              { value: 'CleanSolar Technicians', label: 'CleanSolar Technicians' },
              { value: 'Internal Certified Electrician', label: 'Internal Electrician' },
            ]}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Scheduled Date"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
          />

          <Input
            label="Estimated Cost (₹)"
            type="number"
            value={estimatedCostInr}
            onChange={(e) => setEstimatedCostInr(e.target.value)}
          />
        </div>

        <Textarea
          label="Maintenance Instructions / Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </form>
    </Modal>
  );
};

export default WorkOrderModal;
