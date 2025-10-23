const express = require('express');
const router = express.Router();
const { createGuestSession, getGuestSession, generateRandomUsername } = require('../controllers/guestController');
const { authenticateToken } = require('../middleware/auth');
const { validateGuestUsername } = require('../middleware/validation');

/**
 * @route   GET /api/auth/me
 * @desc    Get current user information (guest session only)
 * @access  Private (requires guest JWT)
 */
router.get('/me', authenticateToken, (req, res) => {
  // Return guest user information
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

/**
 * @route   GET /api/auth/guest/username
 * @desc    Generate a random username for guest
 * @access  Public
 */
router.get('/guest/username', generateRandomUsername);

/**
 * @route   POST /api/auth/guest
 * @desc    Create a guest session and return JWT token
 * @access  Public
 */
router.post('/guest', validateGuestUsername, createGuestSession);

/**
 * @route   GET /api/auth/guest/:sessionId
 * @desc    Get guest session information
 * @access  Public
 */
router.get('/guest/:sessionId', getGuestSession);

module.exports = router;
