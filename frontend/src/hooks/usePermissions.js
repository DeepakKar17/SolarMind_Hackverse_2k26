import { useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Normalizes role string to lowercase for safe comparison.
 */
export const normalizeRole = (role) => (role ? String(role).toLowerCase() : '');

/**
 * Standard SolarMind RBAC Roles.
 */
export const ROLES = {
  ADMIN: 'admin',
  HOMEOWNER: 'homeowner',
  TECHNICIAN: 'technician',
  OPERATOR: 'operator',
};

/**
 * Custom React hook for role and resource permission evaluation.
 */
export const usePermissions = () => {
  const { user, isAuthenticated } = useAuth();

  const userRole = useMemo(() => normalizeRole(user?.role), [user]);

  const isAdmin = useMemo(() => userRole === ROLES.ADMIN, [userRole]);
  const isHomeowner = useMemo(() => userRole === ROLES.HOMEOWNER, [userRole]);
  const isTechnician = useMemo(() => userRole === ROLES.TECHNICIAN, [userRole]);
  const isOperator = useMemo(() => userRole === ROLES.OPERATOR, [userRole]);

  /**
   * Check if current user possesses any of the specified roles.
   * @param {string|string[]} roles 
   */
  const hasRole = useCallback((roles) => {
    if (!roles) return true;
    if (!isAuthenticated || !userRole) return false;
    const allowed = Array.isArray(roles) ? roles : [roles];
    return allowed.map(normalizeRole).includes(userRole);
  }, [isAuthenticated, userRole]);

  /**
   * Homeowner plant ownership or Admin access.
   */
  const canViewPlant = useCallback((plant) => {
    if (!isAuthenticated) return false;
    if (isAdmin || isOperator) return true;
    if (isHomeowner) {
      if (!plant) return true;
      return plant.owner_id === user?.id || plant.ownerId === user?.id;
    }
    return false;
  }, [isAuthenticated, isAdmin, isOperator, isHomeowner, user]);

  /**
   * Only admins can create or update plant registrations.
   */
  const canManagePlants = useCallback(() => {
    return isAdmin;
  }, [isAdmin]);

  /**
   * Check work order visibility:
   * - Admin/Operator: all work orders
   * - Technician: only assigned work orders
   * - Homeowner: work orders belonging to their plants
   */
  const canViewWorkOrder = useCallback((workOrder) => {
    if (!isAuthenticated) return false;
    if (isAdmin || isOperator) return true;
    if (isTechnician) {
      if (!workOrder) return true;
      const techId = workOrder.technician_id ?? workOrder.technicianId;
      const assignedTo = workOrder.assigned_to || workOrder.assignedTo;
      const isAssignedById = techId !== undefined && techId !== null && techId === user?.id;
      const isAssignedByUsername = assignedTo && user?.username && assignedTo.toLowerCase() === user.username.toLowerCase();
      const isAssignedByName = assignedTo && user?.full_name && assignedTo.toLowerCase() === user.full_name.toLowerCase();
      return Boolean(isAssignedById || isAssignedByUsername || isAssignedByName);
    }
    if (isHomeowner) {
      if (!workOrder) return true;
      const plantOwnerId = workOrder.plant?.owner_id ?? workOrder.plant?.ownerId;
      return plantOwnerId !== undefined && plantOwnerId !== null && plantOwnerId === user?.id;
    }
    return false;
  }, [isAuthenticated, isAdmin, isOperator, isTechnician, isHomeowner, user]);

  /**
   * Check if user can modify work order notes, actions, or status.
   */
  const canModifyWorkOrder = useCallback((workOrder) => {
    if (!isAuthenticated) return false;
    if (isAdmin) return true;
    if (isTechnician) {
      if (!workOrder) return true;
      const techId = workOrder.technician_id ?? workOrder.technicianId;
      const assignedTo = workOrder.assigned_to || workOrder.assignedTo;
      const isAssignedById = techId !== undefined && techId !== null && techId === user?.id;
      const isAssignedByUsername = assignedTo && user?.username && assignedTo.toLowerCase() === user.username.toLowerCase();
      const isAssignedByName = assignedTo && user?.full_name && assignedTo.toLowerCase() === user.full_name.toLowerCase();
      return Boolean(isAssignedById || isAssignedByUsername || isAssignedByName);
    }
    return false;
  }, [isAuthenticated, isAdmin, isTechnician, user]);

  /**
   * Homeowners can request diagnosis on permitted assets; Admins can on all.
   */
  const canRequestDiagnosis = useCallback(() => {
    return isAdmin || isHomeowner;
  }, [isAdmin, isHomeowner]);

  /**
   * Inspection photo upload permissions.
   */
  const canUploadPhotos = useCallback(() => {
    return isAdmin || isTechnician || isHomeowner;
  }, [isAdmin, isTechnician, isHomeowner]);

  /**
   * System configuration and user account management permissions.
   */
  const canManageUsers = useCallback(() => isAdmin, [isAdmin]);
  const canViewSystemConfig = useCallback(() => isAdmin, [isAdmin]);
  const canViewFleetAnalytics = useCallback(() => isAdmin || isOperator, [isAdmin, isOperator]);

  return {
    user,
    userRole,
    isAuthenticated,
    isAdmin,
    isHomeowner,
    isTechnician,
    isOperator,
    hasRole,
    canViewPlant,
    canManagePlants,
    canViewWorkOrder,
    canModifyWorkOrder,
    canRequestDiagnosis,
    canUploadPhotos,
    canManageUsers,
    canViewSystemConfig,
    canViewFleetAnalytics,
  };
};

export default usePermissions;
