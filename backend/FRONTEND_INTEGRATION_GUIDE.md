# Frontend Integration Guide for Next.js

## 🚀 Quick Start Setup

### 1. Install Required Dependencies
```bash
npm install socket.io-client axios js-cookie uuid @types/uuid
npm install -D @types/js-cookie
```

### 2. Environment Configuration
Create `.env.local` in your Next.js project:
```env
NEXT_PUBLIC_API_URL=http://localhost:3005
NEXT_PUBLIC_SOCKET_URL=http://localhost:3005
```

---

## 🔧 Core Services Setup

### API Service (`lib/api.js`)
```javascript
import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = Cookies.get('authToken') || localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      Cookies.remove('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
  getMe: () => api.get('/api/auth/me'),
};

// User API calls
export const userAPI = {
  getOnlineUsers: () => api.get('/api/users/online'),
  getAvailableUsers: () => api.get('/api/users/available'),
  updateDevice: (deviceData) => api.post('/api/users/device', deviceData),
  getStats: () => api.get('/api/users/stats'),
};

// File upload API
export const fileAPI = {
  uploadFile: (formData) => api.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadVoice: (formData) => api.post('/api/files/voice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export default api;
```

### Socket Service (`lib/socket.js`)
```javascript
import { io } from 'socket.io-client';
import Cookies from 'js-cookie';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3005';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    const token = Cookies.get('authToken') || localStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      this.isConnected = false;
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // User matching
  requestMatch() {
    this.socket?.emit('user:match');
  }

  // Chat methods
  sendMessage(message) {
    this.socket?.emit('chat:message', message);
  }

  clearChat() {
    this.socket?.emit('chat:clear');
  }

  // WebRTC methods
  sendOffer(offer, type) {
    this.socket?.emit('webrtc:offer', { offer, type });
  }

  sendAnswer(answer) {
    this.socket?.emit('webrtc:answer', { answer });
  }

  sendIceCandidate(candidate) {
    this.socket?.emit('webrtc:ice-candidate', { candidate });
  }

  // Typing indicators
  startTyping() {
    this.socket?.emit('chat:typing:start');
  }

  stopTyping() {
    this.socket?.emit('chat:typing:stop');
  }

  // Event listeners
  on(event, callback) {
    this.socket?.on(event, callback);
  }

  off(event, callback) {
    this.socket?.off(event, callback);
  }
}

const socketService = new SocketService();
export default socketService;
```

---

