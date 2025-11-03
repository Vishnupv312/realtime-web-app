"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@/contexts/ChatContext";
import { useGuestSession } from "@/contexts/GuestSessionContext";
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
  X,
  ChevronDown,
  Check,
  CheckCheck,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { fileAPI } from "@/lib/api";
import useWebRTC from "@/hooks/useWebRTC";
import VideoCallModal from "@/components/VideoCallModal";
import FilePreview from "@/components/FilePreview";
import GuestUsernameModal from "@/components/GuestUsernameModal";

interface FileUploadProgress {
  file: File;
  progress: number;
  uploading: boolean;
}

export default function ChatPage() {
  // Add chat-view class to body on mount
  useEffect(() => {
    document.documentElement.classList.add("chat-view");
    document.body.classList.add("chat-view");

    return () => {
      document.documentElement.classList.remove("chat-view");
      document.body.classList.remove("chat-view");
    };
  }, []);

  const {
    guestUser,
    initializeGuestSession,
    clearGuestSession,
    isRegenerating,
  } = useGuestSession();
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
    currentUserId: guestUser?.id,
    addSystemMessage,
  });
  const router = useRouter();

  const [messageInput, setMessageInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [fileUpload, setFileUpload] = useState<FileUploadProgress | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessagesLengthRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize guest session if not exists
  useEffect(() => {
    if (!guestUser) {
      setShowUsernameModal(true);
    }
  }, [guestUser]);

  // Redirect to home if connection was cleared after reconnection
  useEffect(() => {
    // Only redirect if:
    // 1. Socket is connected (not in middle of reconnecting)
    // 2. Guest user exists
    // 3. No connected user (chat was cleared)
    // 4. Not currently matching
    if (isConnected && guestUser && !connectedUser && !isMatching) {
      // Check if we just reconnected (was disconnected recently)
      const wasRecentlyDisconnected =
        sessionStorage.getItem("was_disconnected");

      if (wasRecentlyDisconnected === "true") {
        console.log("🔄 Redirecting to home after stale chat was cleared");
        sessionStorage.removeItem("was_disconnected");

        // Small delay to show any system messages
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    }

    // Track disconnection state
    if (!isConnected) {
      sessionStorage.setItem("was_disconnected", "true");
    } else if (connectedUser) {
      // If we have an active chat, clear the disconnection flag
      sessionStorage.removeItem("was_disconnected");
    }
  }, [isConnected, guestUser, connectedUser, isMatching, router]);

  // Dynamically adjust padding based on input area height
  useEffect(() => {
    const adjustPadding = () => {
      const inputArea = document.querySelector(
        ".chat-input-container"
      ) as HTMLElement;
      const messagesArea = messagesContainerRef.current;

      if (inputArea && messagesArea) {
        const inputHeight = inputArea.offsetHeight;
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 375;

        // Reduced padding values
        let extraPadding = 30; // Desktop default

        if (isSmallMobile) {
          extraPadding = 40; // Small mobile
        } else if (isMobile) {
          extraPadding = 35; // Regular mobile
        }

        const paddingBottom = inputHeight + extraPadding;

        // Apply padding to messages container
        messagesArea.style.paddingBottom = `${paddingBottom}px`;

        console.log(
          `📏 Perfect padding: ${paddingBottom}px (input: ${inputHeight}px, extra: ${extraPadding}px)`
        );
      }
    };

    // Multiple adjustment attempts
    const delays = [0, 50, 100, 200, 300, 500, 800];
    const timeoutIds = delays.map((delay) => setTimeout(adjustPadding, delay));

    // Resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        adjustPadding();
        setTimeout(checkIfNearBottom, 150);
      }, 200);
    };

    window.addEventListener("resize", handleResize);

    // ResizeObserver for input area
    const inputArea = document.querySelector(".chat-input-container");
    const resizeObserver = inputArea
      ? new ResizeObserver(() => {
          adjustPadding();
          setTimeout(adjustPadding, 100);
          setTimeout(adjustPadding, 300);
        })
      : null;

    if (inputArea && resizeObserver) {
      resizeObserver.observe(inputArea);
    }

    return () => {
      timeoutIds.forEach(clearTimeout);
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [connectedUser, messages.length]);
  // Also adjust padding when messages change
  useEffect(() => {
    const adjustPadding = () => {
      const inputArea = document.querySelector(
        ".chat-input-container"
      ) as HTMLElement;
      const messagesArea = messagesContainerRef.current;

      if (inputArea && messagesArea) {
        const inputHeight = inputArea.offsetHeight;
        const isMobile = window.innerWidth <= 768;
        const extraPadding = isMobile ? 35 : 30;
        const paddingBottom = inputHeight + extraPadding;
        messagesArea.style.paddingBottom = `${paddingBottom}px`;
      }
    };

    // Adjust padding when new message arrives
    if (messages.length > 0) {
      setTimeout(adjustPadding, 50);
    }
  }, [messages.length]);

  const handleUsernameComplete = async (username: string) => {
    try {
      await initializeGuestSession(username);
      setShowUsernameModal(false);
    } catch (error) {
      console.error("Failed to initialize guest session:", error);
      // Keep modal open on error so user can retry
    }
  };

  // Handle dynamic viewport height and keyboard detection for mobile
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    const updateViewportHeight = () => {
      if (window.visualViewport) {
        // Get the actual visible viewport height (excludes keyboard)
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;

        // Calculate keyboard height
        const keyboardHeight = windowHeight - viewportHeight;

        // Set CSS custom properties
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${viewportHeight}px`
        );
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${keyboardHeight}px`
        );

        // Update vh for fallback
        const vh = viewportHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);

        console.log(
          "📏 Viewport:",
          viewportHeight,
          "Keyboard:",
          keyboardHeight
        );
      } else {
        // Fallback for browsers without visualViewport
        setVH();
      }
    };

    const handleResize = () => {
      updateViewportHeight();
      // Small delay to allow keyboard to settle
      setTimeout(checkIfNearBottom, 200);
    };

    const handleOrientationChange = () => {
      updateViewportHeight();
      // Force scroll check after orientation change
      setTimeout(() => {
        checkIfNearBottom();
        if (isNearBottomRef.current && messages.length > 0) {
          scrollToBottom(false);
        }
      }, 500);
    };

    // Handle virtual keyboard on mobile
    const handleVisualViewportChange = () => {
      updateViewportHeight();

      if (window.visualViewport) {
        // Delay to prevent scroll jank during keyboard animation
        setTimeout(() => {
          if (isNearBottomRef.current && messages.length > 0) {
            scrollToBottom(false);
          }
        }, 150);
      }
    };

    // Initial setup
    updateViewportHeight();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientationChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        handleVisualViewportChange
      );
      window.visualViewport.addEventListener(
        "scroll",
        handleVisualViewportChange
      );
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          handleVisualViewportChange
        );
        window.visualViewport.removeEventListener(
          "scroll",
          handleVisualViewportChange
        );
      }
    };
  }, [messages.length]);

  // Intelligent scroll management - only scroll when necessary
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const hasNewMessages = messages.length > lastMessagesLengthRef.current;

    if (!hasNewMessages || messages.length === 0) {
      lastMessagesLengthRef.current = messages.length;
      return;
    }

    // Check if we should auto-scroll
    const shouldAutoScroll = isNearBottomRef.current;

    if (shouldAutoScroll) {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Wait for DOM to update, then scroll
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom(true); // Smooth scroll for new messages
        setUnreadCount(0); // Reset unread count when scrolling to bottom

        // Double-check scroll position after animation
        setTimeout(() => {
          if (messagesContainer && isNearBottomRef.current) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 350); // After smooth scroll animation completes
      }, 50);
    } else {
      // User is scrolled up - increment unread count
      const newMessageCount = messages.length - lastMessagesLengthRef.current;
      setUnreadCount((prev) => prev + newMessageCount);
    }

    lastMessagesLengthRef.current = messages.length;
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

  // Handle ESC key press to exit chat
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (connectedUser) {
          // Exit the current chat
          leaveRoom?.();
        }
        // Return to home page
        router.push("/");
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleEscapeKey);

    // Cleanup event listener
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [connectedUser, leaveRoom, router]);

  // Handle Android back button to close keyboard first
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Check if keyboard is open (input is focused)
      const isKeyboardOpen = document.activeElement === messageInputRef.current;

      if (isKeyboardOpen && messageInputRef.current) {
        // Prevent navigation and close keyboard instead
        event.preventDefault();
        messageInputRef.current.blur();

        // Push a new state to keep user on the page
        window.history.pushState(null, "", window.location.href);
      }
    };

    // Push initial state for back button handling
    window.history.pushState(null, "", window.location.href);

    // Listen for back button
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const scrollToBottom = (smooth: boolean = true): void => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Use multiple methods to ensure reliable scrolling
    if (smooth) {
      // Smooth scroll using scrollIntoView
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    } else {
      // Instant scroll - more reliable
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  };

  // Check if user is near bottom of messages
  const checkIfNearBottom = (): void => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const autoScrollThreshold = 150; // pixels from bottom for auto-scroll
    const buttonThreshold = 50; // pixels from bottom to show button (more sensitive)

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    const isNearBottom = distanceFromBottom < autoScrollThreshold;
    const shouldShowButton = distanceFromBottom > buttonThreshold;

    isNearBottomRef.current = isNearBottom;

    // Show/hide scroll button - appears as soon as user scrolls up even slightly
    setShowScrollButton(shouldShowButton && messages.length > 0);

    // Reset unread count when user scrolls to bottom
    if (distanceFromBottom < buttonThreshold) {
      setUnreadCount(0);
    }
  };

  // Handle scroll events to track user position
  const handleScroll = (): void => {
    checkIfNearBottom();
  };

  // Scroll to bottom button handler
  const handleScrollToBottom = (): void => {
    isNearBottomRef.current = true;
    scrollToBottom(true);
    setUnreadCount(0);
    setShowScrollButton(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !connectedUser) return;

    sendMessage(messageInput.trim());
    setMessageInput("");
    stopTyping();

    setIsTypingMode(false);
    setScrollLocked(false);
    isNearBottomRef.current = true;

    // Aggressive scroll-to-bottom sequence for mobile
    const container = messagesContainerRef.current;
    if (container) {
      // Immediate scroll attempts
      const scrollToMax = () => {
        container.scrollTop = container.scrollHeight;
      };

      // Multiple scroll attempts with increasing delays
      scrollToMax();
      requestAnimationFrame(scrollToMax);

      const scrollDelays = [0, 50, 100, 200, 350, 500, 700];
      scrollDelays.forEach((delay) => {
        setTimeout(scrollToMax, delay);
      });

      // Final smooth scroll for UX
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }, 100);
    }

    // Keep keyboard open on mobile
    if (window.innerWidth <= 768 && messageInputRef.current) {
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 10);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setMessageInput(newValue);

    // Enable typing mode to prevent scrolling
    if (!isTypingMode && newValue.length > 0) {
      setIsTypingMode(true);
      setScrollLocked(true);
    }

    // Handle typing indicators without affecting scroll
    if (newValue.trim()) {
      startTyping();
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
        setIsTypingMode(false);
        setScrollLocked(false);
      }, 1500); // Longer timeout to prevent flickering
    } else {
      stopTyping();
      setIsTypingMode(false);
      setScrollLocked(false);
    }
  };

  // Handle input focus to ensure proper keyboard behavior
  const handleInputFocus = () => {
    // Enable typing mode to prevent scroll interference
    setIsTypingMode(true);
    setScrollLocked(true);

    // Mark that user is actively typing to prevent unwanted scrolling
    isNearBottomRef.current = true;

    // Mobile-specific handling
    if (window.innerWidth <= 768) {
      // Add keyboard-visible class for CSS targeting
      document.documentElement.classList.add("keyboard-visible");

      // Prevent any scroll adjustment during keyboard animation
      const container = messagesContainerRef.current;
      if (container) {
        // Store current scroll position to prevent jumping
        const currentScrollTop = container.scrollTop;

        // Temporarily lock scroll position during keyboard transition
        container.style.overflow = "hidden";
        container.scrollTop = currentScrollTop;

        // Re-enable scrolling after keyboard animation
        setTimeout(() => {
          container.style.overflow = "auto";
          // Only adjust if we were at bottom
          const isAtBottom =
            currentScrollTop + container.clientHeight >=
            container.scrollHeight - 10;
          if (isAtBottom) {
            container.scrollTop =
              container.scrollHeight - container.clientHeight;
          }
        }, 300);
      }
      return;
    }

    // Desktop behavior
    setTimeout(() => {
      if (messages.length > 0 && !scrollLocked) {
        const container = messagesContainerRef.current;
        if (container) {
          const isAtBottom =
            container.scrollHeight -
              container.scrollTop -
              container.clientHeight <
            50;
          if (isAtBottom) {
            container.scrollTop =
              container.scrollHeight - container.clientHeight;
          }
        }
      }
    }, 150);
  };

  // Handle input blur to re-enable scrolling
  const handleInputBlur = () => {
    // Remove keyboard-visible class
    document.documentElement.classList.remove("keyboard-visible");

    setTimeout(() => {
      if (messageInput.trim() === "") {
        setIsTypingMode(false);
        setScrollLocked(false);
      }

      // Mobile-specific cleanup
      if (window.innerWidth <= 768) {
        const container = messagesContainerRef.current;
        if (container) {
          // Ensure scrolling is re-enabled
          container.style.overflow = "auto";

          // Gentle scroll to bottom if needed
          setTimeout(() => {
            if (isNearBottomRef.current) {
              const isAtBottom =
                container.scrollHeight -
                  container.scrollTop -
                  container.clientHeight <
                50;
              if (!isAtBottom) {
                container.scrollTop =
                  container.scrollHeight - container.clientHeight;
              }
            }
          }, 100);
        }
      }
    }, 100);
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
              : 1
          )
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

  const handleExitChat = () => {
    if (connectedUser) {
      leaveRoom?.();
    }
    router.push("/");
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
    const currentUser = guestUser;

    // Handle system messages
    if (
      message.senderId === "system" ||
      message.type === "system" ||
      message.isSystemMessage
    ) {
      return (
        <motion.div
          key={index}
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
    const isOwn = message.senderId === currentUser?.id;
    const showAvatar =
      index === 0 || messages[index - 1]?.senderId !== message.senderId;
    const isNewSender =
      index > 0 && messages[index - 1]?.senderId !== message.senderId;

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`message-item flex gap-2 sm:gap-3 ${
          isOwn ? "flex-row-reverse" : "flex-row"
        } ${showAvatar ? "mt-3" : "mt-0.5"} ${isNewSender ? "new-sender" : ""}`}
      >
        {showAvatar && !isOwn && (
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
            <AvatarFallback className="bg-gray-600 text-white text-xs">
              {getInitials(message.senderUsername)}
            </AvatarFallback>
          </Avatar>
        )}
        {!showAvatar && !isOwn && <div className="w-7 sm:w-8 flex-shrink-0" />}

        <div
          className={`flex flex-col ${
            isOwn ? "items-end" : "items-start"
          } min-w-0 flex-1`}
        >
          {showAvatar && (
            <div
              className={`text-xs text-gray-500 mb-1 px-1 ${
                isOwn ? "text-right" : "text-left"
              }`}
            >
              <span className="font-medium">{message.senderUsername}</span>
            </div>
          )}

          <div
            className={`message-bubble rounded-2xl px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base ${
              isOwn
                ? "bg-blue-600 text-white rounded-br-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md"
            } ${
              message.type === "file" || message.type === "voice"
                ? "file-message"
                : ""
            }`}
          >
            {message.type === "text" && (
              <div className="message-content-wrapper">
                <p className="message-text break-words whitespace-pre-wrap">
                  {message.content}
                </p>
                <div className="message-status-time flex justify-between items-center gap-1 ">
                  <span className="text-[10px] sm:text-xs opacity-70">
                    {formatTime(message.timestamp)}
                  </span>
                  {message.status && isOwn && (
                    <span className="flex-shrink-0">
                      {message.status === "sending" && (
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70" />
                      )}
                      {message.status === "sent" && (
                        <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70" />
                      )}
                      {message.status === "delivered" && (
                        <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-90" />
                      )}
                      {message.status === "read" && (
                        <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-300" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {message.type === "file" && (
              <>
                {message.content.tempUrl && message.content.downloadUrl ? (
                  <div className="space-y-2">
                    <div className="file-preview-container">
                      <FilePreview
                        filename={message.content.filename || "Unknown file"}
                        tempUrl={message.content.tempUrl}
                        downloadUrl={message.content.downloadUrl}
                        fileType={message.content.fileType}
                        fileSize={message.content.fileSize}
                        isImage={message.content.isImage}
                        fileTypeCategory={message.content.fileTypeCategory}
                        expiresAt={message.content.expiresAt}
                        className="max-w-full"
                      />
                    </div>
                    <div className="flex justify-between items-center ">
                      <span className="text-[10px] sm:text-xs opacity-70">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.status && isOwn && (
                        <>
                          {message.status === "sending" && (
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70" />
                          )}
                          {message.status === "sent" && (
                            <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70" />
                          )}
                          {message.status === "delivered" && (
                            <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-90" />
                          )}
                          {message.status === "read" && (
                            <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-300" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-100 border border-red-300 rounded">
                    <p className="text-red-700 text-sm">File unavailable</p>
                  </div>
                )}
              </>
            )}

            {message.type === "voice" && (
              <>
                <div className="space-y-2">
                  {message.content.tempUrl && (
                    <audio
                      controls
                      className="max-w-full"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    >
                      <source
                        src={message.content.tempUrl}
                        type={message.content.fileType || "audio/mpeg"}
                      />
                    </audio>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Mic className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs opacity-75 truncate">
                          {message.content.duration
                            ? `${message.content.duration}s`
                            : "Voice message"}
                        </p>
                      </div>
                    </div>

                    {message.content.downloadUrl && (
                      <a
                        href={message.content.downloadUrl}
                        download={message.content.filename}
                        className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 flex-shrink-0"
                      >
                        ↓
                      </a>
                    )}
                  </div>

                  <div className="flex justify-between items-center ">
                    <span className="text-[10px] sm:text-xs opacity-70">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.status && isOwn && (
                      <>
                        {message.status === "sending" && (
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70" />
                        )}
                        {message.status === "sent" && (
                          <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70" />
                        )}
                        {message.status === "delivered" && (
                          <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-90" />
                        )}
                        {message.status === "read" && (
                          <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-300" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Show loading state while guest session is being initialized
  if (!guestUser && !showUsernameModal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Preparing your chat session...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="chat-container mobile-screen bg-white dark:bg-gray-900">
        {/* Connection Status Banner */}
        {!isConnected && guestUser && (
          <div className="bg-red-100 dark:bg-red-900 border-b border-red-200 dark:border-red-800 px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-red-800 dark:text-red-200">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm">Connection lost - Reconnecting...</span>
            </div>
          </div>
        )}

        {/* Session Regeneration Banner */}
        {isRegenerating && (
          <div className="bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-yellow-800 dark:text-yellow-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Reconnecting session...</span>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b bg-white dark:bg-gray-900 px-2 py-2 sm:px-4 sm:py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 sm:h-9 sm:w-9 p-0 flex-shrink-0"
                onClick={() => {
                  leaveRoom?.();
                  router.push("/");
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              {connectedUser ? (
                <>
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {getInitials(connectedUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {connectedUser.username}
                    </h2>
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      <span>Online</span>
                      {connectedUser.location && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <MapPin className="w-3 h-3 hidden sm:inline" />
                          <span className="hidden sm:inline text-xs">
                            {connectedUser.location.city}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Chat
                  </h2>
                  <p className="text-xs text-gray-500">
                    {isConnected ? "Ready to connect" : "Connecting..."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {connectedUser && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAudioCall}
                    disabled={isCallActive}
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                    title="Audio Call"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleVideoCall}
                    disabled={isCallActive}
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExitChat}
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Exit Chat (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                  >
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
                    <DropdownMenuItem
                      onClick={handleExitChat}
                      className="text-red-600 dark:text-red-400"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Exit Chat (ESC)
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className={`chat-messages message-list ${
            scrollLocked ? "scroll-locked" : ""
          } ${isTypingMode ? "typing-mode" : ""}`}
          onScroll={scrollLocked ? undefined : handleScroll}
        >
          {!connectedUser && !isMatching && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 px-4"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Ready to Chat?
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                Find a random person to start chatting with
              </p>
              <Button
                onClick={requestMatch}
                disabled={isMatching}
                className="text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
              >
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
              className="flex gap-3 mb-6 pb-3" // Balanced spacing
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
          {/* <div ref={messagesEndRef} className="h-12 sm:h-14" />{" "} */}
          {/* 56px on mobile, 48px on desktop */} {/* Taller on mobile */}
          {/* Scroll to Bottom Button - WhatsApp Style */}
          {showScrollButton && connectedUser && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={handleScrollToBottom}
              className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 z-50 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 rounded-full shadow-lg p-3 transition-all duration-150 border border-gray-200 dark:border-gray-700"
              style={{
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              }}
              aria-label="Scroll to bottom"
            >
              <div className="relative">
                <ChevronDown className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-md"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.span>
                )}
              </div>
            </motion.button>
          )}
        </div>

        {/* Keyboard Shortcut Hint - only show when connected */}
        {connectedUser && (
          <div className="px-3 py-1 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              Press{" "}
              <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded">
                ESC
              </kbd>{" "}
              to exit chat
            </p>
          </div>
        )}

        {/* Input Area */}
        {connectedUser && (
          <div className="chat-input-area chat-input-container">
            {fileUpload && (
              <div className="mb-2 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Paperclip className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-blue-600 truncate">
                      {fileUpload.file.name}
                    </span>
                  </div>
                  {fileUpload.uploading && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                  )}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-1 sm:gap-2"
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
                className="h-9 w-9 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!fileUpload}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <div className="flex-1 relative min-w-0">
                <Input
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Message..."
                  className="chat-input pr-10 h-9 sm:h-10 text-sm"
                  disabled={!!fileUpload}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  style={{
                    fontSize: "16px", // Prevent zoom on iOS Safari
                    WebkitAppearance: "none",
                    borderRadius: "8px",
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
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
                size="sm"
                className="h-9 w-9 sm:h-10 sm:w-10 p-0 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}

        {/* Matching Dialog */}
        <Dialog
          open={showMatchDialog}
          onOpenChange={(open) => {
            setShowMatchDialog(open);
            // Redirect to home when dialog closes
            if (!open) {
              router.push("/");
            }
          }}
        >
          <DialogContent className="sm:max-w-md w-[90vw] sm:w-full !rounded-xl">
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
          currentUserId={guestUser?.username}
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

      {/* Username Modal */}
      <GuestUsernameModal
        isOpen={showUsernameModal}
        onComplete={handleUsernameComplete}
      />
    </>
  );
}
