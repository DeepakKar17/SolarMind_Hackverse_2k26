import React from 'react';
import { PageHeader, Card, Badge } from '../../components/common';
import { AlertOctagon, Tag } from 'lucide-react';

const faultCatalog = [
  { code: 'FAULT-OPEN-CIRCUIT', category: 'Electrical Topology', severity: 'CRITICAL', description: 'String open-circuit or disconnected MC4 connector resulting in zero current under sunshine.', lossWeight: 'HIGH' },
  { code: 'FAULT-SHADING-PARTIAL', category: 'Environmental', severity: 'WARNING', description: 'Obstruction by vegetation, chimneys, or neighboring structures creating MPPT voltage step-downs.', lossWeight: 'MEDIUM' },
  { code: 'FAULT-SOILING-ACCUMULATION', category: 'Environmental', severity: 'WARNING', description: 'Surface dust or grime lowering irradiance transmittance below clear-sky model by >12%.', lossWeight: 'MEDIUM' },
  { code: 'FAULT-THERMAL-CLIPPING', category: 'Inverter Hardware', severity: 'HIGH', description: 'Heatsink temperature exceeding 75°C triggering automated active power curtailment.', lossWeight: 'MEDIUM' },
  { code: 'FAULT-GRID-OVERVOLTAGE', category: 'Grid Interconnection', severity: 'HIGH', description: 'Utility grid voltage exceeding statutory limit (>253V) forcing anti-islanding trip.', lossWeight: 'HIGH' },
  { code: 'FAULT-MPPT-MISMATCH', category: 'Array Configuration', severity: 'MODERATE', description: 'Unequal string lengths on shared tracker causing parallel current circulating losses.', lossWeight: 'LOW' },
];

export const AdminFaultCatalogPage = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <PageHeader
        title="Fault & Anomaly Catalog"
        description="Standardized IEC 61724 anomaly taxonomy, loss weighting coefficients, and severity classifications."
        breadcrumbs={[
          { label: 'Administration', to: '/admin/dashboard' },
          { label: 'Fault Catalog', to: '/admin/fault-catalog' },
        ]}
      />

      <Card title="System Anomaly Taxonomy" subtitle="Catalog of AI diagnosis signatures and corresponding dispatch actions.">
        <div style={{ overflowX: 'auto' }}>
          <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Fault Code</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Category</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Severity</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Diagnostic Signature & Root Cause</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Loss Impact</th>
              </tr>
            </thead>
            <tbody>
              {faultCatalog.map((f) => (
                <tr key={f.code} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {f.code}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                    {f.category}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge variant={f.severity === 'CRITICAL' ? 'danger' : f.severity === 'HIGH' ? 'warning' : 'neutral'}>
                      {f.severity}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', maxWidth: '340px' }}>
                    {f.description}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge variant={f.lossWeight === 'HIGH' ? 'danger' : 'neutral'}>
                      {f.lossWeight}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminFaultCatalogPage;
