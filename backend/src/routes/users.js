const express = require('express');
const router = express.Router();
const { 
  getOnlineUsers, 
  updateDevice, 
  getAvailableUsers, 
  getUserStats 
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { validateDeviceUpdate } = require('../middleware/validation');

/**
 * @route   GET /api/users/online
 * @desc    Get list of online users
 * @access  Private (requires JWT)
 */
router.get('/online', authenticateToken, getOnlineUsers);

/**
 * @route   GET /api/users/available
 * @desc    Get list of available users for matching
 * @access  Private (requires JWT)
 */
router.get('/available', authenticateToken, getAvailableUsers);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private (requires JWT)
 */
router.get('/stats', authenticateToken, getUserStats);

/**
 * @route   POST /api/users/device
 * @desc    Register or update device information
 * @access  Private (requires JWT)
 */
router.post('/device', authenticateToken, validateDeviceUpdate, updateDevice);

module.exports = router;