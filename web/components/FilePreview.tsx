"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FilePreviewProps {
  filename: string;
  tempUrl: string;
  downloadUrl: string;
  fileType?: string;
  fileSize?: number;
  isImage?: boolean;
  fileTypeCategory?: string;
  expiresAt?: string;
  className?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  filename,
  tempUrl,
  downloadUrl,
  fileType,
  fileSize,
  isImage,
  fileTypeCategory,
  expiresAt,
  className = "",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setImageError(false);
  }, [tempUrl]);
  const getFileIcon = () => {
    switch (fileTypeCategory) {
      case "image":
        return <FileImage className="w-6 h-6" />;
      case "video":
        return <FileVideo className="w-6 h-6" />;
      case "audio":
        return <FileAudio className="w-6 h-6" />;
      case "pdf":
        return <FileText className="w-6 h-6" />;
      default:
        return <File className="w-6 h-6" />;
    }
  };
  // Add this useEffect in FilePreview component

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toUpperCase() || "";
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Check if file is still available
      const response = await fetch(downloadUrl, { method: "HEAD" });
      if (response.ok) {
        // Create a temporary anchor to trigger download
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error("File not available");
      }
    } catch (error) {
      alert("File has expired or is no longer available");
    }
  };

  const handleImageClick = () => {
    if (isImage && !imageError) {
      setIsModalOpen(true);
    }
  };

  // Image preview component
  const ImagePreview = () => {
    console.log(
      "ImagePreview - isImage:",
      isImage,
      "imageError:",
      imageError,
      "tempUrl:",
      tempUrl
    );

    if (!isImage || imageError) {
      console.log(
        "ImagePreview returning null - isImage:",
        isImage,
        "imageError:",
        imageError
      );
      return null;
    }

    return (
      <div className="relative group cursor-pointer" onClick={handleImageClick}>
        <img
          src={tempUrl}
          alt={filename}
          className="rounded-lg max-w-full h-auto max-h-64 object-cover transition-opacity group-hover:opacity-90"
          onError={(e) => {
            console.error("Image failed to load:", tempUrl, e);
            setImageError(true);
          }}
          onLoad={() => {
            console.log("Image loaded successfully:", tempUrl);
          }}
          loading="lazy"
        />
        {/* Overlay with zoom icon on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Maximize2 className="w-8 h-8 text-white" />
        </div>
        {/* File size badge */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          {formatFileSize(fileSize)}
        </div>
      </div>
    );
  };

  // PDF preview component
  const PDFPreview = () => {
    if (fileTypeCategory !== "pdf") return null;

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-100 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">
              {filename}
            </p>
            <p className="text-xs text-gray-600">{formatFileSize(fileSize)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Video preview component
  const VideoPreview = () => {
    if (fileTypeCategory !== "video") return null;

    return (
      <div className="relative">
        <video
          src={tempUrl}
          className="rounded-lg max-w-full h-auto max-h-64"
          controls
          preload="metadata"
          onError={() => setImageError(true)}
        >
          Your browser does not support the video element.
        </video>
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          {formatFileSize(fileSize)}
        </div>
      </div>
    );
  };

  // Generic file preview component
  const GenericFilePreview = () => {
    if (isImage || fileTypeCategory === "pdf" || fileTypeCategory === "video")
      return null;

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center flex-col">
            {getFileIcon()}
            <span className="text-[8px] text-white font-bold mt-0.5">
              {getFileExtension(filename)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">
              {filename}
            </p>
            <p className="text-xs text-gray-600">{formatFileSize(fileSize)}</p>
            {expiresAt && (
              <p className="text-xs text-orange-600">
                Expires {new Date(expiresAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Image modal/lightbox
  const ImageModal = () => (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <div className="relative bg-black">
          {/* Header with filename and controls */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-75 text-white p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium truncate">{filename}</h3>
              <p className="text-sm text-gray-300">
                {formatFileSize(fileSize)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownload}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(tempUrl, "_blank")}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Image container */}
          <div className="flex items-center justify-center min-h-[400px] p-16">
            <motion.img
              src={tempUrl}
              alt={filename}
              className="max-w-full max-h-full object-contain"
              style={{ transform: `scale(${zoom})` }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: zoom, opacity: 1 }}
              transition={{ duration: 0.2 }}
              onError={() => {
                setImageError(true);
                setIsModalOpen(false);
                alert("Image has expired or is no longer available");
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className={`file-preview ${className}`}>
      {/* <div style={{ fontSize: "10px", color: "red", marginBottom: "5px" }}>
        Debug: isImage={String(isImage)}, imageError={String(imageError)},
        fileTypeCategory={fileTypeCategory}
      </div> */}
      <ImagePreview />
      <VideoPreview />
      <PDFPreview />
      <GenericFilePreview />
      <ImageModal />
    </div>
  );
};

export default FilePreview;
