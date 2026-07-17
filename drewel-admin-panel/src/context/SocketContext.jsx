import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/api';
import { isAuthTokenUsable, redirectToLogin } from '../utils/session';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'));

  useEffect(() => {
    const syncToken = () => setAuthToken(localStorage.getItem('authToken'));
    window.addEventListener('admin-auth-changed', syncToken);
    window.addEventListener('storage', syncToken);
    return () => {
      window.removeEventListener('admin-auth-changed', syncToken);
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  useEffect(() => {
    if (!isAuthTokenUsable(authToken)) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: {
        token: authToken
      },
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setIsConnected(false);
    });

    newSocket.on('onlineUser', (users) => {
      console.log('Received onlineUser event:', users);
      setOnlineUsers(users);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      if (/unauthor|token|session/i.test(err?.message || '')) {
        redirectToLogin();
      }
    });

    newSocket.on('auth-error', () => {
      redirectToLogin();
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [authToken]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 
