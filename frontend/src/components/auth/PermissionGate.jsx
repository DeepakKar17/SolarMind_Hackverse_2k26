import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * PermissionGate component for granular UI elements.
 * Evaluates allowed roles and/or custom permission functions.
 *
 * @param {Object} props
 * @param {string|string[]} [props.allowedRoles] - Optional allowed roles
 * @param {boolean|function} [props.permissionCheck] - Optional boolean or callback `(permissions) => boolean`
 * @param {React.ReactNode} [props.fallback=null] - Fallback content if permission is denied
 * @param {React.ReactNode} props.children - Content to display if authorized
 */
export const PermissionGate = ({
  allowedRoles,
  permissionCheck,
  fallback = null,
  children,
}) => {
  const permissions = usePermissions();
  const { hasRole } = permissions;

  let isPermitted = true;

  if (allowedRoles) {
    isPermitted = isPermitted && hasRole(allowedRoles);
  }

  if (permissionCheck !== undefined) {
    if (typeof permissionCheck === 'function') {
      isPermitted = isPermitted && Boolean(permissionCheck(permissions));
    } else {
      isPermitted = isPermitted && Boolean(permissionCheck);
    }
  }

  if (!isPermitted) {
    return fallback;
  }

  return <>{children}</>;
};

export default PermissionGate;
