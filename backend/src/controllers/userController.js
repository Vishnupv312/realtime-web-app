const User = require('../models/User');
const { logger } = require('../config/database');
const { validationResult } = require('express-validator');
const geoip = require('geoip-lite');

// Get online users
const getOnlineUsers = async (req, res) => {
  try {
    const currentUserId = req.userId;
    
    // Find all online users except current user
    const onlineUsers = await User.find({
      _id: { $ne: currentUserId },
      isOnline: true
    })
    .select('username email isOnline lastSeen deviceId location connectedUser')
    .populate('connectedUser', 'username email');

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

// Update device information
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

    const userId = req.userId;
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

    // Update user with device info
    const updateData = {
      lastSeen: new Date()
    };

    if (deviceId) updateData.deviceId = deviceId;
    if (clientIp) updateData.ip = clientIp;
    if (location) updateData.location = location;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info(`Device info updated for user: ${user.username}, IP: ${clientIp}, DeviceId: ${deviceId}`);

    res.json({
      success: true,
      message: 'Device information updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          deviceId: user.deviceId,
          ip: user.ip,
          location: user.location,
          lastSeen: user.lastSeen
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

// Get available users for matching
const getAvailableUsers = async (req, res) => {
  try {
    const currentUserId = req.userId;
    
    // Find users who are online and not connected to anyone
    const availableUsers = await User.findAvailableUsers(currentUserId);

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

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({ isOnline: true });
    const availableUsers = await User.countDocuments({ 
      isOnline: true, 
      connectedUser: null 
    });

    res.json({
      success: true,
      data: {
        statistics: {
          totalUsers,
          onlineUsers,
          availableUsers,
          connectedUsers: onlineUsers - availableUsers
        }
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