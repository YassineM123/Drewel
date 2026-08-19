import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VerificationRequests from "./pages/VerificationRequests";
import RequestDetails from "./pages/RequestDetails";
import Drivers from "./pages/Drivers";
import Users from "./pages/Users";
import Chat from "./pages/Chat";
import SecureCalls from "./pages/SecureCalls";
import SponsorBanners from "./pages/SponsorBanners";
import OnlineDrivers from "./pages/OnlineDrivers";
import Settings from "./pages/Settings";
import Alerts from "./pages/Alerts";
import AuditLogs from "./pages/AuditLogs";
import TeamRoles from "./pages/TeamRoles";
import SystemHealth from "./pages/SystemHealth";
import LiveRides from "./pages/rides/LiveRides";
import AllRides from "./pages/rides/AllRides";
import Disputes from "./pages/rides/Disputes";
import StuckRides from "./pages/rides/StuckRides";
import DriverPoints from "./pages/points/DriverPoints";
import PointsTransactions from "./pages/points/PointsTransactions";
import PointRequests from "./pages/points/PointRequests";
import PointsOverview from "./pages/points/PointsOverview";
import PointPacks from "./pages/points/PointPacks";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                <Route path="/rides/live"      element={<LiveRides />} />
                <Route path="/rides/all"       element={<AllRides defaultTab="all" />} />
                <Route path="/rides/completed" element={<AllRides defaultTab="completed" />} />
                <Route path="/rides/cancelled" element={<AllRides defaultTab="cancelled" />} />
                <Route path="/rides/disputes"  element={<Disputes />} />
                <Route path="/rides/stuck"     element={<StuckRides />} />

                <Route path="/online-drivers" element={<OnlineDrivers />} />

                <Route path="/verification"          element={<VerificationRequests />} />
                <Route path="/verification/pending"  element={<VerificationRequests defaultStatus="pending" />} />
                <Route path="/verification/approved" element={<VerificationRequests defaultStatus="approved" />} />
                <Route path="/verification/rejected" element={<VerificationRequests defaultStatus="rejected" />} />
                <Route path="/verification/:id"      element={<RequestDetails />} />

                <Route path="/drivers" element={<Drivers />} />
                <Route path="/users"   element={<Users />} />

                <Route path="/points/overview"     element={<PointsOverview />} />
                <Route path="/points/balances"     element={<DriverPoints />} />
                <Route path="/points/requests"     element={<PointRequests />} />
                <Route path="/points/transactions" element={<PointsTransactions />} />
                <Route path="/points/packs"        element={<PointPacks />} />

                <Route path="/chat"         element={<Chat />} />
                <Route path="/secure-calls" element={<SecureCalls />} />

                <Route path="/banners" element={<SponsorBanners />} />

                <Route path="/alerts"        element={<Alerts />} />
                <Route path="/audit-logs"    element={<AuditLogs />} />
                <Route path="/team-roles"    element={<TeamRoles />} />
                <Route path="/system-health" element={<SystemHealth />} />
                <Route path="/settings"      element={<Settings />} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
