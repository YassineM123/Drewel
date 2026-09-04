/* eslint-disable react/prop-types */
// ChatSidebar.jsx
import React from 'react';
import { format } from 'date-fns';
import './ChatSidebar.css';
import SafeImage from '../SafeImage';
import { getOtherParticipant, getOtherParticipantRole, participantPhone } from './chatParticipants';

const ChatSidebar = ({ conversations, selectedUser, onUserSelect, onViewProfile, loading }) => {
  const [roleFilter, setRoleFilter] = React.useState('all');

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
  const visibleConversations = React.useMemo(() => (
    (conversations || []).filter((conversation) => (
      roleFilter === 'all' || getOtherParticipantRole(conversation, currentUserId) === roleFilter
    ))
  ), [conversations, currentUserId, roleFilter]);

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
        <h3>Support conversations</h3>
        <span className="conversation-count">{visibleConversations.length}</span>
      </div>

      <div className="conversation-role-filters" aria-label="Filter support conversations">
        {[['all', 'All'], ['user', 'Users'], ['driver', 'Drivers']].map(([value, label]) => (
          <button key={value} type="button" className={roleFilter === value ? 'active' : ''}
            aria-pressed={roleFilter === value} onClick={() => setRoleFilter(value)}>{label}</button>
        ))}
      </div>

      <div className="conversations-list">
        {visibleConversations.length === 0 ? (
          <div className="no-conversations">
            <p>No {roleFilter === 'all' ? '' : `${roleFilter} `}conversations</p>
            <small>Choose another filter or start a conversation.</small>
          </div>
        ) : (
          visibleConversations.map((conversation) => {
            const otherUser = getOtherParticipant(conversation, currentUserId);
            const participantRole = getOtherParticipantRole(conversation, currentUserId);
            const isSelected = selectedUser?._id === otherUser?._id;

            if (!otherUser) return null;

            return (
              <div
                key={conversation._id}
                className={`conversation-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onUserSelect(otherUser)}
              >
                <button type="button" className="conversation-avatar" title={`View ${participantRole} profile`}
                  aria-label={`View ${participantRole} profile`} onClick={(event) => {
                    event.stopPropagation();
                    onViewProfile?.(otherUser, participantRole);
                  }}>
                  <SafeImage
                    src={otherUser.avatarUrl || otherUser.profileImageUrl || otherUser.profilePicture}
                    alt={otherUser.firstName || otherUser.userName}
                    fallback="avatar"
                    fallbackLabel={otherUser.fullName || otherUser.firstName}
                    style={{ width: "100%", height: "100%", borderRadius: 10, objectFit: "cover" }}
                    loading="lazy"
                  />
                  {conversation.unseenMsg > 0 && (
                    <span className="unread-badge">{conversation.unseenMsg}</span>
                  )}
                </button>

                <div className="conversation-content">
                  <div className="conversation-header">
                    <h4 className="conversation-name">
                      {otherUser.firstName && otherUser.lastName
                        ? `${otherUser.firstName} ${otherUser.lastName}`
                        : otherUser.fullName || 'Unknown User'}
                      {conversation.senderReference && (
                        <span className="sender-reference">{conversation.senderReference}</span>
                      )}
                      <span className={`participant-role participant-role--${participantRole}`}>{participantRole}</span>
                    </h4>
                    <span className="conversation-time">
                      {formatLastMessageTime(conversation)}
                    </span>
                  </div>

                  <p className="mini-phone">{participantPhone(otherUser)}</p>

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
