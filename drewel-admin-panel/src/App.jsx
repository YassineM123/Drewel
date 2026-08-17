import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import CmsManagement from "./pages/CmsManagement";
import Faq from "./pages/Faq";
import AccountSettings from "./pages/AccountSettings";
import PushNotification from "./pages/PushNotification";
import AddUser from "./components/AddUser";
import Providers from "./pages/Providers";
import Drivers from "./pages/Drivers";
import DriverDetail from "./pages/DriverDetail";
import EditDriver from "./pages/EditDriver";
import Sponsor from "./pages/Sponsor";
import ChatWrapper from "./components/chat/ChatWrapper";
import OnlineDrivers from "./pages/OnlineDrivers";
import DriverMap from "./pages/DriverMap";
import PendingRequests from "./pages/PendingRequests";
import ApprovedRequests from "./pages/ApprovedRequests";
import RejectedRequests from "./pages/RejectedRequests";
import AllRequests from "./pages/AllRequests";
import Rides from "./pages/rides/Rides";
import RideDetail from "./pages/rides/RideDetail";
import RequirePointsAccess from "./components/driverPoints/RequirePointsAccess";
import PointsOverview from "./pages/driverPoints/PointsOverview";
import DriverWallets from "./pages/driverPoints/DriverWallets";
import DriverWalletDetail from "./pages/driverPoints/DriverWalletDetail";
import PurchaseRequests from "./pages/driverPoints/PurchaseRequests";
import PointTransactions from "./pages/driverPoints/PointTransactions";
import PointPacks from "./pages/driverPoints/PointPacks";
import PointsSettings from "./pages/driverPoints/PointsSettings";

function App() {
  return (
    <SocketProvider>
      <ChatProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/sponsor" element={<Sponsor/>}/>
              <Route path="/banners" element={<Sponsor/>}/>
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/onlineDrivers" element={<OnlineDrivers />} />
              <Route path="/online-drivers" element={<OnlineDrivers />} />
              <Route path="/driver-map" element={<DriverMap />} />
              <Route path="/requests/pending" element={<PendingRequests />} />
              <Route path="/requests/approved" element={<ApprovedRequests />} />
              <Route path="/requests/rejected" element={<RejectedRequests />} />
              <Route path="/requests/all" element={<AllRequests />} />
              <Route path="/requests/:id" element={<DriverDetail />} />
              <Route path="/driver-detail/:id" element={<DriverDetail />} />
              <Route path="/edit-driver/:id" element={<EditDriver />} />
              <Route path="/users/edit-user" element={<AddUser />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/cms-manage" element={<CmsManagement />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/account-settings" element={<AccountSettings />} />
              <Route path="/notification" element={<PushNotification />} />
              <Route path="/chat" element={<ChatWrapper />} />
              <Route path="/reservations" element={<Rides />} />
              <Route path="/reservations/live" element={<Rides initialFilter="live" lockedFilter />} />
              <Route path="/reservations/all" element={<Rides initialFilter="all" lockedFilter />} />
              <Route path="/reservations/completed" element={<Rides initialFilter="completed" lockedFilter />} />
              <Route path="/reservations/cancelled" element={<Rides initialFilter="cancelled" lockedFilter />} />
              <Route path="/reservations/disputes" element={<Rides initialFilter="disputed" lockedFilter />} />
              <Route path="/reservations/stuck" element={<Rides initialFilter="stuck" lockedFilter />} />
              <Route path="/reservations/:rideId" element={<RideDetail />} />
              <Route path="/rides" element={<Rides />} />
              <Route path="/rides/live" element={<Rides initialFilter="live" lockedFilter />} />
              <Route path="/rides/all" element={<Rides initialFilter="all" lockedFilter />} />
              <Route path="/rides/completed" element={<Rides initialFilter="completed" lockedFilter />} />
              <Route path="/rides/cancelled" element={<Rides initialFilter="cancelled" lockedFilter />} />
              <Route path="/rides/disputes" element={<Rides initialFilter="disputed" lockedFilter />} />
              <Route path="/rides/stuck" element={<Rides initialFilter="stuck" lockedFilter />} />
              <Route path="/rides/:rideId" element={<RideDetail />} />
              <Route element={<RequirePointsAccess />}>
                <Route path="/driver-points" element={<PointsOverview />} />
                <Route path="/points/overview" element={<PointsOverview />} />
                <Route path="/driver-points/wallets" element={<DriverWallets />} />
                <Route path="/points/balances" element={<DriverWallets />} />
                <Route path="/driver-points/wallets/:driverId" element={<DriverWalletDetail />} />
                <Route path="/driver-points/purchase-requests" element={<PurchaseRequests />} />
                <Route path="/points/requests" element={<PurchaseRequests />} />
                <Route path="/driver-points/transactions" element={<PointTransactions />} />
                <Route path="/points/transactions" element={<PointTransactions />} />
              </Route>
              <Route element={<RequirePointsAccess ownerOnly />}>
                <Route path="/driver-points/packs" element={<PointPacks />} />
                <Route path="/points/packs" element={<PointPacks />} />
                <Route path="/driver-points/settings" element={<PointsSettings />} />
              </Route>
              <Route path="/settings" element={<AccountSettings />} />
            </Route>
          </Routes>
        </Router>
      </ChatProvider>
    </SocketProvider>
  );
}

export default App;