## 🔐 Authentication Context (`contexts/AuthContext.js`)

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';
import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
    generateDeviceId();
  }, []);

  const generateDeviceId = () => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  };

  const checkAuth = async () => {
    try {
      const token = Cookies.get('authToken') || localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authAPI.getMe();
      setUser(response.data.data.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data.data;

      // Store token and user data
      Cookies.set('authToken', token, { expires: 7 });
      localStorage.setItem('authToken', token);
      localStorage.setItem('currentUser', JSON.stringify(user));

      setUser(user);
      setIsAuthenticated(true);

      // Update device info
      const deviceId = generateDeviceId();
      await updateDeviceInfo(deviceId);

      return { success: true, user };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await authAPI.register({ username, email, password });
      const { token, user } = response.data.data;

      // Store token and user data
      Cookies.set('authToken', token, { expires: 7 });
      localStorage.setItem('authToken', token);
      localStorage.setItem('currentUser', JSON.stringify(user));

      setUser(user);
      setIsAuthenticated(true);

      // Update device info
      const deviceId = generateDeviceId();
      await updateDeviceInfo(deviceId);

      return { success: true, user };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
      };
    }
  };

  const logout = () => {
    Cookies.remove('authToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateDeviceInfo = async (deviceId) => {
    try {
      await userAPI.updateDevice({ deviceId });
    } catch (error) {
      console.error('Failed to update device info:', error);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

---

## 🎯 Chat Context (`contexts/ChatContext.js`)

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import socketService from '../lib/socket';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUser, setConnectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, user]);

  const connectSocket = () => {
    try {
      socketService.connect();
      setupSocketListeners();
    } catch (error) {
      console.error('Failed to connect socket:', error);
    }
  };

  const setupSocketListeners = () => {
    // Connection events
    socketService.on('connection:established', (data) => {
      console.log('Socket connected:', data);
      setIsConnected(true);
    });

    // User matching events
    socketService.on('user:matched', (data) => {
      console.log('Matched with user:', data.matchedUser);
      setConnectedUser(data.matchedUser);
      setIsMatching(false);
      clearChatHistory();
    });

    socketService.on('user:match:no_users', (data) => {
      console.log('No users available:', data.message);
      setIsMatching(false);
    });

    socketService.on('user:match:error', (data) => {
      console.error('Matching error:', data.message);
      setIsMatching(false);
    });

    // Chat events
    socketService.on('chat:message', (message) => {
      console.log('New message:', message);
      addMessage(message);
    });

    socketService.on('chat:message:sent', (data) => {
      console.log('Message sent:', data);
      updateMessageStatus(data.messageId, 'sent');
    });

    socketService.on('chat:cleared', (data) => {
      console.log('Chat cleared by other user:', data);
      clearChatHistory();
      setConnectedUser(null);
    });

    socketService.on('user:disconnected', (data) => {
      console.log('User disconnected:', data);
      setConnectedUser(null);
      clearChatHistory();
    });

    // Typing events
    socketService.on('chat:typing:start', (data) => {
      console.log('User started typing:', data);
      setIsTyping(true);
    });

    socketService.on('chat:typing:stop', (data) => {
      console.log('User stopped typing:', data);
      setIsTyping(false);
    });

    // Error events
    socketService.on('chat:error', (error) => {
      console.error('Chat error:', error.message);
    });
  };

  const requestMatch = () => {
    setIsMatching(true);
    socketService.requestMatch();
  };

  const sendMessage = (content, type = 'text') => {
    const message = {
      type,
      content,
      timestamp: new Date().toISOString(),
      id: `temp_${Date.now()}`,
      senderId: user.id,
      senderUsername: user.username,
      status: 'sending'
    };

    addMessage(message);
    socketService.sendMessage(message);
  };

  const clearChat = () => {
    socketService.clearChat();
    clearChatHistory();
    setConnectedUser(null);
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
    saveChatHistory(message);
  };

  const updateMessageStatus = (messageId, status) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      )
    );
  };

  const clearChatHistory = () => {
    setMessages([]);
    if (user && connectedUser) {
      const chatKey = `chat_${user.id}_${connectedUser.id}`;
      localStorage.removeItem(chatKey);
    }
  };

  const saveChatHistory = (message) => {
    if (user && connectedUser) {
      const chatKey = `chat_${user.id}_${connectedUser.id}`;
      const existingMessages = JSON.parse(localStorage.getItem(chatKey) || '[]');
      existingMessages.push(message);
      localStorage.setItem(chatKey, JSON.stringify(existingMessages));
    }
  };

  const loadChatHistory = () => {
    if (user && connectedUser) {
      const chatKey = `chat_${user.id}_${connectedUser.id}`;
      const messages = JSON.parse(localStorage.getItem(chatKey) || '[]');
      setMessages(messages);
    }
  };

  const value = {
    isConnected,
    connectedUser,
    messages,
    isTyping,
    isMatching,
    requestMatch,
    sendMessage,
    clearChat,
    startTyping: () => socketService.startTyping(),
    stopTyping: () => socketService.stopTyping(),
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
```

---

## 🎥 WebRTC Hook (`hooks/useWebRTC.js`)

```javascript
import { useState, useEffect, useRef } from 'react';
import socketService from '../lib/socket';

const useWebRTC = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callType, setCallType] = useState(null); // 'audio' or 'video'
  const [incomingCallData, setIncomingCallData] = useState(null);

  const peerConnection = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    setupSocketListeners();
    return () => {
      cleanup();
    };
  }, []);

  const setupSocketListeners = () => {
    socketService.on('webrtc:offer', handleReceiveOffer);
    socketService.on('webrtc:answer', handleReceiveAnswer);
    socketService.on('webrtc:ice-candidate', handleReceiveIceCandidate);
  };

  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection(servers);

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(event.candidate);
      }
    };

    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return peerConnection.current;
  };

  const startCall = async (type = 'video') => {
    try {
      setCallType(type);
      const constraints = {
        video: type === 'video',
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketService.sendOffer(offer, type);
      setIsCallActive(true);
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const acceptCall = async () => {
    try {
      const constraints = {
        video: incomingCallData?.type === 'video',
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(incomingCallData.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.sendAnswer(answer);

      setIsCallActive(true);
      setIsIncomingCall(false);
      setCallType(incomingCallData.type);
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const rejectCall = () => {
    setIsIncomingCall(false);
    setIncomingCallData(null);
    cleanup();
  };

  const endCall = () => {
    setIsCallActive(false);
    cleanup();
  };

  const handleReceiveOffer = async (data) => {
    setIsIncomingCall(true);
    setIncomingCallData(data);
  };

  const handleReceiveAnswer = async (data) => {
    try {
      await peerConnection.current.setRemoteDescription(data.answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleReceiveIceCandidate = async (data) => {
    try {
      await peerConnection.current.addIceCandidate(data.candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setRemoteStream(null);
    setIsCallActive(false);
    setIsIncomingCall(false);
    setIncomingCallData(null);
    setCallType(null);
  };

  return {
    localStream,
    remoteStream,
    isCallActive,
    isIncomingCall,
    callType,
    incomingCallData,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
};

export default useWebRTC;
```

---

## 📱 Main App Structure

### App Component (`pages/_app.js`)
```javascript
import { AuthProvider } from '../contexts/AuthContext';
import { ChatProvider } from '../contexts/ChatContext';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ChatProvider>
        <Component {...pageProps} />
      </ChatProvider>
    </AuthProvider>
  );
}

export default MyApp;
```

### Protected Route Component (`components/ProtectedRoute.js`)
```javascript
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
};

export default ProtectedRoute;
```

---

## 🎨 Example Pages

### Login Page (`pages/login.js`)
```javascript
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (result.success) {
      router.push('/chat');
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        
        {error && <div className="text-red-500 mb-4">{error}</div>}
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded mb-4"
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 border rounded mb-6"
          required
        />
        
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-3 rounded"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
```

### Chat Page (`pages/chat.js`)
```javascript
import ProtectedRoute from '../components/ProtectedRoute';
import ChatInterface from '../components/ChatInterface';

const ChatPage = () => {
  return (
    <ProtectedRoute>
      <ChatInterface />
    </ProtectedRoute>
  );
};

export default ChatPage;
```

This comprehensive integration guide provides everything needed to build the frontend with Next.js, including authentication, real-time chat, WebRTC calling, and proper state management.