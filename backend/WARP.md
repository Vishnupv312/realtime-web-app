# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Core Commands

### Development
```bash
# Start development server with auto-reload
npm run dev

# Start development server in cluster mode
npm run dev:cluster

# Start production server (single instance)
npm start
```

### Production Deployment
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2 (single instance)
pm2 start ecosystem.config.js --env production

# Start with PM2 (cluster mode - recommended)
pm2 start ecosystem.config.js --only realtime-chat-prod

# Monitor application
pm2 status
pm2 logs realtime-chat-prod
pm2 monit
```

### Testing & Debugging
```bash
# Health check
curl http://localhost:3001/health

# Socket.IO stats
curl http://localhost:3001/api/socket/stats

# View logs
tail -f logs/combined.log
tail -f logs/error.log

# Debug mode
DEBUG=* npm run dev
```

## Architecture Overview

This is a **stateless real-time chat backend** designed for horizontal scaling with the following key architectural patterns:

### Core Technologies
- **Node.js + Express** for HTTP API
- **Socket.IO** for WebSocket real-time communication
- **MongoDB + Mongoose** for user data and authentication
- **Redis** (optional) for scaling Socket.IO across multiple instances
- **JWT** for stateless authentication

### Stateless Design Philosophy
- **No message persistence** - messages exist only during active chat sessions
- **User matching system** - random pairing of available users
- **Session-based chat** - chat history is cleared when users disconnect
- **File uploads** with automatic cleanup (24-hour retention)

### Scaling Architecture
- **Horizontal scaling** via Redis adapter for Socket.IO
- **Load balancing** ready with sticky sessions
- **Clustering** support via PM2
- **Stateless design** enables easy multi-instance deployment

### Security Model
- **Rate limiting** at multiple levels (auth: 5/15min, API: 100/15min, uploads: 10/hour)
- **Input sanitization** against NoSQL injection
- **JWT authentication** for both HTTP and WebSocket
- **CORS protection** with environment-specific origins
- **Helmet.js** security headers

## Key Components

### Socket.IO Event System
**Location**: `src/socket/`
- Real-time user matching (`user:match`)
- Chat messaging (`chat:message`, `chat:clear`)  
- WebRTC signaling (`webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`)
- Typing indicators (`chat:typing:start/stop`)
- User presence tracking

### User Management
**Location**: `src/models/User.js`, `src/controllers/userController.js`
- **User states**: online/offline, searching, connected
- **Device tracking** for multi-device support
- **Location tracking** via IP geolocation
- **Connection pairing** for 1-on-1 chats

### File Upload System
**Location**: `src/middleware/upload.js`, `src/routes/fileRoutes.js`
- **Temporary storage** (24-hour cleanup)
- **Multi-format support** (images, videos, audio, documents)
- **Voice notes** with duration limits (5 minutes max)
- **Size limits** (10MB max per file)

### Authentication Flow
**Location**: `src/middleware/auth.js`, `src/controllers/authController.js`
- **JWT-based** stateless authentication
- **Dual authentication** for HTTP routes and Socket.IO
- **Device ID tracking** for session management

## Development Patterns

### Error Handling
- Graceful degradation when database is unavailable
- Winston logging with structured log levels
- Comprehensive error boundaries in Socket.IO handlers

### Environment Configuration
- Development vs production CORS policies
- Redis adapter auto-detection based on NODE_ENV
- PM2 ecosystem configurations for different deployment modes

### Code Organization
```
src/
├── config/         # Database and configuration
├── controllers/    # Business logic for HTTP routes
├── middleware/     # Authentication, security, validation
├── models/         # Mongoose schemas
├── routes/         # Express route definitions  
├── socket/         # Socket.IO server and event handlers
├── utils/          # JWT utilities, file storage helpers
├── cluster.js      # Multi-core clustering setup
└── server.js       # Main application entry point
```

### Socket.IO Connection Pattern
1. **Authentication** via JWT in handshake
2. **User registration** in active connections map
3. **Event routing** based on connection state
4. **Cleanup** on disconnection

### File Upload Pattern
1. **Multer middleware** for multipart handling
2. **Validation** of file type, size, duration
3. **Temporary storage** with unique filenames
4. **Cleanup job** runs hourly to remove old files

## Environment Requirements

### Required Variables
```env
PORT=3001
NODE_ENV=development|production
MONGODB_URI=mongodb://localhost:27017/realtime_chat
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
```

### Optional Variables
```env
REDIS_URL=redis://localhost:6379  # Required for scaling
MAX_FILE_SIZE=10485760           # 10MB default
MAX_VOICE_DURATION=300           # 5 minutes default
```

### Infrastructure Dependencies
- **MongoDB 4.4+** (required)
- **Redis** (optional, for scaling)
- **Node.js 16+** (required)

## Testing Endpoints

### Authentication Test
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Password123"}'
```

### Socket.IO Connection Test
Use Socket.IO client library with JWT token in auth configuration.

## Production Considerations

### Scaling Setup
1. Deploy Redis for multi-instance Socket.IO
2. Use `pm2 start ecosystem.config.js --only realtime-chat-prod` 
3. Configure Nginx for load balancing with sticky sessions
4. Monitor with PM2's health checks

### Security Checklist
- Use HTTPS in production
- Set strong JWT_SECRET
- Configure production CORS origins
- Enable Redis AUTH if using Redis
- Set up fail2ban for additional protection

### Monitoring
- Application logs in `logs/` directory
- PM2 process monitoring
- Health check endpoint at `/health`
- Socket.IO statistics at `/api/socket/stats`