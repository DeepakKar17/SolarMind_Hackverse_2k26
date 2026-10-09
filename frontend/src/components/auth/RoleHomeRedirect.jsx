import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Role-aware root redirector that dynamically routes authenticated users
 * to their primary portal based on verified server role.
 */
export const RoleHomeRedirect = () => {
  const { user } = useAuth();
  const role = (user?.role || '').toUpperCase();

  if (role === 'HOMEOWNER') {
    return <Navigate to="/home/dashboard" replace />;
  }
  if (role === 'TECHNICIAN') {
    return <Navigate to="/technician/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export default RoleHomeRedirect;
