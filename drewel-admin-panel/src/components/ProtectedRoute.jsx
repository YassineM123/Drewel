// import React from "react";
// import Layout from "./Layout";
// import { Outlet } from "react-router-dom";

// const ProtectedRoute = () => {
//   return (
//     <>
//       <Layout />
//       <Outlet />
//     </>
//   );
// };

// export default ProtectedRoute;

import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import Layout from "./Layout";
import { clearAdminSession, isAuthTokenUsable } from "../utils/session";

const ProtectedRoute = () => {
  const token = localStorage.getItem("authToken");

  if (!isAuthTokenUsable(token)) {
    clearAdminSession();
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Layout />
      <Outlet />
    </>
  );
};

export default ProtectedRoute;
