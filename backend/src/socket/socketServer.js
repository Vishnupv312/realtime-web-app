const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');
const { authenticateSocket } = require('../middleware/auth');
const { createSocketHandlers, userSockets } = require('./socketHandlers');
const { logger } = require('../config/database');

function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const handlers = createSocketHandlers(io);

  async function setupRedisAdapter() {
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
      try {
        const pubClient = redis.createClient({ 
          url: process.env.REDIS_URL,
          socket: {
            reconnectDelay: 50,
            reconnectDelayMax: 500,
            maxRetriesPerRequest: 3
          }
        });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter initialized');
        pubClient.on('error', (err) => logger.error('Redis pub client error:', err));
        subClient.on('error', (err) => logger.error('Redis sub client error:', err));
      } catch (error) {
        logger.error('Failed to initialize Redis adapter:', error);
        logger.warn('Continuing without Redis adapter - single instance mode');
      }
    } else {
      logger.info('Socket.IO running in single instance mode (no Redis)');
    }
  }

  function setupMiddleware() {
    io.use(authenticateSocket);

    // Rate limiting middleware (basic implementation)
    const rateLimiter = new Map();
    io.use((socket, next) => {
      const userId = socket.userId;
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 100; // max 100 events per minute per user

      if (!rateLimiter.has(userId)) {
        rateLimiter.set(userId, { count: 1, resetTime: now + windowMs });
        return next();
      }

      const userLimit = rateLimiter.get(userId);
      if (now > userLimit.resetTime) {
        userLimit.count = 1;
        userLimit.resetTime = now + windowMs;
        return next();
      }
      if (userLimit.count >= maxRequests) {
        return next(new Error('Rate limit exceeded'));
      }
      userLimit.count++;
      next();
    });

    logger.info('Socket.IO middleware configured');
  }

  function setupEventHandlers() {
    io.on('connection', (socket) => {
      logger.info(`New socket connection: ${socket.id} for user: ${socket.user.username}`);

      // Handle initial connection
      handlers.handleConnection(socket);

      // User presence events
      socket.on('user:match', (data) => handlers.handleUserMatch(socket, data));
      socket.on('user:match:cancel', (data) => handlers.handleCancelMatch(socket, data));

      // Chat events
      socket.on('chat:message', (data) => handlers.handleChatMessage(socket, data));
      socket.on('chat:clear', () => handlers.handleChatClear(socket));

      // WebRTC signaling events
      socket.on('webrtc:offer', (data) => handlers.handleWebRTCOffer(socket, data));
      socket.on('webrtc:answer', (data) => handlers.handleWebRTCAnswer(socket, data));
      socket.on('webrtc:ice-candidate', (data) => handlers.handleICECandidate(socket, data));
      socket.on('webrtc:call-end', (data) => handlers.handleWebRTCCallEnd(socket, data));
      socket.on('webrtc:call-reject', (data) => handlers.handleWebRTCCallReject(socket, data));

      // Handle typing indicators
      socket.on('chat:typing:start', () => handleTypingStart(socket));
      socket.on('chat:typing:stop', () => handleTypingStop(socket));

      // Handle room lifecycle events
      socket.on('leave-room', () => handlers.handleLeaveRoom(socket));
      socket.on('close-room', () => handlers.handleCloseRoom(socket));

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        handlers.handleDisconnection(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    io.on('connect_error', (error) => {
      logger.error('Socket.IO connection error:', error);
    });

    logger.info('Socket.IO event handlers registered');
  }

  async function handleTypingStart(socket) {
    try {
      const user = socket.user;
      if (!user.connectedUser) return;
      const connectedUserSocketId = userSockets?.get(user.connectedUser.toString());
      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('chat:typing:start', {
          userId: user._id,
          username: user.username
        });
      }
    } catch (error) {
      logger.error('Typing start error:', error);
    }
  }

  async function handleTypingStop(socket) {
    try {
      const user = socket.user;
      if (!user.connectedUser) return;
      const connectedUserSocketId = userSockets?.get(user.connectedUser.toString());
      if (connectedUserSocketId) {
        io.to(connectedUserSocketId).emit('chat:typing:stop', {
          userId: user._id,
          username: user.username
        });
      }
    } catch (error) {
      logger.error('Typing stop error:', error);
    }
  }

  function getStats() {
    return {
      connectedSockets: io.sockets.sockets.size,
      rooms: io.sockets.adapter.rooms.size,
      namespace: io.name
    };
  }

  function broadcast(event, data) {
    io.emit(event, data);
  }

  function sendToUser(userId, event, data) {
    const socketId = userSockets?.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // initialize
  setupRedisAdapter();
  setupMiddleware();
  setupEventHandlers();

  return { io, getStats, broadcast, sendToUser };
}

module.exports = { createSocketServer };
