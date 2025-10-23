const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAllOnlineGuests, getGuestStats } = require('../controllers/guestController');

/**
 * @route   GET /api/stats
 * @desc    Get current system statistics
 * @access  Private (requires JWT - regular user or guest)
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const guestStats = getGuestStats();
    const onlineGuests = getAllOnlineGuests();
    
    const stats = {
      totalUsers: guestStats.totalUsers,
      onlineUsers: guestStats.onlineUsers,
      availableUsers: guestStats.availableUsers,
      connectedUsers: guestStats.connectedUsers
    };
    
    const onlineUsers = onlineGuests.map(guest => ({
      id: guest.id,
      username: guest.username,
      isOnline: guest.isOnline,
      isSearching: guest.isSearching,
      lastSeen: guest.lastSeen,
      isGuest: true
    }));
    
    res.json({
      success: true,
      data: {
        stats,
        onlineUsers,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/stats/online-users
 * @desc    Get list of currently online users
 * @access  Private (requires JWT - regular user or guest)
 */
router.get('/online-users', authenticateToken, (req, res) => {
  try {
    const onlineGuests = getAllOnlineGuests();
    
    const onlineUsers = onlineGuests.map(guest => ({
      id: guest.id,
      username: guest.username,
      isOnline: guest.isOnline,
      isSearching: guest.isSearching,
      lastSeen: guest.lastSeen,
      isGuest: true
    }));
    
    res.json({
      success: true,
      data: {
        onlineUsers,
        count: onlineUsers.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch online users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;