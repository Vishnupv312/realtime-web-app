"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  Paperclip,
  Mic,
  Video,
  Phone,
  MoreVertical,
  UserPlus,
  Trash2,
  ArrowLeft,
  MapPin,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { fileAPI } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import useWebRTC from "@/hooks/useWebRTC";
import VideoCallModal from "@/components/VideoCallModal";
import FilePreview from "@/components/FilePreview";

interface FileUploadProgress {
  file: File;
  progress: number;
  uploading: boolean;
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const {
    isConnected,
    connectedUser,
    messages,
    isTyping,
    isMatching,
    requestMatch,
    sendMessage,
    addSystemMessage,
    clearChat,
    startTyping,
    stopTyping,
    leaveRoom,
    getCurrentRoomId,
  } = useChat();
  const {
    startCall,
    isIncomingCall,
    incomingCallData,
    acceptCall,
    rejectCall,
    isCallActive,
    localStream,
    remoteStream,
    callType,
    callState,
    isCaller,
    localVideoRef,
    remoteVideoRef,
    mediaError,
    isRequestingPermissions,
    endCall,
  } = useWebRTC({
    connectedUser,
    currentUserId: user?.id,
    addSystemMessage
  });
  const router = useRouter();

  const [messageInput, setMessageInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [fileUpload, setFileUpload] = useState<FileUploadProgress | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isMatching) {
      setShowMatchDialog(true);
    } else {
      setShowMatchDialog(false);
    }
  }, [isMatching]);

  useEffect(() => {
    if (isCallActive) {
      setShowCallModal(true);
    } else {
      setShowCallModal(false);
    }
  }, [isCallActive]);

  // Route guard - detect when user leaves the chat page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (connectedUser) {
        leaveRoom?.();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && connectedUser) {
        leaveRoom?.();
      }
    };

    // // Add event listeners for page unload and visibility change
    // window.addEventListener('beforeunload', handleBeforeUnload);
    // document.addEventListener('visibilitychange', handleVisibilityChange);

    // // Cleanup function to leave room when component unmounts
    // return () => {
    //   window.removeEventListener('beforeunload', handleBeforeUnload);
    //   document.removeEventListener('visibilitychange', handleVisibilityChange);
    //   if (connectedUser) {
    //     leaveRoom?.();
    //   }
    // };
  }, [connectedUser, leaveRoom]);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !connectedUser) return;

    sendMessage(messageInput.trim());
    setMessageInput("");
    stopTyping();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    // Handle typing indicators
    if (e.target.value.trim()) {
      startTyping();
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    } else {
      stopTyping();
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!connectedUser) return;

    const roomId = getCurrentRoomId();
    if (!roomId) {
      alert("No active chat room");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File size must be less than 10MB");
      return;
    }

    setFileUpload({ file, progress: 0, uploading: true });

    try {
      const formData = new FormData();
      formData.append("file", file);
      // Include metadata required by backend validation
      formData.append("filename", file.name);
      formData.append("fileType", getFileType(file));
      formData.append("fileSize", String(file.size));
      formData.append("roomId", roomId); // Add room ID for temporary storage

      const response = await fileAPI.uploadFile(formData);
      const fileData = response.data.data;

      // Send file with temporary URLs for sharing
      sendMessage(fileData, "file");
      setFileUpload(null);
    } catch (error) {
      console.error("File upload failed:", error);
      alert("Failed to upload file");
      setFileUpload(null);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/mp3",
        });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.mp3`, {
          type: "audio/mp3",
        });

        // Upload voice note
        const roomId = getCurrentRoomId();
        if (!roomId) {
          alert("No active chat room");
          return;
        }
        
        const formData = new FormData();
        formData.append("file", audioFile);
        // Calculate duration in seconds (min 1s to satisfy validation)
        const durationSec = Math.max(
          1,
          Math.ceil(
            recordingStartRef.current
              ? (Date.now() - recordingStartRef.current) / 1000
              : 1,
          ),
        );
        formData.append("duration", String(durationSec));
        // Include metadata required by backend validation
        formData.append("filename", audioFile.name);
        formData.append("fileType", "audio");
        formData.append("fileSize", String(audioFile.size));
        formData.append("roomId", roomId); // Add room ID for temporary storage

        try {
          const response = await fileAPI.uploadVoice(formData);
          const voiceData = response.data.data;
          sendMessage(voiceData, "voice");
        } catch (error) {
          console.error("Voice upload failed:", error);
          alert("Failed to upload voice note");
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Failed to start voice recording");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVideoCall = () => {
    startCall("video");
  };

  const handleAudioCall = () => {
    startCall("audio");
  };

  const getFileType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMessage = (message: any, index: number) => {
    // Handle system messages differently (centered)
    if (message.senderId === "system" || message.type === "system" || message.isSystemMessage) {
      return (
        <motion.div
          key={message.id || index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex justify-center my-2 sm:my-3"
        >
          <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-full max-w-xs sm:max-w-sm text-center break-words">
            {message.content}
          </div>
        </motion.div>
      );
    }

    // Regular user messages
    const isOwn = message.senderId === user?.id;
    const showAvatar =
      index === 0 || messages[index - 1]?.senderId !== message.senderId;

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"} ${
          showAvatar ? "mt-4" : "mt-1"
        }`}
      >
        {showAvatar && !isOwn && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-600 text-white text-xs">
              {getInitials(message.senderUsername)}
            </AvatarFallback>
          </Avatar>
        )}
        {!showAvatar && !isOwn && <div className="w-8" />}

        <div
          className={`max-w-xs lg:max-w-md ${
            isOwn ? "items-end" : "items-start"
          } flex flex-col`}
        >
          {showAvatar && (
            <div
              className={`text-xs text-gray-500 mb-1 ${
                isOwn ? "text-right" : "text-left"
              }`}
            >
              {message.senderUsername} • {formatTime(message.timestamp)}
            </div>
          )}

          <div
            className={`rounded-2xl px-4 py-2 ${
              isOwn
                ? "bg-blue-600 text-white rounded-br-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md"
            }`}
          >
            {message.type === "text" && (
              <p className="text-sm">{message.content}</p>
            )}

            {message.type === "file" && (() => {
              console.log("File message content:", message.content);
              return true; // Always render file messages for debugging
            })() && (
              message.content.tempUrl && message.content.downloadUrl ? (
                <FilePreview
                  filename={message.content.filename || 'Unknown file'}
                  tempUrl={message.content.tempUrl}
                  downloadUrl={message.content.downloadUrl}
                  fileType={message.content.fileType}
                  fileSize={message.content.fileSize}
                  isImage={message.content.isImage}
                  fileTypeCategory={message.content.fileTypeCategory}
                  expiresAt={message.content.expiresAt}
                  className="max-w-full"
                />
              ) : (
                <div className="p-3 bg-red-100 border border-red-300 rounded">
                  <p className="text-red-700 text-sm">File message (Debug)</p>
                  <p className="text-xs text-red-600">Filename: {message.content.filename || 'Unknown'}</p>
                  <p className="text-xs text-red-600">TempURL: {message.content.tempUrl ? 'Present' : 'Missing'}</p>
                  <p className="text-xs text-red-600">DownloadURL: {message.content.downloadUrl ? 'Present' : 'Missing'}</p>
                  <pre className="text-xs text-red-600 mt-1">{JSON.stringify(message.content, null, 2)}</pre>
                </div>
              )
            )}

            {message.type === "voice" && (
              <div className="space-y-2">
                {/* Audio player if temp URL is available */}
                {message.content.tempUrl && (
                  <audio 
                    controls 
                    className="max-w-full"
                    onError={(e) => {
                      // Hide audio player if it fails to load (expired)
                      e.currentTarget.style.display = 'none';
                    }}
                  >
                    <source src={message.content.tempUrl} type={message.content.fileType || 'audio/mpeg'} />
                    Your browser does not support the audio element.
                  </audio>
                )}
                
                {/* Voice message info */}
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-sm">Voice message</p>
                    <p className="text-xs opacity-75">
                      {message.content.duration ? `${message.content.duration}s` : 'Duration unknown'}
                      {message.content.expiresAt && (
                        <span className="ml-2">
                          • Expires {new Date(message.content.expiresAt).toLocaleTimeString()}
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {/* Download button for voice */}
                  {message.content.downloadUrl && (
                    <a 
                      href={message.content.downloadUrl}
                      download={message.content.filename}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                      onClick={(e) => {
                        // Check if link is still valid
                        fetch(message.content.downloadUrl, { method: 'HEAD' })
                          .catch(() => {
                            e.preventDefault();
                            alert('Voice message has expired or is no longer available');
                          });
                      }}
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {message.status && isOwn && (
            <div className="text-xs text-gray-500 mt-1">
              {message.status === "sending" && "Sending..."}
              {message.status === "sent" && "Sent"}
              {message.status === "delivered" && "Delivered"}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <header className="border-b bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  leaveRoom?.();
                  router.push("/dashboard");
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              {connectedUser ? (
                <>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-600 text-white">
                      {getInitials(connectedUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {connectedUser.username}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Online</span>
                      {connectedUser.location && (
                        <>
                          <span>•</span>
                          <MapPin className="w-3 h-3" />
                          <span>
                            {connectedUser.location.city},{" "}
                            {connectedUser.location.country}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Chat
                  </h2>
                  <p className="text-sm text-gray-500">
                    {isConnected ? "Ready to connect" : "Connecting..."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {connectedUser && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAudioCall}
                    disabled={isCallActive}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleVideoCall}
                    disabled={isCallActive}
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!connectedUser && (
                    <DropdownMenuItem
                      onClick={requestMatch}
                      disabled={isMatching}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Find New Chat
                    </DropdownMenuItem>
                  )}
                  {connectedUser && (
                    <DropdownMenuItem onClick={clearChat}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Chat
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!connectedUser && !isMatching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ready to Chat?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Find a random person to start chatting with
              </p>
              <Button onClick={requestMatch} disabled={isMatching}>
                <UserPlus className="w-4 h-4 mr-2" />
                Find Someone to Chat
              </Button>
            </motion.div>
          )}

          {messages.map((message, index) => renderMessage(message, index))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gray-600 text-white text-xs">
                  {connectedUser ? getInitials(connectedUser.username) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {connectedUser && (
          <div className="border-t bg-white dark:bg-gray-900 p-4">
            {fileUpload && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-600">
                      {fileUpload.file.name}
                    </span>
                  </div>
                  {fileUpload.uploading && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  )}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!fileUpload}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <div className="flex-1 relative">
                <Input
                  value={messageInput}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="pr-12"
                  disabled={!!fileUpload}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onMouseDown={startVoiceRecording}
                  onMouseUp={stopVoiceRecording}
                  onMouseLeave={stopVoiceRecording}
                  disabled={!!fileUpload}
                >
                  <Mic
                    className={`w-4 h-4 ${isRecording ? "text-red-500" : ""}`}
                  />
                </Button>
              </div>

              <Button
                type="submit"
                disabled={!messageInput.trim() || !!fileUpload}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}

        {/* Matching Dialog */}
        <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Finding a Chat Partner</DialogTitle>
              <DialogDescription>
                We're looking for someone interesting for you to chat with. This
                might take a moment...
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Searching for available users...
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Incoming Call Dialog */}
        <Dialog open={isIncomingCall} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Incoming {incomingCallData?.type} Call</DialogTitle>
              <DialogDescription>
                {incomingCallData?.fromUsername} is calling you
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <Avatar className="h-16 w-16 mb-4">
                <AvatarFallback className="bg-blue-600 text-white text-lg">
                  {incomingCallData
                    ? getInitials(incomingCallData.fromUsername)
                    : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-4">
                <Button
                  onClick={acceptCall}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Accept
                </Button>
                <Button onClick={rejectCall} variant="destructive">
                  <Phone className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Call Modal */}
        <VideoCallModal
          isOpen={showCallModal}
          onClose={() => setShowCallModal(false)}
          connectedUser={connectedUser}
          localStream={localStream}
          remoteStream={remoteStream}
          callType={callType}
          callState={callState}
          isCaller={isCaller}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          mediaError={mediaError}
          isRequestingPermissions={isRequestingPermissions}
          endCall={endCall}
        />
      </div>
    </ProtectedRoute>
  );
}
