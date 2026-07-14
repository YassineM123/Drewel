/* eslint-disable react/prop-types */
// ChatMessages.jsx
import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import './ChatMessages.css';
import SafeImage from '../SafeImage';

const ChatMessages = ({
  messages = [],
  selectedUser,
  userDetails,
  currentUser,
  onSendMessage,
  onMarkAsSeen,
  loading,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Robust scrolling: scroll to bottom using RAF to avoid layout jank.
  const scrollToBottom = (behavior = 'smooth') => {
    if (!messagesEndRef.current || !containerRef.current) return;
    // ensure container scroll performs after layout using RAF
    requestAnimationFrame(() => {
      try {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      } catch {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  };

  // Scroll when messages change (use message id/length)
  const latestMessageId = messages?.[messages.length - 1]?._id;
  useEffect(() => {
    if (messages?.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages?.length, latestMessageId]);

  // Mark as seen on user change or initial load
  useEffect(() => {
    if (selectedUser) {
      onMarkAsSeen();
      scrollToBottom('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Ensure images/videos when loaded cause a scroll (so we don't miss newly added media)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const imgs = node.querySelectorAll('img');
    const vids = node.querySelectorAll('video');

    const onMediaLoad = () => {
      scrollToBottom('smooth');
    };

    imgs.forEach((img) => img.addEventListener('load', onMediaLoad));
    vids.forEach((v) => v.addEventListener('loadeddata', onMediaLoad));

    return () => {
      imgs.forEach((img) => img.removeEventListener('load', onMediaLoad));
      vids.forEach((v) => v.removeEventListener('loadeddata', onMediaLoad));
    };
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageData = {
      text: newMessage.trim(),
      imageUrl: null,
      videoUrl: null,
    };

    onSendMessage(messageData);
    setNewMessage('');
    // optimistic scroll
    scrollToBottom('smooth');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileURL = URL.createObjectURL(file);
    console.log('Uploading file:', fileURL);

    const messageData = {
      text: `File: ${file.name}`,
      imageUrl: file.type.startsWith('image/') ? fileURL : null,
      videoUrl: file.type.startsWith('video/') ? fileURL : null,
    };

    onSendMessage(messageData);
    // free the object URL after some time (optional)
    setTimeout(() => URL.revokeObjectURL(fileURL), 60000);
  };

  const isMyMessage = (message) => {
    return message?.msgByUserId === currentUser?._id;
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return '';
    }
  };

  const renderMessage = (message, index) => {
    const isMine = isMyMessage(message);
    const showAvatar = !isMine && (index === 0 || !isMyMessage(messages[index - 1]));

    return (
      <div
        key={message._id || index}
        className={`message-container ${isMine ? 'my-message' : 'other-message'}`}
      >
        {showAvatar && (
          <div className="message-avatar">
            <SafeImage
              src={selectedUser?.avatarUrl || selectedUser?.profileImageUrl}
              alt={selectedUser?.firstName || selectedUser?.userName}
              fallback="avatar"
              fallbackLabel={selectedUser?.fullName || selectedUser?.firstName}
              style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }}
              loading="lazy"
            />
          </div>
        )}

        <div className={`message ${isMine ? 'mine' : 'other'}`}>
          {message.imageUrl && (
            <div className="message-image">
              <SafeImage
                src={message.imageUrl}
                alt="Shared image"
                style={{ maxWidth: 320, minWidth: 160, minHeight: 90, borderRadius: 10, objectFit: "contain" }}
              />
            </div>
          )}

          {message.videoUrl && (
            <div className="message-video">
              <video controls>
                <source src={message.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {message.text && (
            <div className="message-text">
              <p>{message.text}</p>
            </div>
          )}

          <div className="message-meta">
            <span className="message-time">
              {formatMessageTime(message.createdAt)}
            </span>
            {isMine && (
              <span className="message-status">
                {message.seen ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="chat-messages">
        <div className="messages-loading">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      {/* Header */}
      <div className="messages-header">
        <div className="user-info">
          <SafeImage
            src={selectedUser?.avatarUrl || selectedUser?.profileImageUrl}
            alt={selectedUser?.fullName || selectedUser?.userName}
            className="user-avatar"
            fallback="avatar"
            fallbackLabel={selectedUser?.fullName || selectedUser?.firstName}
            loading="lazy"
          />
          <div className="user-details">
            <h3 className="user-name">
              {selectedUser?.firstName && selectedUser?.lastName
                ? `${selectedUser.firstName} ${selectedUser.lastName}`
                : selectedUser?.fullName || 'Unknown User'}
            </h3>
            <div className="user-sub">
              <span className="user-ref">{selectedUser?.senderReference ?? ""}</span>
              <p className="user-phone">{selectedUser?.countryCode}-{selectedUser?.phone}</p>
            </div>
            <span className="user-status">
              {userDetails?.online ? '🟢 Online' : '⚪ Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" ref={containerRef} aria-live="polite">
        {(!messages || messages.length === 0) ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <small>Start the conversation!</small>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message, index) => renderMessage(message, index))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form className="message-input-container" onSubmit={handleSendMessage}>
        <div className="input-actions">
          <button
            type="button"
            className="file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        <div className="message-input-wrapper">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
            }}
            placeholder="Type a message..."
            className="message-input"
            disabled={!selectedUser}
          />
        </div>

        <button
          type="submit"
          className="send-button"
          disabled={!newMessage.trim() || !selectedUser}
          aria-label="Send message"
        >
          ➤
        </button>
      </form>
    </div>
  );
};

export default React.memo(ChatMessages);
