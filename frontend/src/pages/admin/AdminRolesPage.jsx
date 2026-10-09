import React from 'react';
import { PageHeader, Card, Badge } from '../../components/common';
import { Sliders, ShieldCheck, Check, X } from 'lucide-react';

export const AdminRolesPage = () => {
  const permissionsMatrix = [
    { permission: 'Manage User Accounts & Roles', admin: true, homeowner: false, technician: false },
    { permission: 'Create & Edit Plant Registrations', admin: true, homeowner: false, technician: false },
    { permission: 'View Assigned Plant Telemetry', admin: true, homeowner: true, technician: false },
    { permission: 'View Fleet-Wide Telemetry', admin: true, homeowner: false, technician: false },
    { permission: 'Request AI Fault Diagnosis', admin: true, homeowner: true, technician: false },
    { permission: 'Upload Inspection Photos', admin: true, homeowner: true, technician: true },
    { permission: 'Update Work-Order Status', admin: true, homeowner: false, technician: true },
    { permission: 'Configure Diagnosis Rules & Tariffs', admin: true, homeowner: false, technician: false },
    { permission: 'Access Audit Logs & Health', admin: true, homeowner: false, technician: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <PageHeader
        title="Role & Permission Policy Matrix"
        description="Review security scopes, multi-tenant boundaries, and privilege boundaries across all 3 user classes."
        breadcrumbs={[
          { label: 'Administration', to: '/admin/dashboard' },
          { label: 'Roles & Permissions', to: '/admin/roles' },
        ]}
      />

      <Card title="RBAC Capability Matrix" subtitle="Capabilities enforced via backend permissions.py and frontend RoleGuard.">
        <div style={{ overflowX: 'auto' }}>
          <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>System Capability / Action</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Administrator</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Homeowner</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>Technician</th>
              </tr>
            </thead>
            <tbody>
              {permissionsMatrix.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {row.permission}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                    {row.admin ? <Badge variant="success">Permitted</Badge> : <Badge variant="neutral">Forbidden</Badge>}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                    {row.homeowner ? <Badge variant="primary">Permitted</Badge> : <Badge variant="neutral">Forbidden</Badge>}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                    {row.technician ? <Badge variant="warning">Permitted</Badge> : <Badge variant="neutral">Forbidden</Badge>}
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

export default AdminRolesPage;
