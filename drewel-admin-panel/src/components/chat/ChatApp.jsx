// ChatApp.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useChat } from "../../context/ChatContext";
import { getDriverDetail } from "../../api/domains/drivers";
import { getUserDetail } from "../../api/domains/users";
import ChatSidebar from "./ChatSidebar";
import ChatMessages from "./ChatMessages";
import GlobalChat from "./GlobalChat";
import "./ChatApp.css";
import { getOtherParticipant, getOtherParticipantRole, participantId, participantProfilePath } from "./chatParticipants";

const ChatApp = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledDeepLink = useRef("");
  const {
    conversations,
    messages,
    selectedUser,
    userDetails,
    globalMessages,
    loading,
    error,
    loadConversations,
    loadMessages,
    loadGlobalMessages,
    sendMessage,
    markAsSeen,
    sendGlobalMessage,
    setSelectedUser,
  } = useChat();

  const [activeTab, setActiveTab] = useState("chats");
  const [currentUser, setCurrentUser] = useState(null);

  // MOBILE RESPONSIVE STATE
  const [isMobileView, setIsMobileView] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Detect mobile screen
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobileView(mobile);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load user and conversations
  useEffect(() => {
    // Get current user from localStorage
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      try {
        const user = JSON.parse(adminData);
        if (user?._id) {
          setCurrentUser(user);
          loadConversations(user._id);
        }
      } catch {
        setCurrentUser(null);
      }
    }
  }, [loadConversations]);

  // Support links can select an existing conversation or start a writable one.
  useEffect(() => {
    const role = searchParams.get("participant") || (searchParams.get("driver") ? "driver" : searchParams.get("user") ? "user" : "");
    const id = searchParams.get("id") || searchParams.get("driver") || searchParams.get("user") || "";
    const deepLinkKey = `${role}:${id}`;
    if (!id || !role || handledDeepLink.current === deepLinkKey || !currentUser?._id) return;

    const conversation = conversations.find((item) => participantId(getOtherParticipant(item, currentUser._id)) === id);
    if (conversation) {
      const participant = getOtherParticipant(conversation, currentUser._id);
      handledDeepLink.current = deepLinkKey;
      setActiveTab("chats");
      setSelectedUser(participant);
      loadMessages(id);
      if (isMobileView) setShowSidebar(false);
      return;
    }

    let cancelled = false;
    const loadParticipant = role.toLowerCase() === "driver" ? getDriverDetail : getUserDetail;
    loadParticipant(id).then((participant) => {
      if (cancelled) return;
      const normalized = { ...participant, _id: participant?._id || participant?.id || id, role };
      handledDeepLink.current = deepLinkKey;
      setActiveTab("chats");
      setSelectedUser(normalized);
      loadMessages(id);
      if (isMobileView) setShowSidebar(false);
    }).catch(() => {
      if (cancelled) return;
      handledDeepLink.current = deepLinkKey;
      setSelectedUser({ _id: id, role, fullName: role === "driver" ? "Driver" : "User" });
      loadMessages(id);
    });
    return () => { cancelled = true; };
  }, [conversations, currentUser, isMobileView, loadMessages, searchParams, setSelectedUser]);

  useEffect(() => {
    if (activeTab === "global" && currentUser) {
      loadGlobalMessages();
    }
  }, [activeTab, currentUser, loadGlobalMessages]);

  // User selects a conversation
  const handleUserSelect = (user) => {
    if (user && user._id) {
      setSelectedUser(user);
      loadMessages(user._id);

      if (isMobileView) {
        setShowSidebar(false); // hide sidebar → open chat full screen
      }
    }
  };

  const handleViewProfile = useCallback((user = selectedUser, explicitRole) => {
    if (!user) return;
    let role = explicitRole || user.role;
    if (!role && currentUser?._id) {
      const conversation = conversations.find((item) => participantId(getOtherParticipant(item, currentUser._id)) === participantId(user));
      role = getOtherParticipantRole(conversation, currentUser._id);
    }
    const path = participantProfilePath(user, role);
    if (path) navigate(path);
  }, [conversations, currentUser, navigate, selectedUser]);

  // Send message (personal chat)
  const handleSendMessage = useCallback(
    (messageData) => {
      if (currentUser && selectedUser) {
        const fullMessageData = {
          ...messageData,
          sender: currentUser._id,
          receiver: selectedUser._id,
          msgByUserId: currentUser._id,
        };
        sendMessage(fullMessageData);
      }
    },
    [currentUser, selectedUser, sendMessage]
  );

  // Global chat send
  const handleGlobalMessageSend = (messageData) => {
    if (currentUser) {
      const fullMessageData = {
        ...messageData,
        msgByUserId: currentUser._id,
      };
      sendGlobalMessage(fullMessageData);
    }
  };

  // Mark messages as seen
  const handleMarkAsSeen = useCallback(() => {
    if (selectedUser) {
      markAsSeen(selectedUser._id);
    }
  }, [selectedUser, markAsSeen]);

  if (error) {
    return (
      <div className="chat-error">
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <div className="chat-container">

        {/* SIDEBAR */}
        {(!isMobileView || showSidebar) && (
          <div className="chat-sidebar">
            <div className="chat-tabs">
              <button
                className={`tab-button ${activeTab === "chats" ? "active" : ""}`}
                onClick={() => setActiveTab("chats")}
              >
                Chats
              </button>
              <button
                className={`tab-button ${activeTab === "global" ? "active" : ""}`}
                onClick={() => setActiveTab("global")}
              >
                Global Chat
              </button>
            </div>

            {activeTab === "chats" && (
              <ChatSidebar
                conversations={conversations}
                selectedUser={selectedUser}
                onUserSelect={handleUserSelect}
                onViewProfile={handleViewProfile}
                loading={loading}
              />
            )}

            {activeTab === "global" && (
              <div className="global-sidebar">
                <h3>Global Chat</h3>
                <p>All users can participate in this chat</p>
              </div>
            )}
          </div>
        )}

        {/* MAIN CHAT */}
        {(!isMobileView || !showSidebar) && (
          <div className="chat-main">

            {isMobileView && (
              <div className="mobile-header">
                <button
                  className="back-btn"
                  onClick={() => setShowSidebar(true)}
                >
                  ← Back
                </button>
                <div className="mobile-title">
                  {selectedUser ? (selectedUser.firstName || selectedUser.fullName || "Chat") : "Welcome"}
                </div>
              </div>
            )}

            {activeTab === "chats" && selectedUser ? (
              <ChatMessages
                messages={messages}
                selectedUser={selectedUser}
                userDetails={userDetails}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onMarkAsSeen={handleMarkAsSeen}
                onViewProfile={() => handleViewProfile(selectedUser)}
                loading={loading}
              />
            ) : activeTab === "global" ? (
              <GlobalChat
                messages={globalMessages}
                currentUser={currentUser}
                onSendMessage={handleGlobalMessageSend}
                loading={loading}
              />
            ) : (
              <div className="chat-placeholder">
                <h3>Welcome to Chat</h3>
                <p>Select a conversation to begin messaging</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default ChatApp;
