import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { LoadingState } from '../common';

/**
 * RoleGuard component to restrict entire routes/layouts to specific user roles.
 * Redirects unauthenticated users to /login and unauthorized users to /unauthorized.
 *
 * @param {Object} props
 * @param {string|string[]} props.allowedRoles - Allowed role string or array of strings (e.g. ['admin', 'technician'])
 * @param {string} [props.redirectTo='/unauthorized'] - Path to redirect unauthorized users
 * @param {React.ReactNode} [props.children] - Child components to render if authorized
 */
export const RoleGuard = ({
  allowedRoles,
  redirectTo = '/unauthorized',
  children,
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasRole } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState message="Checking security authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAuthorized = hasRole(allowedRoles);

  if (!isAuthorized) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ? children : <Outlet />;
};

export default RoleGuard;
