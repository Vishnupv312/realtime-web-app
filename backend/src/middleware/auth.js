const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { getGuestBySessionId } = require('../controllers/guestController');
const { logger } = require('../config/logger');

// Middleware to authenticate and authorize guest requests only
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const decoded = verifyToken(token);
    
    // Only accept guest sessions
    if (!decoded.isGuest || !decoded.sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Only guest sessions are supported'
      });
    }

    const guestSession = await getGuestBySessionId(decoded.sessionId);
    if (!guestSession) {
      return res.status(401).json({
        success: false,
        message: 'Guest session not found or expired'
      });
    }
    
    // Add guest info to request object
    req.user = {
      id: guestSession.id,
      username: guestSession.username,
      isGuest: true,
      sessionId: guestSession.sessionId
    };
    req.userId = guestSession.id;
    req.sessionId = guestSession.sessionId;
    req.isGuest = true;
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token'
    });
  }
};

// Middleware for Socket.IO authentication (guest-only)
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = verifyToken(token);
    
    // Only accept guest sessions
    if (!decoded.isGuest || !decoded.sessionId) {
      return next(new Error('Only guest sessions are supported'));
    }

    const guestSession = await getGuestBySessionId(decoded.sessionId);
    if (!guestSession) {
      return next(new Error('Guest session not found or expired'));
    }
    
    // Add guest info to socket object
    socket.user = {
      id: guestSession.id,
      username: guestSession.username,
      isGuest: true,
      sessionId: guestSession.sessionId
    };
    socket.userId = guestSession.id;
    socket.sessionId = guestSession.sessionId;
    socket.isGuest = true;
    
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error(error.message || 'Invalid token'));
  }
};

module.exports = {
  authenticateToken,
  authenticateSocket
};