import React, { useState, useMemo, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Zap,
  Activity,
  User,
  Building2,
  ShieldCheck,
  CheckSquare,
  Square,
  Camera,
  Plus,
  Trash2,
  Save,
  ArrowRight,
  Eye,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSolarData } from '../hooks/useSolarData';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  SearchInput,
  Select,
  Modal,
  Input,
  Textarea,
  EmptyState,
} from '../components/common';
import { formatCurrency, formatEnergy, formatPower } from '../utils/formatters';

const DEFAULT_SAFETY_CHECKLIST = [
  { id: 'chk_loto', label: 'Lock-Out Tag-Out (LOTO) verified & AC main breaker isolated', checked: false, required: true },
  { id: 'chk_dc_iso', label: 'DC isolator switch opened before handling solar string disconnects', checked: false, required: true },
  { id: 'chk_ppe', label: 'PPE equipped: Class 0 insulated gloves, safety eyewear, and roof fall arrest harness', checked: false, required: true },
  { id: 'chk_mc4', label: 'Physical inspection of MC4 connectors, crimping tightness, and cable strain reliefs', checked: false, required: true },
  { id: 'chk_voc_isc', label: 'Multimeter measurement of open-circuit voltage (Voc) and short-circuit current (Isc)', checked: false, required: true },
  { id: 'chk_thermal', label: 'Visual and thermal scan for hot-spots, micro-cracks, and frame grounding continuity', checked: false, required: false },
];

