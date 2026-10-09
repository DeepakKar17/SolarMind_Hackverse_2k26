import React, { useState } from 'react';
import { PageHeader, Card, Badge, SearchInput, Select, Pagination } from '../../components/common';
import { FileText, ShieldAlert } from 'lucide-react';

const fullAuditLogs = [
  { id: 'EVT-9041', timestamp: '2026-10-09 11:43:10', actor: 'admin@solarmind.io', role: 'admin', action: 'ASSIGN_ROLE', target: 'tech.kumar@solarmind.io', details: 'Assigned TECHNICIAN role and Bangalore fleet zone clearance', status: 'SUCCESS' },
  { id: 'EVT-9040', timestamp: '2026-10-09 11:10:05', actor: 'SYSTEM', role: 'system', action: 'DEYE_CLOUD_SYNC', target: 'Plant #4 (Whitefield Array)', details: 'Successfully ingested 240 telemetry records from Deye OpenAPI', status: 'SUCCESS' },
  { id: 'EVT-9039', timestamp: '2026-10-09 10:20:18', actor: 'admin@solarmind.io', role: 'admin', action: 'UPDATE_FAULT_RULE', target: 'RULE-SHADE-04', details: 'Adjusted MPPT voltage deviation threshold to 15%', status: 'SUCCESS' },
  { id: 'EVT-9038', timestamp: '2026-10-09 08:55:40', actor: 'operator@solarmind.io', role: 'operator', action: 'DISPATCH_WORK_ORDER', target: 'WO-804', details: 'Dispatched emergency technician for String 2 DC fuse trip', status: 'SUCCESS' },
  { id: 'EVT-9037', timestamp: '2026-10-09 06:35:12', actor: 'SYSTEM', role: 'system', action: 'DEYE_INTEGRATION_RETRY', target: 'Gateway Rate Limit', details: 'Automatic exponential backoff handled HTTP 429 response safely', status: 'RESOLVED' },
  { id: 'EVT-9036', timestamp: '2026-10-08 22:15:00', actor: 'admin@solarmind.io', role: 'admin', action: 'UPDATE_SYSTEM_TARIFF', target: 'Karnataka BESCOM Grid', details: 'Updated export tariff to ₹7.50 / kWh', status: 'SUCCESS' },
];

export const AdminAuditLogsPage = () => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filtered = fullAuditLogs.filter(evt => {
    const matchAction = actionFilter === 'ALL' || evt.action === actionFilter;
    const matchSearch = !search || evt.actor.toLowerCase().includes(search.toLowerCase()) || evt.target.toLowerCase().includes(search.toLowerCase()) || evt.details.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <PageHeader
        title="Audit & Security Event Trail"
        description="Immutable administrative record of privileged actions, data syncs, and system configuration modifications."
        breadcrumbs={[
          { label: 'Administration', to: '/admin/dashboard' },
          { label: 'Audit Logs', to: '/admin/audit-logs' },
        ]}
      />

      <Card
        title="Security Audit Stream"
        subtitle="Chronological log of administrative events."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail..."
            />
            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Actions' },
                { value: 'ASSIGN_ROLE', label: 'Role Assignments' },
                { value: 'DEYE_CLOUD_SYNC', label: 'Deye Cloud Ingestion' },
                { value: 'UPDATE_FAULT_RULE', label: 'Rule Alterations' },
                { value: 'DISPATCH_WORK_ORDER', label: 'Work Orders' },
                { value: 'UPDATE_SYSTEM_TARIFF', label: 'Tariff Updates' },
              ]}
              aria-label="Filter audit action"
            />
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Event ID</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Timestamp</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Actor</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Action</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Target</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Details</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(evt => (
                <tr key={evt.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 600 }}>
                    {evt.id}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                    {evt.timestamp}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontWeight: 600 }}>{evt.actor}</span>
                    <Badge variant={evt.role === 'admin' ? 'primary' : 'neutral'} style={{ marginLeft: '6px', fontSize: '10px' }}>
                      {evt.role.toUpperCase()}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>
                    {evt.action}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)' }}>
                    {evt.target}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', maxWidth: '300px' }}>
                    {evt.details}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <Badge variant={evt.status === 'SUCCESS' ? 'success' : 'info'}>
                      {evt.status}
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

export default AdminAuditLogsPage;
