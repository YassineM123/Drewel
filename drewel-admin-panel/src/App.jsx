import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
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
import PendingRequests from "./pages/PendingRequests";
import ApprovedRequests from "./pages/ApprovedRequests";
import RejectedRequests from "./pages/RejectedRequests";
import AllRequests from "./pages/AllRequests";
import Calls from "./pages/Calls";

function App() {
  return (
    <SocketProvider>
      <ChatProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/sponsor" element={<Sponsor/>}/>
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/onlineDrivers" element={<OnlineDrivers />} />
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
              <Route path="/calls" element={<Calls />} />
            </Route>
          </Routes>
        </Router>
      </ChatProvider>
    </SocketProvider>
  );
}

export default App;
