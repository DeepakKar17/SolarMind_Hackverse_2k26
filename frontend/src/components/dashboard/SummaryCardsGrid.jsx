import {
  Zap,
  Sun,
  TrendingUp,
  Percent,
  BatteryWarning,
  IndianRupee,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { useSolarData } from '../../hooks/useSolarData';
import { formatEnergy } from '../../utils/formatters';
import { StatCard } from '../common';

export const SummaryCardsGrid = () => {
  const { summaryKpis, selectedPlant } = useSolarData();

  const {
    currentKw,
    todayYieldKwh,
    expectedTodayKwh,
    performanceRatio,
    estimatedLossKwh,
    financialLossInr,
    activeFaultsCount,
    openWorkOrdersCount,
  } = summaryKpis;

  // Expected vs actual subtext calculation
  const yieldComparisonSubtext =
    expectedTodayKwh && todayYieldKwh
      ? `Expected: ${formatEnergy(expectedTodayKwh)} (-${formatEnergy(Math.max(0, expectedTodayKwh - todayYieldKwh))})`
      : 'Insufficient Model Inputs';

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* 1. Current Generation */}
        <StatCard
          title="Current Generation"
          value={currentKw !== null ? Number(currentKw).toFixed(2) : '--'}
          unit="kW"
          subtext={`Rated: ${selectedPlant?.installedCapacityKwp || 5.4} kWp`}
          icon={Zap}
          variant="primary"
        />

        {/* 2. Energy Generated Today */}
        <StatCard
          title="Energy Generated Today"
          value={todayYieldKwh !== null ? Number(todayYieldKwh).toFixed(1) : '--'}
          unit="kWh"
          subtext="Cumulative daylight yield"
          icon={Sun}
          variant="success"
        />

        {/* 3. Expected vs Actual */}
        <StatCard
          title="Expected vs Actual"
          value={
            expectedTodayKwh && todayYieldKwh
              ? `${todayYieldKwh} / ${expectedTodayKwh}`
              : '--'
          }
          unit="kWh"
          subtext={yieldComparisonSubtext}
          icon={TrendingUp}
          variant="info"
        />

        {/* 4. Performance Ratio */}
        <StatCard
          title="Performance Ratio (PR)"
          value={performanceRatio !== null ? Number(performanceRatio).toFixed(1) : 'N/A'}
          unit={performanceRatio !== null ? '%' : ''}
          subtext={
            performanceRatio !== null
              ? 'Weather & POA normalized'
              : 'N/A - Insufficient Irradiance Data'
          }
          icon={Percent}
          variant={performanceRatio >= 80 ? 'success' : 'warning'}
        />

        {/* 5. Estimated Energy Loss */}
        <StatCard
          title="Estimated Energy Loss"
          value={estimatedLossKwh !== null ? Number(estimatedLossKwh).toFixed(1) : '--'}
          unit="kWh"
          subtext="Shading & soiling deficits"
          icon={BatteryWarning}
          variant="warning"
        />

        {/* 6. Estimated Financial Loss */}
        <StatCard
          title="Estimated Financial Loss"
          value={
            financialLossInr !== null
              ? `₹ ${Number(financialLossInr).toFixed(2)}`
              : '₹ --'
          }
          subtext={`Tariff: ₹${selectedPlant?.tariffPerKwh || 7.5}/kWh`}
          icon={IndianRupee}
          variant="danger"
        />

        {/* 7. Active Fault Count */}
        <StatCard
          title="Active Fault Alerts"
          value={activeFaultsCount}
          subtext={activeFaultsCount === 0 ? 'All systems nominal' : `${activeFaultsCount} active anomaly detected`}
          icon={AlertTriangle}
          variant={activeFaultsCount === 0 ? 'success' : 'warning'}
        />

        {/* 8. Open Maintenance Work Orders */}
        <StatCard
          title="Open Work Orders"
          value={openWorkOrdersCount}
          subtext={openWorkOrdersCount === 0 ? 'No pending maintenance' : `${openWorkOrdersCount} maintenance scheduled`}
          icon={Wrench}
          variant={openWorkOrdersCount === 0 ? 'success' : 'info'}
        />
      </div>
    </section>
  );
};

export default SummaryCardsGrid;
