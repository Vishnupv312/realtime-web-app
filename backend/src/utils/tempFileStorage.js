const { v4: uuidv4 } = require('uuid');
const { logger } = require('../config/database');

// In-memory storage for temporary files
const tempFiles = new Map(); // fileId -> { buffer, mimetype, originalName, roomId, createdAt, expiresAt }
const roomFiles = new Map(); // roomId -> Set of fileIds

class TempFileStorage {
  constructor() {
    // Clean up expired files every 5 minutes
    setInterval(() => {
      this.cleanupExpiredFiles();
    }, 5 * 60 * 1000);
  }

  /**
   * Store a file temporarily
   * @param {Buffer} buffer - File buffer
   * @param {string} mimetype - File MIME type
   * @param {string} originalName - Original filename
   * @param {string} roomId - Room ID the file belongs to
   * @param {number} expirationMinutes - Minutes until file expires (default: 60)
   * @returns {string} fileId - Unique identifier for the file
   */
  storeFile(buffer, mimetype, originalName, roomId, expirationMinutes = 60) {
    const fileId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (expirationMinutes * 60 * 1000));

    const fileData = {
      buffer,
      mimetype,
      originalName,
      roomId,
      createdAt: now,
      expiresAt,
      size: buffer.length
    };

    // Store the file
    tempFiles.set(fileId, fileData);

    // Track files by room
    if (!roomFiles.has(roomId)) {
      roomFiles.set(roomId, new Set());
    }
    roomFiles.get(roomId).add(fileId);

    logger.info(`Temporary file stored: ${originalName} (${buffer.length} bytes) for room ${roomId}, expires at ${expiresAt.toISOString()}`);

    return fileId;
  }

  /**
   * Retrieve a file by ID
   * @param {string} fileId - File identifier
   * @returns {Object|null} File data or null if not found/expired
   */
  getFile(fileId) {
    const fileData = tempFiles.get(fileId);
    
    if (!fileData) {
      return null;
    }

    // Check if file has expired
    if (new Date() > fileData.expiresAt) {
      this.deleteFile(fileId);
      return null;
    }

    return fileData;
  }

  /**
   * Delete a specific file
   * @param {string} fileId - File identifier
   * @returns {boolean} True if file was deleted
   */
  deleteFile(fileId) {
    const fileData = tempFiles.get(fileId);
    if (!fileData) {
      return false;
    }

    // Remove from room tracking
    const roomFileSet = roomFiles.get(fileData.roomId);
    if (roomFileSet) {
      roomFileSet.delete(fileId);
      if (roomFileSet.size === 0) {
        roomFiles.delete(fileData.roomId);
      }
    }

    // Remove the file
    tempFiles.delete(fileId);
    
    logger.info(`Temporary file deleted: ${fileData.originalName} (${fileData.size} bytes)`);
    return true;
  }

  /**
   * Delete all files associated with a room
   * @param {string} roomId - Room identifier
   * @returns {number} Number of files deleted
   */
  deleteRoomFiles(roomId) {
    const roomFileSet = roomFiles.get(roomId);
    if (!roomFileSet || roomFileSet.size === 0) {
      return 0;
    }

    let deletedCount = 0;
    for (const fileId of roomFileSet) {
      if (tempFiles.delete(fileId)) {
        deletedCount++;
      }
    }

    roomFiles.delete(roomId);
    
    logger.info(`Deleted ${deletedCount} temporary files for room ${roomId}`);
    return deletedCount;
  }

  /**
   * Clean up expired files
   */
  cleanupExpiredFiles() {
    const now = new Date();
    let expiredCount = 0;

    for (const [fileId, fileData] of tempFiles.entries()) {
      if (now > fileData.expiresAt) {
        this.deleteFile(fileId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.info(`Cleaned up ${expiredCount} expired temporary files`);
    }
  }

  /**
   * Get storage statistics
   */
  getStats() {
    const totalFiles = tempFiles.size;
    const totalRooms = roomFiles.size;
    let totalSize = 0;

    for (const fileData of tempFiles.values()) {
      totalSize += fileData.size;
    }

    return {
      totalFiles,
      totalRooms,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  }

  /**
   * Generate a base64 data URL for the file
   * @param {string} fileId - File identifier
   * @returns {string|null} Data URL or null if file not found
   */
  getFileDataUrl(fileId) {
    const fileData = this.getFile(fileId);
    if (!fileData) {
      return null;
    }

    const base64 = fileData.buffer.toString('base64');
    return `data:${fileData.mimetype};base64,${base64}`;
  }

  /**
   * Check if a file type is an image
   * @param {string} mimetype - File MIME type
   * @returns {boolean} True if the file is an image
   */
  isImage(mimetype) {
    return mimetype && mimetype.startsWith('image/');
  }

  /**
   * Get file type category
   * @param {string} mimetype - File MIME type
   * @returns {string} File type category
   */
  getFileTypeCategory(mimetype) {
    if (!mimetype) return 'document';
    
    const mime = mimetype.toLowerCase();
    
    // Images
    if (mime.startsWith('image/')) return 'image';
    
    // Videos
    if (mime.startsWith('video/')) return 'video';
    
    // Audio
    if (mime.startsWith('audio/')) return 'audio';
    
    // PDFs
    if (mime.includes('pdf')) return 'pdf';
    
    // Text files
    if (mime.startsWith('text/') || 
        mime.includes('json') || 
        mime.includes('xml') || 
        mime.includes('csv')) return 'text';
    
    // Documents
    if (mime.includes('msword') || 
        mime.includes('wordprocessingml') || 
        mime.includes('spreadsheetml') || 
        mime.includes('presentationml') || 
        mime.includes('opendocument')) return 'document';
    
    // Archives
    if (mime.includes('zip') || 
        mime.includes('rar') || 
        mime.includes('tar') || 
        mime.includes('gzip')) return 'archive';
    
    return 'document';
  }
}

// Create singleton instance
const tempFileStorage = new TempFileStorage();

module.exports = tempFileStorage;