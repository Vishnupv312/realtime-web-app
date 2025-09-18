# API Documentation for Frontend Integration

## 🌐 Base Configuration

### Backend Server

- **Base URL:** `http://localhost:3005` (Development)
- **Production URL:** `https://your-domain.com` (Replace with your domain)
- **WebSocket URL:** Same as base URL for Socket.IO

### Required Frontend Dependencies

```bash
npm install socket.io-client axios js-cookie uuid
```

---

## 🔐 Authentication APIs

### 1. User Registration

```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Password123"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "isOnline": false,
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Response (400/409):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email already registered"
    }
  ]
}
```

### 2. User Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "isOnline": false,
      "lastSeen": "2023-01-01T00:00:00.000Z",
      "deviceId": "unique-device-id"
    }
  }
}
```

### 3. Get Current User

```http
GET /api/auth/me
Authorization: Bearer {jwt_token}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "isOnline": true,
      "lastSeen": "2023-01-01T00:00:00.000Z",
      "deviceId": "unique-device-id",
      "ip": "192.168.1.1",
      "location": {
        "country": "US",
        "region": "CA",
        "city": "San Francisco",
        "timezone": "America/Los_Angeles"
      },
      "connectedUser": null,
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

---

## 👥 User Management APIs

### 1. Get Online Users

```http
GET /api/users/online
Authorization: Bearer {jwt_token}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "onlineUsers": [
      {
        "id": "507f1f77bcf86cd799439012",
        "username": "jane_doe",
        "email": "jane@example.com",
        "isOnline": true,
        "lastSeen": "2023-01-01T00:00:00.000Z",
        "deviceId": "another-device-id",
        "location": {
          "country": "US",
          "city": "New York"
        },
        "connectedUser": null
      }
    ],
    "count": 1
  }
}
```

### 2. Get Available Users for Matching

```http
GET /api/users/available
Authorization: Bearer {jwt_token}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "availableUsers": [
      {
        "id": "507f1f77bcf86cd799439012",
        "username": "jane_doe",
        "isOnline": true,
        "lastSeen": "2023-01-01T00:00:00.000Z",
        "deviceId": "another-device-id"
      }
    ],
    "count": 1
  }
}
```

### 3. Update Device Information

```http
POST /api/users/device
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "deviceId": "unique-device-identifier"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Device information updated successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "deviceId": "unique-device-identifier",
      "ip": "192.168.1.1",
      "location": {
        "country": "US",
        "city": "San Francisco"
      },
      "lastSeen": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### 4. Get User Statistics

```http
GET /api/users/stats
Authorization: Bearer {jwt_token}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalUsers": 150,
      "onlineUsers": 25,
      "availableUsers": 18,
      "connectedUsers": 7
    }
  }
}
```

---

## 🔌 Socket.IO Integration

### Connection Setup

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:3005", {
  auth: {
    token: "your-jwt-token",
  },
  transports: ["websocket", "polling"],
});
```

### Connection Events

#### Connection Established

```javascript
socket.on("connection:established", (data) => {
  console.log("Connected to server:", data);
  // data: { userId, username, socketId }
});
```

#### Connection Errors

```javascript
socket.on("connect_error", (error) => {
  console.error("Connection failed:", error.message);
  // Handle authentication errors
});
```

---

## 👤 User Presence Events

### User Online/Offline

```javascript
// Listen for users coming online
socket.on("user:online", (data) => {
  console.log("User came online:", data);
  // data: { userId, username, deviceId, location }
});

// Listen for users going offline
socket.on("user:offline", (data) => {
  console.log("User went offline:", data);
  // data: { userId, username }
});
```

### User Disconnected from Chat

```javascript
socket.on("user:disconnected", (data) => {
  console.log("User disconnected from chat:", data);
  // data: { userId, username, reason }
  // Clear current chat and show disconnect message
});
```

---

## 🎯 User Matching System

### Request Random Match

```javascript
socket.emit("user:match");
```

### Match Response Events

```javascript
// Successful match
socket.on("user:matched", (data) => {
  console.log("Matched with user:", data.matchedUser);
  // data: {
  //   matchedUser: {
  //     id, username, deviceId, location, ip
  //   }
  // }
  // Initialize chat interface
  // Clear previous chat history
});

// No users available
socket.on("user:match:no_users", (data) => {
  console.log("No users available:", data.message);
  // Show "waiting for users" message
});

// Match error
socket.on("user:match:error", (data) => {
  console.error("Matching failed:", data.message);
  // Show error message
});
```

---

## 💬 Real-time Chat System

### Send Messages

```javascript
// Send text message
socket.emit("chat:message", {
  type: "text",
  content: "Hello, how are you?",
  timestamp: new Date().toISOString(),
});

// Send file
socket.emit("chat:message", {
  type: "file",
  content: {
    filename: "document.pdf",
    fileType: "document",
    fileSize: 2048576,
    fileUrl: "/uploads/documents/unique-filename.pdf",
  },
  timestamp: new Date().toISOString(),
});

// Send voice note
socket.emit("chat:message", {
  type: "voice",
  content: {
    filename: "voice-note.mp3",
    duration: 45, // seconds
    fileSize: 1024000,
    fileUrl: "/uploads/audio/unique-filename.mp3",
  },
  timestamp: new Date().toISOString(),
});
```

### Receive Messages

```javascript
socket.on("chat:message", (message) => {
  console.log("New message received:", message);
  // message: {
  //   id: 'msg_1234567890_abc123',
  //   senderId: '507f1f77bcf86cd799439012',
  //   senderUsername: 'jane_doe',
  //   type: 'text' | 'file' | 'voice',
  //   content: 'message content or file object',
  //   timestamp: '2023-01-01T00:00:00.000Z'
  // }

  // Add message to chat history
  // Update UI
});

// Message sent confirmation
socket.on("chat:message:sent", (data) => {
  console.log("Message sent successfully:", data);
  // data: { messageId, timestamp }
  // Update message status to "sent"
});
```

