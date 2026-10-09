import JudgeDemoBar from '../components/dashboard/JudgeDemoBar';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import SummaryCardsGrid from '../components/dashboard/SummaryCardsGrid';
import HourlyDayGenerationCard from '../components/dashboard/HourlyDayGenerationCard';
import ChartsSection from '../components/dashboard/ChartsSection';
import TablesSection from '../components/dashboard/TablesSection';

export const DashboardPage = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 1. Interactive Hackathon Judge Preset & Scenario Bar */}
      <JudgeDemoBar />

      {/* 2. Header with Selected Plant, Metadata & Live/Demo Status */}
      <DashboardHeader />

      {/* 3. 8 High-Impact KPI Cards */}
      <SummaryCardsGrid />

      {/* 4. Single-Day Hourly Generation & Weather Breakdown */}
      <HourlyDayGenerationCard />

      {/* 5. 5 Recharts Telemetry, Loss & Comparison Curves */}
      <ChartsSection />

      {/* 6. Tabbed DataTables for Alerts, Diagnoses, and Work Orders */}
      <TablesSection />
    </div>
  );
};

export default DashboardPage;
