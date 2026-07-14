import React from 'react';
import { Link } from 'react-router-dom';
import './ChatNavigation.css';

const ChatNavigation = () => {
  return (
    <div className="chat-navigation">
      <Link to="/chat" className="chat-nav-link">
        <span className="chat-icon">💬</span>
        <span className="chat-text">Chat</span>
        <span className="chat-badge">New</span>
      </Link>
    </div>
  );
};

export default ChatNavigation; 