### Chat Management

```javascript
// Clear current chat
socket.emit("chat:clear");

// Chat cleared confirmation
socket.on("chat:clear:confirmed", (data) => {
  console.log("Chat cleared:", data.message);
  // Clear chat history from local storage
  // Reset chat interface
});

// Chat cleared by other user
socket.on("chat:cleared", (data) => {
  console.log("Chat was cleared:", data);
  // data: { userId, username, reason }
  // Clear chat history and show message
});
```

### Chat Errors

```javascript
socket.on("chat:error", (error) => {
  console.error("Chat error:", error.message);
  // Show error message to user
});
```

---

## 🎥 WebRTC Signaling

### Send WebRTC Offer

```javascript
socket.emit("webrtc:offer", {
  offer: rtcSessionDescription,
  type: "video", // or 'audio'
});
```

### Send WebRTC Answer

```javascript
socket.emit("webrtc:answer", {
  answer: rtcSessionDescription,
});
```

### Send ICE Candidate

```javascript
socket.emit("webrtc:ice-candidate", {
  candidate: rtcIceCandidate,
});
```

### Receive WebRTC Events

```javascript
// Receive offer
socket.on("webrtc:offer", (data) => {
  console.log("Received WebRTC offer:", data);
  // data: { offer, type, from, fromUsername }
  // Handle incoming call
});

// Receive answer
socket.on("webrtc:answer", (data) => {
  console.log("Received WebRTC answer:", data);
  // data: { answer, from, fromUsername }
  // Complete WebRTC connection
});

// Receive ICE candidate
socket.on("webrtc:ice-candidate", (data) => {
  console.log("Received ICE candidate:", data);
  // data: { candidate, from }
  // Add ICE candidate to peer connection
});

// WebRTC errors
socket.on("webrtc:error", (error) => {
  console.error("WebRTC error:", error.message);
  // Handle WebRTC errors
});
```

---

## ⌨️ Typing Indicators

### Send Typing Status

```javascript
// User started typing
socket.emit("chat:typing:start");

// User stopped typing
socket.emit("chat:typing:stop");
```

### Receive Typing Status

```javascript
// Other user started typing
socket.on("chat:typing:start", (data) => {
  console.log("User is typing:", data);
  // data: { userId, username }
  // Show typing indicator
});

// Other user stopped typing
socket.on("chat:typing:stop", (data) => {
  console.log("User stopped typing:", data);
  // data: { userId, username }
  // Hide typing indicator
});
```

---

## 📁 File Upload API

### Upload File

```http
POST /api/files/upload
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data
```

**Form Data:**

- `file`: File to upload (max 10MB)
- `type`: File type ('image', 'video', 'audio', 'document')

**Success Response (200):**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "filename": "unique-filename.pdf",
    "originalName": "document.pdf",
    "fileType": "document",
    "fileSize": 2048576,
    "fileUrl": "/uploads/documents/unique-filename.pdf",
    "uploadedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

---

## 🎵 Voice Note Upload

### Upload Voice Note

```http
POST /api/files/voice
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data
```

**Form Data:**

- `file`: Audio file (max 10MB, max 5 minutes)
- `duration`: Duration in seconds

**Success Response (200):**

```json
{
  "success": true,
  "message": "Voice note uploaded successfully",
  "data": {
    "filename": "unique-filename.mp3",
    "duration": 45,
    "fileSize": 1024000,
    "fileUrl": "/uploads/audio/unique-filename.mp3",
    "uploadedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

---

## 🏥 Health Check & Monitoring

### Server Health

```http
GET /health
```

**Response:**

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Socket.IO Statistics

```http
GET /api/socket/stats
Authorization: Bearer {jwt_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "connectedSockets": 25,
    "rooms": 12,
    "namespace": "/"
  }
}
```

---

## ⚠️ Error Handling

### Common HTTP Status Codes

- `200` - Success
- `201` - Created (registration)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `413` - Payload Too Large (file too big)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific error"
    }
  ]
}
```

---

## 🔒 Security & Rate Limits

### Rate Limits

- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **General API endpoints:** 100 requests per 15 minutes per IP
- **File upload endpoints:** 10 uploads per hour per IP
- **Socket.IO events:** 100 events per minute per user

### Security Headers

All responses include security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 💾 Client-Side Storage

### Required Local Storage Keys

```javascript
// JWT token storage
localStorage.setItem("authToken", token);
localStorage.getItem("authToken");

// User data
localStorage.setItem("currentUser", JSON.stringify(user));

// Chat history (per conversation)
const chatKey = `chat_${currentUserId}_${connectedUserId}`;
localStorage.setItem(chatKey, JSON.stringify(messages));

// Device ID
localStorage.setItem("deviceId", deviceId);
```

### Chat History Management

```javascript
// Clear chat history when starting new conversation
const clearChatHistory = (userId, connectedUserId) => {
  const chatKey = `chat_${userId}_${connectedUserId}`;
  localStorage.removeItem(chatKey);
};

// Save message to local storage
const saveMessage = (userId, connectedUserId, message) => {
  const chatKey = `chat_${userId}_${connectedUserId}`;
  const messages = JSON.parse(localStorage.getItem(chatKey) || "[]");
  messages.push(message);
  localStorage.setItem(chatKey, JSON.stringify(messages));
};
```

This comprehensive API documentation covers all endpoints and Socket.IO events needed for frontend integration with Next.js.
