// ChatApp.jsx
import { useState, useEffect, useCallback } from "react";
import { useChat } from "../../context/ChatContext";
import ChatSidebar from "./ChatSidebar";
import ChatMessages from "./ChatMessages";
import GlobalChat from "./GlobalChat";
import "./ChatApp.css";

const ChatApp = () => {
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
      const user = JSON.parse(adminData);
      setCurrentUser(user);
      loadConversations(user._id);
    }
  }, [loadConversations]);

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
                className={`tab-button ${activeTab === "groups" ? "active" : ""}`}
                onClick={() => setActiveTab("groups")}
              >
                Groups
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
                loading={loading}
              />
            ) : activeTab === "global" ? (
              <GlobalChat
                messages={globalMessages}
                currentUser={currentUser}
                onSendMessage={handleGlobalMessageSend}
                loading={loading}
              />
            ) : activeTab === "groups" ? (
              <div className="chat-placeholder">
                <h3>Group Chat</h3>
                <p>Select a group from the sidebar</p>
              </div>
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
