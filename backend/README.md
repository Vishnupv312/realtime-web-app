# Realtime Chat Backend

A robust, scalable backend for real-time chat, audio, and video communication using Node.js, Express, MongoDB, WebRTC, and Socket.IO.

## 🚀 Features

### Core Features
- **Real-time messaging** with Socket.IO
- **WebRTC signaling** for audio/video calls
- **JWT-based authentication**
- **Random user matching**
- **File sharing** (up to 10MB)
- **Voice notes** (up to 5 minutes)
- **User presence tracking** (online/offline)
- **Device & location tracking**
- **Stateless chat system** (no message persistence)

### Technical Features
- **Horizontal scaling** with Redis adapter
- **Load balancing** support
- **Rate limiting** & security middleware
- **Input sanitization**
- **File upload validation**
- **Clustering support**
- **Health monitoring**
- **Comprehensive logging**

## 📋 Prerequisites

- Node.js (>= 16.0.0)
- MongoDB (>= 4.4)
- Redis (optional, for scaling)
- PM2 (for production deployment)
- Nginx (for reverse proxy)

## 🛠️ Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/realtime-chat-backend.git
cd realtime-chat-backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup environment variables:**
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:
```env
# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/realtime_chat

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Redis (for scaling)
REDIS_URL=redis://localhost:6379

# File Upload
MAX_FILE_SIZE=10485760
MAX_VOICE_DURATION=300
```

4. **Start MongoDB:**
```bash
# Using MongoDB service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

5. **Start the server:**
```bash
# Development
npm run dev

# Production
npm start

# Clustered mode
npm run dev:cluster
```

## 🔌 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "Password123"
}
```

**Response:**
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

#### Login User
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

#### Get Current User
```http
GET /api/auth/me
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

### User Endpoints

#### Get Online Users
```http
GET /api/users/online
```

#### Get Available Users for Matching
```http
GET /api/users/available
```

#### Update Device Information
```http
POST /api/users/device
```

**Request Body:**
```json
{
  "deviceId": "unique-device-identifier"
}
```

#### Get User Statistics
```http
GET /api/users/stats
```

## 🔌 Socket.IO Events

### Client to Server Events

#### Connection
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

#### User Matching
```javascript
socket.emit('user:match');
```

#### Send Chat Message
```javascript
socket.emit('chat:message', {
  type: 'text', // 'text', 'file', 'voice'
  content: 'Hello World!',
  timestamp: new Date().toISOString()
});
```

#### Clear Chat
```javascript
socket.emit('chat:clear');
```

#### WebRTC Signaling
```javascript
// Send offer
socket.emit('webrtc:offer', {
  offer: rtcSessionDescription,
  type: 'video' // 'audio' or 'video'
});

// Send answer
socket.emit('webrtc:answer', {
  answer: rtcSessionDescription
});

// Send ICE candidate
socket.emit('webrtc:ice-candidate', {
  candidate: rtcIceCandidate
});
```

### Server to Client Events

#### Connection Established
```javascript
socket.on('connection:established', (data) => {
  console.log('Connected:', data);
});
```

#### User Matched
```javascript
socket.on('user:matched', (data) => {
  console.log('Matched with user:', data.matchedUser);
});
```

#### Receive Message
```javascript
socket.on('chat:message', (message) => {
  console.log('New message:', message);
});
```

#### WebRTC Events
```javascript
socket.on('webrtc:offer', (data) => {
  // Handle incoming offer
});

socket.on('webrtc:answer', (data) => {
  // Handle incoming answer
});

socket.on('webrtc:ice-candidate', (data) => {
  // Handle ICE candidate
});
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js           # Database configuration
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   └── userController.js     # User management logic
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   ├── security.js          # Security & rate limiting
│   │   ├── upload.js            # File upload handling
│   │   └── validation.js        # Input validation
│   ├── models/
│   │   └── User.js              # User schema
│   ├── routes/
│   │   ├── auth.js              # Auth routes
│   │   └── users.js             # User routes
│   ├── socket/
│   │   ├── socketHandlers.js    # Socket event handlers
│   │   └── socketServer.js      # Socket.IO server setup
│   ├── utils/
│   │   └── jwt.js               # JWT utilities
│   ├── cluster.js               # Clustering configuration
│   └── server.js                # Main server file
├── logs/                        # Application logs
├── uploads/                     # Uploaded files
├── .env                        # Environment variables
├── .env.example                # Environment template
├── ecosystem.config.js         # PM2 configuration
├── nginx.conf                  # Nginx configuration
└── package.json                # Dependencies
```

## 🚀 Production Deployment

### Using PM2

1. **Install PM2 globally:**
```bash
npm install -g pm2
```

2. **Start application:**
```bash
# Single instance
pm2 start ecosystem.config.js --env production

