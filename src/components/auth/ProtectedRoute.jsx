// src/components/auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, user, requiredRole = null, redirectTo = '/app/projects' }) => {
  // If no user is logged in, redirect
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // If a specific role is required and user doesn't have it, redirect
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={redirectTo} replace />;
  }

  // User is authenticated and has required role (if any)
  return children;
};

export default ProtectedRoute;