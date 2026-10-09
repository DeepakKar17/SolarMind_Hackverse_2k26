import React, { useState, useEffect, useCallback } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  SearchInput,
  Select,
  Pagination,
  Modal,
  Input,
  LoadingState,
  ErrorState,
} from '../../components/common';
import { Users, UserPlus, Shield, CheckCircle, XCircle, Activity, AlertTriangle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

export const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', role: 'homeowner', password: '' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [roleActionError, setRoleActionError] = useState(null);

  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [userActivity, setUserActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // Load users from API
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminService.getUsers({ search, role: roleFilter, page, pageSize });
      setUsers(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle invite user submit
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.full_name) {
      setInviteError('Please provide both full name and email address.');
      return;
    }
    try {
      setInviteLoading(true);
      setInviteError(null);
      await adminService.createUser(inviteForm);
      setIsInviteModalOpen(false);
      setInviteForm({ full_name: '', email: '', role: 'homeowner', password: '' });
      loadUsers();
    } catch (err) {
      setInviteError(err.message || 'Failed to provision user.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle status toggle (Activate/Deactivate) with safeguard
  const handleToggleStatus = async (user) => {
    if (user.id === currentUser?.id && user.is_active) {
      alert('Safeguard Alert: You cannot deactivate your own active administrator account.');
      return;
    }
    try {
      await adminService.updateUserStatus(user.id, !user.is_active);
      loadUsers();
    } catch (err) {
      alert(`Operation Failed: ${err.message}`);
    }
  };

  // Handle role change submit
  const handleRoleChangeSubmit = async () => {
    if (!selectedUser || !targetRole) return;
    try {
      setRoleActionError(null);
      await adminService.updateUserRole(selectedUser.id, targetRole);
      setIsRoleModalOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      setRoleActionError(err.message || 'Failed to update user role.');
    }
  };

  // View user activity
  const handleViewActivity = async (user) => {
    setSelectedUser(user);
    setIsActivityModalOpen(true);
    setActivityLoading(true);
    try {
      const activity = await adminService.getUserActivity(user.id);
      setUserActivity(activity);
    } catch {
      setUserActivity(null);
    } finally {
      setActivityLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      <PageHeader
        title="User Account & Role Assignments"
        description="Search, filter, provision users, manage multi-tenant permissions, and review security audit histories."
        breadcrumbs={[
          { label: 'Administration', to: '/admin/dashboard' },
          { label: 'Users', to: '/admin/users' },
        ]}
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setIsInviteModalOpen(true)}>
            Invite New User
          </Button>
        }
      />

      <Card
        title="Registered Users Matrix"
        subtitle="Manage authentication statuses, lockout states, and assigned asset scopes."
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email..."
            />
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Roles' },
                { value: 'admin', label: 'Administrators' },
                { value: 'homeowner', label: 'Homeowners' },
                { value: 'technician', label: 'Technicians' },
                { value: 'operator', label: 'Operators' },
              ]}
              aria-label="Filter user role"
            />
          </div>
        }
      >
        {loading ? (
          <LoadingState message="Loading registered users matrix..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadUsers} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>User</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Role</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Account Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Last Active</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                      No user accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={u.role === 'admin' ? 'primary' : u.role === 'technician' ? 'warning' : 'neutral'}>
                          {u.role?.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={u.is_active ? 'success' : 'neutral'}>
                          {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                        </Badge>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                          <button
                            className="sm-btn sm-btn--ghost sm-btn--sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setTargetRole(u.role);
                              setIsRoleModalOpen(true);
                            }}
                          >
                            Role
                          </button>
                          <button
                            className={`sm-btn sm-btn--sm ${u.is_active ? 'sm-btn--secondary' : 'sm-btn--primary'}`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="sm-btn sm-btn--ghost sm-btn--sm"
                            onClick={() => handleViewActivity(u)}
                          >
                            Activity
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / pageSize)}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </Card>

      {/* Invite User Modal */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Invite New User"
        >
          <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {inviteError && (
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                {inviteError}
              </div>
            )}
            <Input
              label="Full Name"
              value={inviteForm.full_name}
              onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
              placeholder="e.g. Ramesh Chandra"
              required
            />
            <Input
              label="Email Address"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="user@solarmind.io"
              required
            />
            <Select
              label="Initial Role"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              options={[
                { value: 'homeowner', label: 'Homeowner (View Assigned Plants)' },
                { value: 'technician', label: 'Technician (Assigned Work Orders)' },
                { value: 'operator', label: 'Operator (Monitoring & Diagnostics)' },
                { value: 'admin', label: 'Administrator (Full System Oversight)' },
              ]}
            />
            <Input
              label="Initial Password (Optional)"
              type="password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              placeholder="Leave blank to auto-generate temporary password"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={inviteLoading}>
                Provision User
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Role Modal */}
      {isRoleModalOpen && selectedUser && (
        <Modal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          title={`Assign Role: ${selectedUser.full_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {roleActionError && (
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)' }}>
                {roleActionError}
              </div>
            )}
            <div>Current Role: <Badge variant="primary">{selectedUser.role.toUpperCase()}</Badge></div>
            <Select
              label="New Role"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              options={[
                { value: 'homeowner', label: 'Homeowner' },
                { value: 'technician', label: 'Technician' },
                { value: 'operator', label: 'Operator' },
                { value: 'admin', label: 'Administrator' },
              ]}
            />
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Note: Safeguards strictly prevent removing the administrator role if this is the only active administrator.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRoleChangeSubmit}>
                Confirm Role Update
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Activity Drawer / Modal */}
      {isActivityModalOpen && selectedUser && (
        <Modal
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
          title={`Activity Log: ${selectedUser.email}`}
        >
          {activityLoading ? (
            <LoadingState message="Loading security activity trail..." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Last Login: <strong>{selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString() : 'No recorded logins'}</strong>
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                Recent Audit Trail:
              </div>
              {userActivity?.audit_events?.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>No recent audit events.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {userActivity?.audit_events?.map((evt, idx) => (
                    <div key={idx} style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                        <span>{evt.action}</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: 'var(--color-text-primary)', marginTop: '2px' }}>{evt.details}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default AdminUsersPage;
