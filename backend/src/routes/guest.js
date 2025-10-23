const express = require('express');
const router = express.Router();
const { createGuestSession, getGuestSession, generateRandomUsername } = require('../controllers/guestController');
const { authenticateToken } = require('../middleware/auth');
const { validateGuestUsername } = require('../middleware/validation');

/**
 * @route   GET /api/guest/me
 * @desc    Get current guest user information
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
 * @route   GET /api/guest/username
 * @desc    Generate a random username for guest
 * @access  Public
 */
router.get('/username', generateRandomUsername);

/**
 * @route   POST /api/guest
 * @desc    Create a guest session and return JWT token
 * @access  Public
 */
router.post('/', validateGuestUsername, createGuestSession);

/**
 * @route   GET /api/guest/:sessionId
 * @desc    Get guest session information
 * @access  Public
 */
router.get('/:sessionId', getGuestSession);

/**
 * @route   POST /api/guest/location
 * @desc    Update guest location information
 * @access  Private (requires guest JWT)
 */
router.post('/location', authenticateToken, async (req, res) => {
  try {
    const { location, gender, language } = req.body;
    const { updateGuestPresence } = require('../controllers/guestController');
    
    const updatedSession = await updateGuestPresence(req.sessionId, {
      location,
      gender,
      language
    });
    
    if (updatedSession) {
      res.json({
        success: true,
        message: 'Location updated successfully',
        data: {
          location: updatedSession.location,
          gender: updatedSession.gender,
          language: updatedSession.language
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Guest session not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
});

module.exports = router;