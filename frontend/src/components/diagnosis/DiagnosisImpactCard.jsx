import { Card, StatCard } from '../common';
import { IndianRupee, TrendingDown, BatteryWarning, Calendar } from 'lucide-react';
import { formatEnergy, formatCurrency } from '../../utils/formatters';

export const DiagnosisImpactCard = ({
  estimatedLostEnergyKwh,
  cumulativeLostEnergyKwh,
  projectedMonthlyLossKwh,
  financialDeficitInr,
  projectedMonthlyLossInr,
}) => {
  return (
    <Card title="Estimated Energy & Financial Impact Quantification">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <StatCard
          title="Daily Generation Deficit"
          value={estimatedLostEnergyKwh !== null && estimatedLostEnergyKwh !== undefined ? formatEnergy(estimatedLostEnergyKwh) : '--'}
          subtext="Lost energy per daylight cycle"
          icon={BatteryWarning}
          variant="danger"
        />

        <StatCard
          title="Cumulative Loss to Date"
          value={cumulativeLostEnergyKwh !== null && cumulativeLostEnergyKwh !== undefined ? formatEnergy(cumulativeLostEnergyKwh) : '--'}
          subtext="Unrecovered energy deficit"
          icon={TrendingDown}
          variant="danger"
        />

        <StatCard
          title="Daily Financial Deficit"
          value={financialDeficitInr !== null && financialDeficitInr !== undefined ? formatCurrency(financialDeficitInr) : '--'}
          subtext="Direct utility revenue deficit"
          icon={IndianRupee}
          variant="danger"
        />

        <StatCard
          title="Projected Monthly Deficit"
          value={projectedMonthlyLossInr !== null && projectedMonthlyLossInr !== undefined ? formatCurrency(projectedMonthlyLossInr) : '--'}
          subtext={projectedMonthlyLossKwh ? `~${formatEnergy(projectedMonthlyLossKwh)} / month` : 'Without corrective action'}
          icon={Calendar}
          variant="warning"
        />
      </div>
    </Card>
  );
};

export default DiagnosisImpactCard;