export const TechnicianDashboardPage = () => {
  const { user: currentUser } = useAuth();
  const { workOrders, diagnoses, plants, telemetrySeries } = useSolarData();

  // Local state for technician work orders to enable instant status transitions & persistence
  const [localWorkOrders, setLocalWorkOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [plantFilter, setPlantFilter] = useState('ALL');

  // Execution Drawer / Active Work Order State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [checklist, setChecklist] = useState(DEFAULT_SAFETY_CHECKLIST);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [measuredVoc, setMeasuredVoc] = useState('');
  const [measuredIsc, setMeasuredIsc] = useState('');
  const [partsUsed, setPartsUsed] = useState([]);
  const [newPartName, setNewPartName] = useState('');
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartCost, setNewPartCost] = useState('');

  // Before & After Photos
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Validation & Feedback State
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [isDraftSaved, setIsDraftSaved] = useState(true);

  // Initialize work orders
  useEffect(() => {
    if (workOrders && workOrders.length > 0) {
      setLocalWorkOrders(workOrders);
    }
  }, [workOrders]);

  // Filter work orders scoped to current technician if user is a technician
  const scopedWorkOrders = useMemo(() => {
    let list = localWorkOrders;
    if (currentUser?.role === 'technician') {
      const techName = currentUser.full_name?.toLowerCase() || '';
      list = list.filter((wo) => {
        const assigned = (wo.assignedTo || '').toLowerCase();
        return (
          assigned.includes('arun') ||
          assigned.includes('technician') ||
          assigned.includes('field') ||
          (techName && assigned.includes(techName))
        );
      });
    }
    return list;
  }, [localWorkOrders, currentUser]);

  // Overview KPI Counts
  const kpis = useMemo(() => {
    const total = scopedWorkOrders.length;
    const newAssignments = scopedWorkOrders.filter((w) => w.status === 'OPEN' || w.status === 'SCHEDULED').length;
    const inProgress = scopedWorkOrders.filter((w) => w.status === 'IN_PROGRESS').length;
    const awaitingVerification = scopedWorkOrders.filter((w) => w.status === 'AWAITING_VERIFICATION').length;
    const completed = scopedWorkOrders.filter((w) => w.status === 'COMPLETED').length;
    const highPriority = scopedWorkOrders.filter(
      (w) => (w.priority === 'CRITICAL' || w.priority === 'HIGH') && w.status !== 'COMPLETED'
    ).length;

    // Calculate overdue (jobs with scheduledDate < today and not completed)
    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = scopedWorkOrders.filter(
      (w) => w.scheduledDate && w.scheduledDate < todayStr && w.status !== 'COMPLETED'
    ).length;

    return {
      total,
      newAssignments,
      inProgress,
      awaitingVerification,
      completed,
      highPriority,
      overdue,
    };
  }, [scopedWorkOrders]);

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    return scopedWorkOrders.filter((wo) => {
      const matchSearch =
        !search ||
        wo.id.toLowerCase().includes(search.toLowerCase()) ||
        wo.title.toLowerCase().includes(search.toLowerCase()) ||
        (wo.assignedTo || '').toLowerCase().includes(search.toLowerCase()) ||
        (wo.notes || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || wo.status === statusFilter;
      const matchPriority = priorityFilter === 'ALL' || wo.priority === priorityFilter;
      const matchPlant = plantFilter === 'ALL' || String(wo.plantId) === plantFilter;

      return matchSearch && matchStatus && matchPriority && matchPlant;
    });
  }, [scopedWorkOrders, search, statusFilter, priorityFilter, plantFilter]);

  // Open Order Detail / Execution Workspace
  const handleOpenOrder = (wo) => {
    setSelectedOrder(wo);
    setActionError(null);
    setActionSuccess(null);
    setResolutionNotes(wo.resolutionNotes || wo.notes || '');
    setMeasuredVoc(wo.measuredVoc || '382.4');
    setMeasuredIsc(wo.measuredIsc || '13.55');
    setChecklist(
      DEFAULT_SAFETY_CHECKLIST.map((item) => ({
        ...item,
        checked: wo.status === 'COMPLETED' || wo.status === 'AWAITING_VERIFICATION',
      }))
    );
    setPartsUsed(
      wo.partsUsed || [
        { id: 1, name: 'MC4-Evo2 Solar Connector Pair (1000V)', qty: 2, cost: 350 },
      ]
    );
    setBeforePhotos(wo.beforePhotos || []);
    setAfterPhotos(wo.afterPhotos || []);
    setIsDraftSaved(true);
  };

  // Toggle Checklist Item
  const handleToggleChecklist = (id) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
    setIsDraftSaved(false);
  };

  // Add Part
  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    const newPart = {
      id: Date.now(),
      name: newPartName.trim(),
      qty: Number(newPartQty) || 1,
      cost: Number(newPartCost) || 0,
    };
    setPartsUsed((prev) => [...prev, newPart]);
    setNewPartName('');
    setNewPartQty(1);
    setNewPartCost('');
    setIsDraftSaved(false);
  };

  const handleRemovePart = (id) => {
    setPartsUsed((prev) => prev.filter((p) => p.id !== id));
    setIsDraftSaved(false);
  };

  // Photo Upload Handler with simulated progress
  const handlePhotoUpload = (e, phase = 'AFTER') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress({ phase, percent: 30 });
    setTimeout(() => {
      setUploadProgress({ phase, percent: 75 });
      setTimeout(() => {
        const photoObj = {
          id: Date.now(),
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          uploadedAt: new Date().toLocaleTimeString(),
        };
        if (phase === 'BEFORE') {
          setBeforePhotos((prev) => [...prev, photoObj]);
        } else {
          setAfterPhotos((prev) => [...prev, photoObj]);
        }
        setUploadProgress(null);
        setIsDraftSaved(false);
      }, 400);
    }, 400);
  };

  // Status Transitions with Strict Validation
  const handleTransitionStatus = (nextStatus) => {
    setActionError(null);
    setActionSuccess(null);

    // Strict validation for Completion or Verification Submission
    if (nextStatus === 'COMPLETED' || nextStatus === 'AWAITING_VERIFICATION') {
      const uncheckedRequired = checklist.filter((item) => item.required && !item.checked);
      if (uncheckedRequired.length > 0) {
        setActionError(
          `Safety Safeguard Alert: Please complete all mandatory checklist items before transitioning to ${nextStatus}. (${uncheckedRequired.length} pending)`
        );
        return;
      }

      if (!resolutionNotes || resolutionNotes.trim().length < 15) {
        setActionError('Resolution Notes Required: Please provide detailed repair/inspection notes (min 15 chars).');
        return;
      }

      if (!measuredVoc || !measuredIsc) {
        setActionError('Electrical Measurement Required: Multimeter Voc and Isc post-service readings must be documented.');
        return;
      }
    }

    // Apply update to local work orders
    const updatedOrder = {
      ...selectedOrder,
      status: nextStatus,
      resolutionNotes,
      measuredVoc,
      measuredIsc,
      partsUsed,
      beforePhotos,
      afterPhotos,
      completedAt: nextStatus === 'COMPLETED' ? new Date().toISOString() : selectedOrder.completedAt,
    };

    setLocalWorkOrders((prev) =>
      prev.map((wo) => (wo.id === selectedOrder.id ? updatedOrder : wo))
    );
    setSelectedOrder(updatedOrder);
    setIsDraftSaved(true);
    setActionSuccess(`Work Order ${selectedOrder.id} successfully updated to ${nextStatus}!`);

    setTimeout(() => {
      setActionSuccess(null);
    }, 2500);
  };

  // Associated diagnosis for selected work order
  const selectedDiagnosis = useMemo(() => {
    if (!selectedOrder) return null;
    return diagnoses.find((d) => d.id === selectedOrder.diagnosisId) || diagnoses[0] || null;
  }, [selectedOrder, diagnoses]);

  // Associated plant for selected work order
  const selectedPlant = useMemo(() => {
    if (!selectedOrder) return null;
    return plants.find((p) => p.id === selectedOrder.plantId) || plants[0] || null;
  }, [selectedOrder, plants]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', padding: 'var(--space-6)' }}>
      {/* =========================================================================
          1. HEADER & OVERVIEW BAR
          ========================================================================= */}
      <PageHeader
        title="Technician Field Operations Center"
        description="Assigned work orders, diagnostic telemetry, safety isolation checklists, and repair verification workflows."
        breadcrumbs={[
          { label: 'Platform', to: '/dashboard' },
          { label: 'Technician Operations', to: '/technician/dashboard' },
        ]}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Badge variant="primary" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <User size={14} style={{ marginRight: '4px' }} />
              {currentUser?.full_name || 'Field Technician'} ({currentUser?.role?.toUpperCase() || 'TECHNICIAN'})
            </Badge>
          </div>
        }
      />

      {/* =========================================================================
          2. 7 OVERVIEW KPI CARDS
          ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {/* Card 1: Total Assigned */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Assigned Tasks
            </span>
            <div style={{ color: 'var(--color-primary)' }}>
              <Wrench size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
              {kpis.total}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              In your dispatch queue
            </div>
          </div>
        </Card>

        {/* Card 2: New Assignments */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              New Assignments
            </span>
            <div style={{ color: 'var(--color-secondary)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {kpis.newAssignments}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Ready for dispatch
            </div>
          </div>
        </Card>

        {/* Card 3: In Progress */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              In-Progress
            </span>
            <div style={{ color: 'var(--color-warning)' }}>
              <Activity size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
              {kpis.inProgress}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Actively being serviced
            </div>
          </div>
        </Card>

        {/* Card 4: Overdue Jobs */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Overdue Jobs
            </span>
            <div style={{ color: kpis.overdue > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: kpis.overdue > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {kpis.overdue}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Past target date
            </div>
          </div>
        </Card>

        {/* Card 5: High Priority */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              High-Priority Faults
            </span>
            <div style={{ color: 'var(--color-danger)' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: kpis.highPriority > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {kpis.highPriority}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Critical generation impact
            </div>
          </div>
        </Card>

        {/* Card 6: Awaiting Verification */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Awaiting Verification
            </span>
            <div style={{ color: 'var(--color-secondary)' }}>
              <FileCheck size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-secondary)' }}>
              {kpis.awaitingVerification}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              QA sign-off pending
            </div>
          </div>
        </Card>

        {/* Card 7: Completed */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Recently Completed
            </span>
            <div style={{ color: 'var(--color-success)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {kpis.completed}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Resolved tasks
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          3. WORK QUEUE MATRIX & FILTERS
          ========================================================================= */}
      <Card
        title="Field Service Work Queue"
        subtitle="Search, filter, and inspect assigned maintenance work orders."
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, plant, notes..."
              style={{ minWidth: '220px' }}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'OPEN', label: 'Open / Unassigned' },
                { value: 'SCHEDULED', label: 'Scheduled' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'AWAITING_VERIFICATION', label: 'Awaiting Verification' },
                { value: 'COMPLETED', label: 'Completed' },
              ]}
              aria-label="Filter status"
            />
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'CRITICAL', label: 'Critical' },
                { value: 'HIGH', label: 'High' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LOW', label: 'Low' },
              ]}
              aria-label="Filter priority"
            />
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="sm-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Work Order ID</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Plant & Asset</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Task Description</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Priority</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Target Due Date</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)' }}>
                    No work orders found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((wo) => (
                  <tr key={wo.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {wo.id}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {plants.find((p) => p.id === wo.plantId)?.name || `Plant #${wo.plantId || 1}`}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        Asset: Inverter String #1
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{wo.title}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {wo.notes || 'Routine maintenance and diagnostics'}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge variant={wo.priority === 'CRITICAL' ? 'danger' : wo.priority === 'HIGH' ? 'warning' : 'info'}>
                        {wo.priority}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      {wo.scheduledDate || 'Immediate'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Badge
                        variant={
                          wo.status === 'COMPLETED'
                            ? 'success'
                            : wo.status === 'IN_PROGRESS'
                            ? 'warning'
                            : wo.status === 'AWAITING_VERIFICATION'
                            ? 'info'
                            : 'primary'
                        }
                      >
                        {wo.status}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                      <Button
                        variant={wo.status === 'IN_PROGRESS' ? 'primary' : 'secondary'}
                        size="sm"
                        icon={Wrench}
                        onClick={() => handleOpenOrder(wo)}
                      >
                        {wo.status === 'IN_PROGRESS' ? 'Resume Service' : 'Inspect Ticket'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* =========================================================================
          4. WORK ORDER DETAIL & FIELD EXECUTION MODAL
          ========================================================================= */}
      {selectedOrder && (
        <Modal
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          title={`Field Service Ticket: ${selectedOrder.id}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxHeight: '75vh', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
            {/* Status & Alerts Banners */}
            {actionError && (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <AlertTriangle size={16} />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Top Ticket Overview Strip */}
            <div
              style={{
                backgroundColor: 'var(--color-bg-canvas)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                  {selectedOrder.title}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Plant: <strong>{selectedPlant?.name || 'Rooftop Array'}</strong> • Asset: <strong>{selectedPlant?.inverterModel || 'SolarMind 5kW'}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Badge variant={selectedOrder.priority === 'CRITICAL' ? 'danger' : 'warning'}>
                  {selectedOrder.priority}
                </Badge>
                <Badge variant={selectedOrder.status === 'COMPLETED' ? 'success' : 'primary'}>
                  {selectedOrder.status}
                </Badge>
              </div>
            </div>

            {/* SECTION A: DIAGNOSIS & SUPPORTING TELEMETRY */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {/* Diagnosis Details */}
              <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} /> AI Diagnostic Hypothesis
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                  {selectedDiagnosis?.rootCauseSummary || 'Localized tree branch shadow or connector impedance loss detected across string MPPT-1.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-2)' }}>
                  <span>Confidence: <strong>{selectedDiagnosis?.confidenceScore || 92.4}%</strong></span>
                  <span>Est. Daily Loss: <strong>3.45 kWh (~₹25.88)</strong></span>
                </div>
              </div>

              {/* Supporting Telemetry Snapshot */}
              <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} /> Telemetry Snapshot
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-2)', fontSize: '11px' }}>
                  <div>DC Voltage (Vdc): <strong>380.5 V</strong></div>
                  <div>DC Current (Idc): <strong>9.20 A</strong></div>
                  <div>Grid Voltage (Vac): <strong>236.8 V</strong></div>
                  <div>Inverter Temp: <strong>43.5 °C</strong></div>
                  <div>Sunlight POA: <strong>960 W/m²</strong></div>
                  <div>Power Output: <strong>3.45 kW</strong></div>
                </div>
              </div>
            </div>

            {/* SECTION B: SAFE INSPECTION CHECKLIST (MANDATORY) */}
            <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="var(--color-success)" /> Safe Field Inspection Checklist (Mandatory)
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {checklist.filter((i) => i.checked).length} of {checklist.length} Completed
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: item.checked ? 'var(--color-success-bg)' : 'var(--color-bg-canvas)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggleChecklist(item.id)}
                      style={{ marginTop: '2px' }}
                    />
                    <span style={{ color: item.checked ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: item.checked ? 600 : 400 }}>
                      {item.label} {item.required && <strong style={{ color: 'var(--color-danger)' }}>*</strong>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* SECTION C: REPAIR NOTES & MULTIMETER READINGS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <Textarea
                  label="Technician Resolution & Action Notes (Required)"
                  value={resolutionNotes}
                  onChange={(e) => {
                    setResolutionNotes(e.target.value);
                    setIsDraftSaved(false);
                  }}
                  placeholder="Document actions taken (e.g. Trimmed neem branches back 3m, cleaned MC4 connector pins, re-torqued clamps to 8.5 Nm)."
                  rows={4}
                  required
                />
                <div style={{ fontSize: '10px', color: isDraftSaved ? 'var(--color-success)' : 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> {isDraftSaved ? 'Draft saved locally' : 'Unsaved changes in note'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Post-Service Verification Readings
                </label>
                <Input
                  label="Measured String Open-Circuit Voltage (Voc Volts)"
                  type="number"
                  step="any"
                  value={measuredVoc}
                  onChange={(e) => {
                    setMeasuredVoc(e.target.value);
                    setIsDraftSaved(false);
                  }}
                  required
                />
                <Input
                  label="Measured Short-Circuit Current (Isc Amperes)"
                  type="number"
                  step="any"
                  value={measuredIsc}
                  onChange={(e) => {
                    setMeasuredIsc(e.target.value);
                    setIsDraftSaved(false);
                  }}
                  required
                />
              </div>
            </div>

            {/* SECTION D: PARTS & REPLACEMENT LOG */}
            <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                Parts & Replacement Inventory Used
              </div>

              {partsUsed.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                  No replacement hardware recorded for this service call.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  {partsUsed.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-2) var(--space-3)',
                        backgroundColor: 'var(--color-bg-canvas)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                      }}
                    >
                      <span>
                        <strong>{p.name}</strong> (Qty: {p.qty}) - ₹{p.cost}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(p.id)}
                        className="sm-icon-btn"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Part Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <Input
                  label="Part Name / SKU"
                  placeholder="e.g. DC-FUSE-15A-1000V"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                />
                <Input
                  label="Qty"
                  type="number"
                  min="1"
                  value={newPartQty}
                  onChange={(e) => setNewPartQty(parseInt(e.target.value, 10) || 1)}
                />
                <Input
                  label="Cost (₹)"
                  type="number"
                  placeholder="350"
                  value={newPartCost}
                  onChange={(e) => setNewPartCost(e.target.value)}
                />
                <Button variant="secondary" size="md" icon={Plus} onClick={handleAddPart}>
                  Add
                </Button>
              </div>
            </div>

            {/* SECTION E: BEFORE & AFTER PHOTO EVIDENCE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {/* Before Service Photos */}
              <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Pre-Service Evidence Photos
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  {beforePhotos.map((photo) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      <img
                        src={photo.previewUrl}
                        alt="Pre-service evidence"
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, 'BEFORE')}
                  style={{ fontSize: '11px' }}
                />
              </div>

              {/* After Service Photos */}
              <div style={{ backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Post-Service Verification Photos
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                  {afterPhotos.map((photo) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      <img
                        src={photo.previewUrl}
                        alt="Post-service verification"
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, 'AFTER')}
                  style={{ fontSize: '11px' }}
                />
              </div>
            </div>

            {uploadProgress && (
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="sm-spinner sm-spinner--sm" /> Uploading {uploadProgress.phase} verification photo ({uploadProgress.percent}%)...
              </div>
            )}

            {/* SECTION F: STATUS WORKFLOW ACTIONS */}
            <div
              style={{
                borderTop: '1px solid var(--color-border-subtle)',
                paddingTop: 'var(--space-4)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <Button variant="secondary" onClick={() => setSelectedOrder(null)}>
                Close Window
              </Button>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {selectedOrder.status !== 'IN_PROGRESS' && selectedOrder.status !== 'COMPLETED' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleTransitionStatus('IN_PROGRESS')}
                  >
                    Start Inspection (In Progress)
                  </Button>
                )}

                {selectedOrder.status !== 'AWAITING_VERIFICATION' && selectedOrder.status !== 'COMPLETED' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleTransitionStatus('AWAITING_VERIFICATION')}
                  >
                    Submit for Verification
                  </Button>
                )}

                <Button
                  variant="primary"
                  icon={CheckCircle2}
                  onClick={() => handleTransitionStatus('COMPLETED')}
                >
                  Complete & Sign-Off Service
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TechnicianDashboardPage;
