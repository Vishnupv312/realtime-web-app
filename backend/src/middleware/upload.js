const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../config/logger');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage - use memory storage for temporary file sharing
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  try {
    const allowedTypes = {
      // Images
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'image/webp': 'image',
      'image/svg+xml': 'image',
      'image/bmp': 'image',
      
      // Videos
      'video/mp4': 'video',
      'video/webm': 'video',
      'video/ogg': 'video',
      'video/avi': 'video',
      'video/mov': 'video',
      'video/wmv': 'video',
      
      // Audio
      'audio/mpeg': 'audio',
      'audio/mp3': 'audio',
      'audio/wav': 'audio',
      'audio/ogg': 'audio',
      'audio/webm': 'audio',
      'audio/m4a': 'audio',
      'audio/aac': 'audio',
      
      // Documents
      'application/pdf': 'document',
      'text/plain': 'document',
      'text/csv': 'document',
      'application/json': 'document',
      'text/xml': 'document',
      'application/xml': 'document',
      
      // MS Office
      'application/msword': 'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
      'application/vnd.ms-excel': 'document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
      'application/vnd.ms-powerpoint': 'document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
      
      // Archives
      'application/zip': 'document',
      'application/x-rar-compressed': 'document',
      'application/x-tar': 'document',
      'application/gzip': 'document'
    };

    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  } catch (error) {
    cb(error, false);
  }
};

// Helper function to get file type category
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'images';
  if (mimetype.startsWith('video/')) return 'videos';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'documents';
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 26214400, // 25MB default
    files: 1 // Only one file per upload
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName = 'file') => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: `File too large. Maximum size is ${(parseInt(process.env.MAX_FILE_SIZE) || 26214400) / (1024 * 1024)}MB`
          });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files. Only one file allowed per upload'
          });
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Unexpected field name for file upload'
          });
        }
        
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      // Add file information to request
      if (req.file) {
        req.fileInfo = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
          fileType: getFileType(req.file.mimetype),
          uploadedAt: new Date()
        };
        
        logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes) by user ${req.userId || 'unknown'}`);
      }
      
      next();
    });
  };
};

// Middleware to validate voice note duration (for client-side validation)
const validateVoiceNote = (req, res, next) => {
  try {
    const { duration } = req.body;
    const maxDuration = parseInt(process.env.MAX_VOICE_DURATION) || 300; // 5 minutes default
    
    if (!duration) {
      return res.status(400).json({
        success: false,
        message: 'Voice note duration is required'
      });
    }
    
    if (typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid voice note duration'
      });
    }
    
    if (duration > maxDuration) {
      return res.status(400).json({
        success: false,
        message: `Voice note too long. Maximum duration is ${maxDuration} seconds`
      });
    }
    
    next();
  } catch (error) {
    logger.error('Voice note validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Validation error'
    });
  }
};

// Utility function to delete uploaded file
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to delete file: ${filePath}`, error);
    return false;
  }
};

// Middleware to clean up old files (can be called periodically)
const cleanupOldFiles = (maxAgeHours = 24) => {
  return () => {
    try {
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      const now = Date.now();
      
      const processDir = (dirPath) => {
        if (!fs.existsSync(dirPath)) return;
        
        const files = fs.readdirSync(dirPath);
        
        files.forEach(file => {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            processDir(filePath);
          } else {
            const fileAge = now - stats.mtime.getTime();
            if (fileAge > maxAge) {
              deleteFile(filePath);
            }
          }
        });
      };
      
      processDir(uploadDir);
      logger.info('File cleanup completed');
    } catch (error) {
      logger.error('File cleanup error:', error);
    }
  };
};

module.exports = {
  uploadSingle,
  validateVoiceNote,
  deleteFile,
  cleanupOldFiles,
  getFileType
};