import SystemConfigForm from '../components/forms/SystemConfigForm';
import { PageHeader } from '../components/common';

export const SystemConfigPage = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Single-String System Configuration"
        subtitle="Manage your solar installation specifications, rated capacities, tilt/azimuth, and grid utility tariffs."
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Inverter Config' },
        ]}
      />

      <SystemConfigForm />
    </div>
  );
};

export default SystemConfigPage;
