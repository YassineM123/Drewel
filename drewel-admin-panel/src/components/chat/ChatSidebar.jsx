/* eslint-disable react/prop-types */
// ChatSidebar.jsx
import React from 'react';
import { format } from 'date-fns';
import './ChatSidebar.css';
import SafeImage from '../SafeImage';

const ChatSidebar = ({ conversations, selectedUser, onUserSelect, loading }) => {
  const getOtherUser = (conversation, currentUserId) => {
    if (conversation.sender?._id === currentUserId) {
      return conversation.receiver;
    }
    return conversation.sender;
  };

  const getLastMessage = (conversation) => {
    if (!conversation.lastMsg) return 'No messages yet';
    const { text, imageUrl, videoUrl } = conversation.lastMsg;
    if (imageUrl) return '📷 Image';
    if (videoUrl) return '🎥 Video';
    return text || 'No messages yet';
  };

  const formatLastMessageTime = (conversation) => {
    if (!conversation.lastMsg?.createdAt) return '';
    return format(new Date(conversation.lastMsg.createdAt), 'HH:mm');
  };

  const getCurrentUserId = React.useMemo(() => {
    const adminData = localStorage.getItem("admin");
    if (!adminData) return null;
    try {
      return JSON.parse(adminData)._id;
    } catch {
      return null;
    }
  }, []);

  const currentUserId = getCurrentUserId;

  if (loading) {
    return (
      <div className="chat-sidebar">
        <div className="sidebar-loading">
          <div className="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-sidebar-inner">
      <div className="sidebar-header">
        <h3>Conversations</h3>
        <span className="conversation-count">{conversations?.length ?? 0}</span>
      </div>

      <div className="conversations-list">
        {(!conversations || conversations.length === 0) ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <small>Start a conversation to see it here</small>
          </div>
        ) : (
          conversations.map((conversation) => {
            const otherUser = getOtherUser(conversation, currentUserId);
            const isSelected = selectedUser?._id === otherUser?._id;

            if (!otherUser) return null;

            return (
              <div
                key={conversation._id}
                className={`conversation-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onUserSelect(otherUser)}
              >
                <div className="conversation-avatar">
                  <SafeImage
                    src={otherUser.avatarUrl || otherUser.profileImageUrl}
                    alt={otherUser.firstName || otherUser.userName}
                    fallback="avatar"
                    fallbackLabel={otherUser.fullName || otherUser.firstName}
                    style={{ width: "100%", height: "100%", borderRadius: 10, objectFit: "cover" }}
                    loading="lazy"
                  />
                  {conversation.unseenMsg > 0 && (
                    <span className="unread-badge">{conversation.unseenMsg}</span>
                  )}
                </div>

                <div className="conversation-content">
                  <div className="conversation-header">
                    <h4 className="conversation-name">
                      {otherUser.firstName && otherUser.lastName
                        ? `${otherUser.firstName} ${otherUser.lastName}`
                        : otherUser.fullName || 'Unknown User'}
                      {conversation.senderReference && (
                        <span className="sender-reference">{conversation.senderReference}</span>
                      )}
                    </h4>
                    <span className="conversation-time">
                      {formatLastMessageTime(conversation)}
                    </span>
                  </div>

                  <p className="mini-phone">{otherUser?.countryCode}-{otherUser?.phone}</p>

                  <div className="conversation-preview">
                    <p className="last-message">{getLastMessage(conversation)}</p>
                    {conversation.unseenMsg > 0 && (
                      <div className="unread-indicator"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default React.memo(ChatSidebar);
