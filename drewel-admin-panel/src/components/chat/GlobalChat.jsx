/* eslint-disable react/prop-types */
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import './GlobalChat.css';
import SafeImage from '../SafeImage';

const GlobalChat = ({ messages, currentUser, onSendMessage, loading }) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    return format(new Date(timestamp), 'HH:mm');
  };

  const renderMessage = (message) => {
    const senderId = message.msgByUserId?._id || message.msgByUserId;
    const isMine = String(senderId) === String(currentUser?._id);
    const sender = message.msgByUserId; // Populated on the backend when available

    return (
      <div
        key={message._id}
        className={`global-message-container ${isMine ? 'my-message' : 'other-message'}`}
      >
        <div className={`global-message ${isMine ? 'mine' : 'other'}`}>
          {!isMine && (
            <div className="message-sender">
              <span className="sender-name">
                {sender?.userName || sender?.firstName || 'Unknown User'}
              </span>
            </div>
          )}

          {message.imageUrl && (
            <div className="message-image">
              <SafeImage
                src={message.imageUrl}
                alt="Shared image"
                style={{ maxWidth: "100%", minWidth: 160, minHeight: 90, borderRadius: 8, objectFit: "contain" }}
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
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="global-chat">
        <div className="global-loading">
          <div className="loading-spinner"></div>
          <p>Loading global messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="global-chat">
      {/* Header */}
      <div className="global-header">
        <h2>🌍 Global Chat</h2>
        <p>Chat with all users in the system</p>
      </div>

      {/* Messages */}
      <div className="global-messages-container">
        {messages.length === 0 ? (
          <div className="no-global-messages">
            <p>No messages in global chat yet</p>
            <small>Be the first to send a message!</small>
          </div>
        ) : (
          messages.map((message) => renderMessage(message))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form className="global-message-input-container" onSubmit={handleSendMessage}>
        <div className="global-input-wrapper">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message to everyone..."
            className="global-message-input"
          />
        </div>

        <button
          type="submit"
          className="global-send-button"
          disabled={!newMessage.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default GlobalChat;
