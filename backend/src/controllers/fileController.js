const path = require('path');
const fs = require('fs').promises;
const { validationResult } = require('express-validator');
const tempFileStorage = require('../utils/tempFileStorage');

const uploadFile = async (req, res) => {
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

        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'No file uploaded' 
            });
        }

        // Get room ID from request body (should be provided by frontend)
        const roomId = req.body.roomId;
        if (!roomId) {
            return res.status(400).json({
                success: false,
                error: 'Room ID is required for file sharing'
            });
        }

        // Store file temporarily (expires in 2 hours)
        const fileId = tempFileStorage.storeFile(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname,
            roomId,
            120 // 2 hours expiration
        );

        // Generate temporary URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const tempUrl = `${baseUrl}/api/temp-files/temp/${fileId}`;
        const downloadUrl = `${baseUrl}/api/temp-files/download/${fileId}`;

        // Return file info with temporary URLs
        res.status(200).json({
            success: true,
            data: {
                fileId,
                filename: req.file.originalname,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                tempUrl,
                downloadUrl,
                isImage: tempFileStorage.isImage(req.file.mimetype),
                fileTypeCategory: tempFileStorage.getFileTypeCategory(req.file.mimetype),
                expiresAt: new Date(Date.now() + (120 * 60 * 1000)).toISOString() // 2 hours from now
            },
        });
    } catch (error) {
        console.error('Error in file upload:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to upload file' 
        });
    }
};

const uploadVoice = async (req, res) => {
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

        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'No voice note uploaded' 
            });
        }

        // Get room ID from request body
        const roomId = req.body.roomId;
        if (!roomId) {
            return res.status(400).json({
                success: false,
                error: 'Room ID is required for file sharing'
            });
        }

        // Store voice file temporarily (expires in 2 hours)
        const fileId = tempFileStorage.storeFile(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname,
            roomId,
            120 // 2 hours expiration
        );

        // Generate temporary URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const tempUrl = `${baseUrl}/api/temp-files/temp/${fileId}`;
        const downloadUrl = `${baseUrl}/api/temp-files/download/${fileId}`;

        res.status(200).json({
            success: true,
            data: {
                fileId,
                filename: req.file.originalname,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                duration: req.body.duration ? Number(req.body.duration) : null,
                tempUrl,
                downloadUrl,
                isImage: tempFileStorage.isImage(req.file.mimetype),
                fileTypeCategory: tempFileStorage.getFileTypeCategory(req.file.mimetype),
                expiresAt: new Date(Date.now() + (120 * 60 * 1000)).toISOString()
            },
        });
    } catch (error) {
        console.error('Error in voice note upload:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to upload voice note' 
        });
    }
};

module.exports = {
    uploadFile,
    uploadVoice
};