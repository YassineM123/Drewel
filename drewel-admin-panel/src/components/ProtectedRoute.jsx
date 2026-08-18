import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { clearAdminSession, isAuthTokenUsable } from "../utils/session";

const ProtectedRoute = () => {
  const token = localStorage.getItem("authToken");

  if (!isAuthTokenUsable(token)) {
    clearAdminSession();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
