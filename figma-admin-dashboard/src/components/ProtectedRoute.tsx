import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F4F3]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#BE1B2C] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#868686]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
