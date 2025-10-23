const { generateToken } = require('../utils/jwt');
const { logger } = require('../config/logger');
const redisGuestManager = require('../utils/redisGuestManager');

const generateRandomUsername = async (req, res) => {
  try {
    const username = redisGuestManager.generateGuestUsername();
    
    res.json({
      success: true,
      data: {
        username
      }
    });
  } catch (error) {
    logger.error('Error generating random username:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate username'
    });
  }
};

const createGuestSession = async (req, res) => {
  try {
    const { username, location, gender, language } = req.body;
    
    // Create guest session using Redis manager
    const guestSession = await redisGuestManager.createGuestSession(username);
    
    // Update additional info if provided
    if (location || gender || language) {
      await redisGuestManager.updateGuestPresence(guestSession.sessionId, {
        location,
        gender,
        language
      });
    }
    
    // Generate JWT token for guest session
    const tokenPayload = {
      userId: guestSession.id,
      sessionId: guestSession.sessionId,
      username: guestSession.username,
      isGuest: true,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = generateToken(tokenPayload, '2h'); // 2-hour expiry
    
    logger.info(`Guest session created: ${guestSession.username} (${guestSession.sessionId})`);
    
    res.status(201).json({
      success: true,
      message: 'Guest session created successfully',
      data: {
        token,
        user: {
          id: guestSession.id,
          username: guestSession.username,
          isGuest: true,
          sessionId: guestSession.sessionId,
          location: location || null,
          gender: gender || null,
          language: language || null
        }
      }
    });
  } catch (error) {
    logger.error('Error creating guest session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create guest session',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const getGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const guestSession = await redisGuestManager.getGuestSession(sessionId);
    
    if (!guestSession) {
      return res.status(404).json({
        success: false,
        message: 'Guest session not found or expired'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: guestSession.id,
          username: guestSession.username,
          isOnline: guestSession.isOnline,
          lastSeen: guestSession.lastSeen,
          isSearching: guestSession.isSearching,
          connectedUser: guestSession.connectedUser,
          isGuest: true,
          sessionId: guestSession.sessionId,
          location: guestSession.location,
          gender: guestSession.gender,
          language: guestSession.language
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching guest session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guest session'
    });
  }
};

// Async wrapper functions to maintain compatibility with existing code
const updateGuestPresence = async (sessionId, updates) => {
  return await redisGuestManager.updateGuestPresence(sessionId, updates);
};

const getGuestBySessionId = async (sessionId) => {
  return await redisGuestManager.getGuestSession(sessionId);
};

const getAllOnlineGuests = async () => {
  return await redisGuestManager.getAllOnlineGuests();
};

const getGuestStats = async () => {
  return await redisGuestManager.getGuestStats();
};

const cleanExpiredSessions = () => {
  return redisGuestManager.cleanupExpiredSessions();
};

module.exports = {
  createGuestSession,
  getGuestSession,
  generateRandomUsername,
  updateGuestPresence,
  getGuestBySessionId,
  getAllOnlineGuests,
  getGuestStats,
  cleanExpiredSessions
};
