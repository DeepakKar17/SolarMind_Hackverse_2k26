import { PageHeader, Card } from '../components/common';
import ChartsSection from '../components/dashboard/ChartsSection';
import SummaryCardsGrid from '../components/dashboard/SummaryCardsGrid';
import { Activity } from 'lucide-react';

export const MonitoringPage = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Live Solar Telemetry & Generation Curves"
        subtitle="Real-time Plane-of-Array irradiance, AC power output, and electrical string performance."
        breadcrumbs={[
          { label: 'Platform', href: '/dashboard' },
          { label: 'Live Telemetry' },
        ]}
      />

      <SummaryCardsGrid />
      <ChartsSection />
    </div>
  );
};

export default MonitoringPage;
