const { logger } = require('../config/logger');
const { validationResult } = require('express-validator');
const { getAllOnlineGuests, updateGuestPresence, getGuestBySessionId } = require('./guestController');
const geoip = require('geoip-lite');

// Get online users (from guest sessions)
const getOnlineUsers = async (req, res) => {
  try {
    const currentUserId = req.userId;
    
    // Get all online guest users except current user
    const allOnlineGuests = getAllOnlineGuests();
    const onlineUsers = allOnlineGuests.filter(guest => guest.id !== currentUserId);

    res.json({
      success: true,
      data: {
        onlineUsers,
        count: onlineUsers.length
      }
    });
  } catch (error) {
    logger.error('Get online users error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update device information (for guest sessions)
const updateDevice = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const sessionId = req.sessionId;
    const { deviceId } = req.body;
    
    // Get IP from request
    const clientIp = req.ip || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    req.headers['x-forwarded-for']?.split(',')[0] ||
                    req.headers['x-real-ip'];

    // Get location from IP
    let location = null;
    if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
      const geoData = geoip.lookup(clientIp);
      if (geoData) {
        location = {
          country: geoData.country,
          region: geoData.region,
          city: geoData.city,
          timezone: geoData.timezone,
          coordinates: {
            lat: geoData.ll[0],
            lon: geoData.ll[1]
          }
        };
      }
    }

    // Update guest session with device info
    const updateData = {
      lastSeen: new Date(),
      ip: clientIp
    };

    if (deviceId) updateData.deviceId = deviceId;
    if (location) updateData.location = location;

    const guestSession = updateGuestPresence(sessionId, updateData);

    if (!guestSession) {
      return res.status(404).json({
        success: false,
        message: 'Guest session not found'
      });
    }

    logger.info(`Device info updated for guest: ${guestSession.username}, IP: ${clientIp}, DeviceId: ${deviceId}`);

    res.json({
      success: true,
      message: 'Device information updated successfully',
      data: {
        user: {
          id: guestSession.id,
          username: guestSession.username,
          deviceId: guestSession.deviceId,
          ip: guestSession.ip,
          location: guestSession.location,
          lastSeen: guestSession.lastSeen,
          isGuest: true
        }
      }
    });
  } catch (error) {
    logger.error('Update device error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get available users for matching (from guest sessions)
const getAvailableUsers = async (req, res) => {
  try {
    const currentUserId = req.userId;
    
    // Get all online guest users except current user who are available for matching
    const allOnlineGuests = getAllOnlineGuests();
    const availableUsers = allOnlineGuests.filter(guest => 
      guest.id !== currentUserId && 
      !guest.connectedUser && 
      guest.isSearching !== false
    );

    res.json({
      success: true,
      data: {
        availableUsers,
        count: availableUsers.length
      }
    });
  } catch (error) {
    logger.error('Get available users error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user statistics (from guest sessions)
const getUserStats = async (req, res) => {
  try {
    const { getGuestStats } = require('./guestController');
    const stats = getGuestStats();

    res.json({
      success: true,
      data: {
        statistics: stats
      }
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getOnlineUsers,
  updateDevice,
  getAvailableUsers,
  getUserStats
};