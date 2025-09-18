const express = require('express');
const router = express.Router();
const { uploadFile, uploadVoice } = require('../controllers/fileController');
const { uploadSingle } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/security');
const { validateFileMetadata, validateVoiceNote } = require('../middleware/validation');

// Route for general file uploads
router.post('/upload', 
    uploadLimiter,
    uploadSingle(), // parse multipart first so req.body has fields
    validateFileMetadata,
    uploadFile
);

// Route for voice note uploads
router.post('/voice',
    uploadLimiter,
    uploadSingle(), // parse multipart first so req.body has fields
    validateVoiceNote,
    uploadVoice
);

// Test route to check connected users
router.get('/debug/users', (req, res) => {
    const connectedUsers = require('../socket/socketHandlers').connectedUsers;
    const userSockets = require('../socket/socketHandlers').userSockets;
    
    res.json({
        connectedUsersCount: connectedUsers.size,
        userSocketsCount: userSockets.size,
        connectedUsers: Array.from(connectedUsers.entries()),
        userSockets: Array.from(userSockets.entries())
    });
});

module.exports = router;
