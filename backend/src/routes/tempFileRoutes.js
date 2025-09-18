const express = require('express');
const router = express.Router();
const tempFileStorage = require('../utils/tempFileStorage');
const { logger } = require('../config/database');

// Serve temporary file by ID
router.get('/temp/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }

    const fileData = tempFileStorage.getFile(fileId);
    
    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: 'File not found or expired'
      });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': fileData.mimetype,
      'Content-Length': fileData.size,
      'Content-Disposition': `inline; filename="${fileData.originalName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Send the file buffer
    res.send(fileData.buffer);
    
    logger.info(`Served temporary file: ${fileData.originalName} (${fileData.size} bytes)`);

  } catch (error) {
    logger.error('Error serving temporary file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve file'
    });
  }
});

// Download temporary file by ID
router.get('/download/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }

    const fileData = tempFileStorage.getFile(fileId);
    
    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: 'File not found or expired'
      });
    }

    // Set headers for download
    res.set({
      'Content-Type': fileData.mimetype,
      'Content-Length': fileData.size,
      'Content-Disposition': `attachment; filename="${fileData.originalName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Send the file buffer
    res.send(fileData.buffer);
    
    logger.info(`Downloaded temporary file: ${fileData.originalName} (${fileData.size} bytes)`);

  } catch (error) {
    logger.error('Error downloading temporary file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// Get file info without downloading
router.get('/info/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }

    const fileData = tempFileStorage.getFile(fileId);
    
    if (!fileData) {
      return res.status(404).json({
        success: false,
        message: 'File not found or expired'
      });
    }

    // Return file metadata
    res.json({
      success: true,
      data: {
        fileId,
        originalName: fileData.originalName,
        mimetype: fileData.mimetype,
        size: fileData.size,
        createdAt: fileData.createdAt,
        expiresAt: fileData.expiresAt,
        isImage: tempFileStorage.isImage(fileData.mimetype),
        fileType: tempFileStorage.getFileTypeCategory(fileData.mimetype)
      }
    });

  } catch (error) {
    logger.error('Error getting file info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file info'
    });
  }
});

// Get storage statistics (admin endpoint)
router.get('/stats', (req, res) => {
  try {
    const stats = tempFileStorage.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get storage statistics'
    });
  }
});

module.exports = router;