# Clustered mode (recommended)
pm2 start ecosystem.config.js --only realtime-chat-prod
```

3. **Monitor application:**
```bash
pm2 status
pm2 logs
pm2 monit
```

### Using Docker

1. **Create Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

USER node

CMD ["npm", "start"]
```

2. **Build and run:**
```bash
docker build -t realtime-chat-backend .
docker run -p 3001:3001 --env-file .env realtime-chat-backend
```

### Using Nginx Reverse Proxy

1. **Copy nginx configuration:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/realtime-chat
sudo ln -s /etc/nginx/sites-available/realtime-chat /etc/nginx/sites-enabled/
```

2. **Update configuration with your domain and SSL certificates**

3. **Restart Nginx:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 Scaling & Performance

### Horizontal Scaling

1. **Setup Redis:**
```bash
# Install Redis
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
```

2. **Update environment variables:**
```env
REDIS_URL=redis://localhost:6379
NODE_ENV=production
```

3. **Run multiple instances:**
```bash
# Using PM2
pm2 start ecosystem.config.js --only realtime-chat-load-balanced

# Or manually
PORT=3001 npm start &
PORT=3002 npm start &
PORT=3003 npm start &
```

### Load Balancing with Nginx

Update the upstream block in `nginx.conf`:
```nginx
upstream realtime_chat_backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
    least_conn;
}
```

### Performance Monitoring

1. **Application metrics:**
```bash
# Check server stats
curl http://localhost:3001/api/socket/stats

# Health check
curl http://localhost:3001/health
```

2. **System monitoring:**
```bash
pm2 monit
htop
iostat
```

## 🔒 Security Features

### Built-in Security
- **Helmet.js** for security headers
- **Rate limiting** on all endpoints
- **Input sanitization** against NoSQL injection
- **CORS configuration**
- **JWT token validation**
- **File upload validation**
- **IP address tracking**

### Additional Recommendations
- Use HTTPS in production
- Implement API key authentication for admin endpoints
- Set up fail2ban for intrusion detection
- Use a Web Application Firewall (WAF)
- Regular security audits with `npm audit`

## 🧪 Testing

### Manual Testing

1. **Start the server:**
```bash
npm run dev
```

2. **Test endpoints:**
```bash
# Health check
curl http://localhost:3001/health

# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Password123"}'

# Test Socket.IO with a client library
```

### Load Testing

Use tools like Artillery or Apache Bench:
```bash
# Install Artillery
npm install -g artillery

# Create test script (artillery-config.yml)
artillery run artillery-config.yml
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Socket.IO Connection Issues:**
   - Check CORS configuration
   - Verify JWT token is valid
   - Check firewall settings

3. **File Upload Failures:**
   - Verify upload directory permissions
   - Check file size limits
   - Ensure multipart/form-data content type

4. **High Memory Usage:**
   - Monitor with `pm2 monit`
   - Adjust `max_memory_restart` in PM2 config
   - Check for memory leaks

### Logs & Debugging

```bash
# View application logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log

# PM2 logs
pm2 logs realtime-chat-prod

# Debug mode
DEBUG=* npm run dev
```

## 📝 API Rate Limits

- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **General API endpoints:** 100 requests per 15 minutes per IP
- **File upload endpoints:** 10 uploads per hour per IP
- **Socket.IO events:** 100 events per minute per user

## 🔄 Updates & Maintenance

### Updating Dependencies
```bash
# Check outdated packages
npm outdated

# Update packages
npm update

# Security audit
npm audit
npm audit fix
```

### Database Maintenance
```bash
# MongoDB index optimization
mongo realtime_chat --eval "db.users.getIndexes()"

# Clean up old data (if needed)
mongo realtime_chat --eval "db.users.deleteMany({lastSeen: {$lt: new Date(Date.now() - 30*24*60*60*1000)}})"
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact: your-email@example.com

---

**Made with ❤️ for real-time communication**