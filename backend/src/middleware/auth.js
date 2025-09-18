const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');
const { logger } = require('../config/database');

// Middleware to authenticate and authorize requests
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
    
    // Find user and check if still exists
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add user info to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token'
    });
  }
};

// Middleware for Socket.IO authentication
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = verifyToken(token);
    
    // Find user and check if still exists
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }

    // Add user info to socket object
    socket.user = user;
    socket.userId = user._id.toString();
    
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