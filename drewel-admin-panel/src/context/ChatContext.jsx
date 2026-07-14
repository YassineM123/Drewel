import { createContext, useCallback, useContext, useReducer, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSocket } from './SocketContext';

const ChatContext = createContext();

const initialState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  selectedUser: null,
  userDetails: null,
  groupConversations: [],
  globalMessages: [],
  loading: false,
  error: null,
};

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversation: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_SELECTED_USER':
      return { ...state, selectedUser: action.payload };
    case 'SET_USER_DETAILS':
      return { ...state, userDetails: action.payload };
    case 'SET_GROUP_CONVERSATIONS':
      return { ...state, groupConversations: action.payload };
    case 'SET_GLOBAL_MESSAGES':
      return { ...state, globalMessages: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'UPDATE_CONVERSATION': {
      const updatedConversations = state.conversations.map(conv =>
        conv._id === action.payload._id ? action.payload : conv
      );
      return { ...state, conversations: updatedConversations };
    }
    default:
      return state;
  }
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for conversation updates
    socket.on('conversation', (conversations) => {
      console.log('[Socket] Received conversation:', conversations);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    // Listen for new messages
    socket.on('message', (conversation) => {
      console.log('[Socket] Received message:', conversation);
      if (conversation && conversation.messages) {
        dispatch({ type: 'SET_MESSAGES', payload: conversation.messages });
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conversation });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    // Listen for user details
    socket.on('message-user', (userDetails) => {
      console.log('[Socket] Received message-user:', userDetails);
      dispatch({ type: 'SET_USER_DETAILS', payload: userDetails });
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    // Listen for group conversations
    socket.on('group-conversation', (groupData) => {
      console.log('[Socket] Received group-conversation:', groupData);
      if (groupData && groupData.groups) {
        dispatch({ type: 'SET_GROUP_CONVERSATIONS', payload: groupData.groups });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    // Listen for global messages
    socket.on('globalMessages', (globalData) => {
      console.log('[Socket] Received globalMessages:', globalData);
      if (globalData && globalData.messages) {
        dispatch({ type: 'SET_GLOBAL_MESSAGES', payload: globalData.messages });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    // Listen for errors
    socket.on('error', (error) => {
      console.error('[Socket] Received error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_LOADING', payload: false });
    });

    return () => {
      socket.off('conversation');
      socket.off('message');
      socket.off('message-user');
      socket.off('group-conversation');
      socket.off('globalMessages');
      socket.off('error');
    };
  }, [socket, isConnected]);

  const loadConversations = useCallback((currentUserId, page = 1, limit = 50) => {
    if (socket && isConnected) {
      console.log('[Socket] Emitting sidebar:', currentUserId, page, limit);
      dispatch({ type: 'SET_LOADING', payload: true });
      socket.emit('sidebar', currentUserId, page, limit);
    }
  }, [socket, isConnected]);

  const loadMessages = useCallback((userId) => {
    if (socket && isConnected) {
      console.log('[Socket] Emitting message-page:', userId);
      dispatch({ type: 'SET_LOADING', payload: true });
      socket.emit('message-page', userId);
    }
  }, [socket, isConnected]);

  const sendMessage = useCallback((messageData) => {
    if (socket && isConnected) {
      console.log('[Socket] Emitting new message:', messageData);
      socket.emit('new message', messageData);
    }
  }, [socket, isConnected]);

  const markAsSeen = useCallback((msgByUserId) => {
    if (socket && isConnected) {
      console.log('[Socket] Emitting seen:', msgByUserId);
      socket.emit('seen', msgByUserId);
    }
  }, [socket, isConnected]);

  const loadGlobalMessages = useCallback(() => {
    if (socket && isConnected) {
      console.log('[Socket] Emitting global-message-page');
      socket.emit('global-message-page');
    }
  }, [socket, isConnected]);

  const sendGlobalMessage = useCallback((messageData) => {
    if (socket && isConnected) {
      console.log('[Socket] Emitting new global message:', messageData);
      socket.emit('new global message', messageData);
    }
  }, [socket, isConnected]);

  const setSelectedUser = useCallback((user) => {
  dispatch({ type: "SET_SELECTED_USER", payload: user });
  }, []);

  const value = {
    ...state,
    loadConversations,
    loadMessages,
    sendMessage,
    markAsSeen,
    loadGlobalMessages,
    sendGlobalMessage,
    setSelectedUser,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
