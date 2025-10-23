const { body, param, query } = require('express-validator');

// Guest username validation
const validateGuestUsername = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
];

// Device update validation
const validateDeviceUpdate = [
  body('deviceId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Device ID must be between 1 and 100 characters'),
    
  body('ip')
    .optional()
    .isIP()
    .withMessage('Invalid IP address format'),
    
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
    
  body('location.country')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country must be less than 50 characters'),
    
  body('location.region')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Region must be less than 50 characters'),
    
  body('location.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City must be less than 50 characters')
];

// File upload validation (for metadata)
const validateFileMetadata = [
  body('filename')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Filename must be between 1 and 255 characters'),
    
  body('fileType')
    .isIn(['image', 'video', 'audio', 'document'])
    .withMessage('Invalid file type'),
    
  body('fileSize')
    .toInt()
    .isInt({ min: 1, max: 10485760 }) // 10MB
    .withMessage('File size must be between 1 byte and 10MB')
];

// Voice note validation
const validateVoiceNote = [
  body('duration')
    .toInt()
    .isInt({ min: 1, max: 300 }) // 5 minutes
    .withMessage('Voice note duration must be between 1 second and 5 minutes'),
    
  body('fileSize')
    .toInt()
    .isInt({ min: 1, max: 10485760 }) // 10MB
    .withMessage('File size must be between 1 byte and 10MB')
];

// Socket message validation (for use in socket handlers)
const validateMessage = {
  text: (message) => {
    return typeof message === 'string' && message.trim().length > 0 && message.length <= 1000;
  },
  
  file: (fileData) => {
    return fileData && 
           typeof fileData.filename === 'string' &&
           typeof fileData.fileType === 'string' &&
           typeof fileData.fileSize === 'number' &&
           fileData.fileSize <= 10485760; // 10MB
  },
  
  voice: (voiceData) => {
    return voiceData &&
           typeof voiceData.duration === 'number' &&
           voiceData.duration <= 300 && // 5 minutes
           voiceData.duration > 0 &&
           typeof voiceData.fileSize === 'number' &&
           voiceData.fileSize <= 10485760; // 10MB
  }
};

module.exports = {
  validateGuestUsername,
  validateDeviceUpdate,
  validateFileMetadata,
  validateVoiceNote,
  validateMessage
};
