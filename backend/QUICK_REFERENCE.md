# Quick Reference - API & Socket.IO Events

## 🌐 Backend Configuration
- **URL:** `http://localhost:3005` (Development)
- **Socket.IO:** Same URL with authentication token

---

## 🔐 REST API Endpoints

### Authentication
```
POST /api/auth/register    - Register new user
POST /api/auth/login       - Login user  
GET  /api/auth/me          - Get current user (requires JWT)
```

### Users
```
GET  /api/users/online     - Get online users (requires JWT)
GET  /api/users/available  - Get available users for matching (requires JWT)  
POST /api/users/device     - Update device info (requires JWT)
GET  /api/users/stats      - Get user statistics (requires JWT)
```

### System
```
GET  /health               - Health check
GET  /api/socket/stats     - Socket.IO statistics (requires JWT)
```

---

## 🔌 Socket.IO Events

### Connection
```javascript
// Connect with JWT token
const socket = io('http://localhost:3005', {
  auth: { token: 'your-jwt-token' }
});

// Listen for connection established
socket.on('connection:established', (data) => {
  // data: { userId, username, socketId }
});
```

### User Matching
```javascript
// Request random user match
socket.emit('user:match');

// Listen for match responses
socket.on('user:matched', (data) => {
  // data: { matchedUser: { id, username, deviceId, location, ip } }
});

socket.on('user:match:no_users', (data) => {
  // No users available
});

socket.on('user:match:error', (data) => {
  // Matching failed
});
```

### Real-time Chat
```javascript
// Send message
socket.emit('chat:message', {
  type: 'text',        // 'text' | 'file' | 'voice'
  content: 'Hello!',   // string or file object
  timestamp: new Date().toISOString()
});

// Receive messages
socket.on('chat:message', (message) => {
  // message: { id, senderId, senderUsername, type, content, timestamp }
});

// Clear chat
socket.emit('chat:clear');

// Chat cleared by other user
socket.on('chat:cleared', (data) => {
  // data: { userId, username, reason }
});
```

### WebRTC Signaling
```javascript
// Send WebRTC offer
socket.emit('webrtc:offer', {
  offer: sessionDescription,
  type: 'video'  // 'audio' | 'video'
});

// Send WebRTC answer
socket.emit('webrtc:answer', {
  answer: sessionDescription
});

// Send ICE candidate
socket.emit('webrtc:ice-candidate', {
  candidate: iceCandidate
});

// Receive WebRTC events
socket.on('webrtc:offer', (data) => {
  // data: { offer, type, from, fromUsername }
});

socket.on('webrtc:answer', (data) => {
  // data: { answer, from, fromUsername }
});

socket.on('webrtc:ice-candidate', (data) => {
  // data: { candidate, from }
});
```

### Typing Indicators
```javascript
// Send typing status
socket.emit('chat:typing:start');
socket.emit('chat:typing:stop');

// Receive typing status
socket.on('chat:typing:start', (data) => {
  // data: { userId, username }
});

socket.on('chat:typing:stop', (data) => {
  // data: { userId, username }
});
```

### User Presence
```javascript
// User online/offline events
socket.on('user:online', (data) => {
  // data: { userId, username, deviceId, location }
});

socket.on('user:offline', (data) => {
  // data: { userId, username }
});

socket.on('user:disconnected', (data) => {
  // data: { userId, username, reason }
});
```

---

## 📊 Data Formats

### User Object
```javascript
{
  id: "507f1f77bcf86cd799439011",
  username: "john_doe",
  email: "john@example.com",
  isOnline: true,
  lastSeen: "2023-01-01T00:00:00.000Z",
  deviceId: "unique-device-id",
  ip: "192.168.1.1",
  location: {
    country: "US",
    region: "CA", 
    city: "San Francisco",
    timezone: "America/Los_Angeles"
  },
  connectedUser: null
}
```

### Message Object
```javascript
{
  id: "msg_1234567890_abc123",
  senderId: "507f1f77bcf86cd799439012",
  senderUsername: "jane_doe",
  type: "text",  // 'text' | 'file' | 'voice'
  content: "Hello world!",  // string or file object
  timestamp: "2023-01-01T00:00:00.000Z",
  status: "sent"  // 'sending' | 'sent'
}
```

### File Object
```javascript
{
  filename: "document.pdf",
  originalName: "My Document.pdf", 
  fileType: "document",
  fileSize: 2048576,
  fileUrl: "/uploads/documents/unique-filename.pdf"
}
```

### Voice Note Object
```javascript
{
  filename: "voice-note.mp3",
  duration: 45,  // seconds
  fileSize: 1024000,
  fileUrl: "/uploads/audio/unique-filename.mp3"
}
```

---

## 🔒 Authentication Headers
```javascript
// Add to all API requests (except register/login)
headers: {
  'Authorization': 'Bearer your-jwt-token',
  'Content-Type': 'application/json'
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

### Error Response Format
```javascript
{
  success: false,
  message: "Error description",
  errors: [
    { field: "email", message: "Email already exists" }
  ]
}
```

---

## 💾 Local Storage Keys
```javascript
'authToken'     - JWT token
'currentUser'   - User data object
'deviceId'      - Unique device identifier  
'chat_{userId}_{connectedUserId}' - Chat history
```

---

## 📝 Rate Limits
- **Auth endpoints:** 5 requests / 15 minutes
- **API endpoints:** 100 requests / 15 minutes  
- **File uploads:** 10 uploads / hour
- **Socket events:** 100 events / minute

---

## 🚀 Frontend Dependencies
```bash
npm install socket.io-client axios js-cookie uuid
```

## 📋 Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:3005
NEXT_PUBLIC_SOCKET_URL=http://localhost:3005
```