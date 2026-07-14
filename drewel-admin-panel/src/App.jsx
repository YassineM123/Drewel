import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import ServiceRequests from "./pages/ServiceRequests";
import CmsManagement from "./pages/CmsManagement";
import Faq from "./pages/Faq";
import AccountSettings from "./pages/AccountSettings";
import PushNotification from "./pages/PushNotification";
import AddServiceRequest from "./components/AddServiceRequest";
import AddProgram from "./components/AddProgram";
import AddUser from "./components/AddUser";
import Providers from "./pages/Providers";
import Orders from "./pages/Orders";
import Revenue from "./pages/Revenue";
import Club from "./pages/Club";
import GolfCourses from "./pages/GolfCourses";
import Drivers from "./pages/Drivers";
import DriverDetail from "./pages/DriverDetail";
import EditDriver from "./pages/EditDriver";
import Sponsor from "./pages/Sponsor";
import ChatWrapper from "./components/chat/ChatWrapper";
import OnlineDrivers from "./pages/OnlineDrivers";
import UpdateProgram from "./components/UpdateProgram";

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
              <Route path="/driver-detail/:id" element={<DriverDetail />} />
              <Route path="/edit-driver/:id" element={<EditDriver />} />
              <Route path="/users/edit-user" element={<AddUser />} />
              <Route path="/providers" element={<Providers />} />
              <Route path="/cms-manage" element={<CmsManagement />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/account-settings" element={<AccountSettings />} />
              <Route path="/notification" element={<PushNotification />} />
              <Route path="/chat" element={<ChatWrapper />} />
            </Route>
          </Routes>
        </Router>
      </ChatProvider>
    </SocketProvider>
  );
}

export default App;
