"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import socketService from "@/lib/socket";
import { useGuestSession } from "./GuestSessionContext";
import { usePageVisibility } from "@/hooks/usePageVisibility";

interface ConnectedUser {
  id: string;
  username: string;
  deviceId: string;
  location?: {
    country: string;
    city: string;
  };
  ip?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderUsername: string;
  type: "text" | "file" | "voice" | "system";
  content:
    | string
    | {
        // File/voice content structure matching backend response
        fileId?: string;
        filename: string;
        fileType?: string;
        fileSize?: number;
        tempUrl?: string;
        downloadUrl?: string;
        isImage?: boolean;
        fileTypeCategory?: string;
        expiresAt?: string;
        duration?: number; // For voice messages
      };
  timestamp: string;
  status?: "sending" | "sent" | "delivered";
  isSystemMessage?: boolean; // For system-generated messages like call logs
}

interface ChatContextType {
  isConnected: boolean;
  connectedUser: ConnectedUser | null;
  messages: Message[];
  isTyping: boolean;
  isMatching: boolean;
  requestMatch: () => void;
  cancelMatch: () => void;
  sendMessage: (
    content: string | any,
    type?: "text" | "file" | "voice" | "system"
  ) => void;
  addSystemMessage: (content: string) => void;
  clearChat: () => void;
  startTyping: () => void;
  stopTyping: () => void;
  leaveRoom: () => void;
  getCurrentRoomId: () => string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { guestUser, isGuestSession } = useGuestSession();
  const { isVisible, wasHiddenDuration } = usePageVisibility();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReconnectAttemptRef = useRef<number>(0);

  // Persist connectedUser in sessionStorage to survive hot reloads
  const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(
    () => {
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("chat_connected_user");
        if (stored) {
          try {
            return JSON.parse(stored);
          } catch (e) {
            console.error("Failed to parse stored connected user:", e);
          }
        }
      }
      return null;
    }
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  // Save connectedUser to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (connectedUser) {
        sessionStorage.setItem(
          "chat_connected_user",
          JSON.stringify(connectedUser)
        );
      } else {
        sessionStorage.removeItem("chat_connected_user");
      }
    }
  }, [connectedUser]);

  useEffect(() => {
    // Connect socket for guest users only
    if (isGuestSession && guestUser) {
      connectSocket();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isGuestSession, guestUser]);

  // Monitor socket connection status changes
  useEffect(() => {
    const unsubscribe = socketService.onConnectionChange((connected) => {
      console.log(
        `🔌 Connection status changed: ${
          connected ? "Connected" : "Disconnected"
        }`
      );
      setIsConnected(connected);
    });

    // Set initial connection status
    setIsConnected(socketService.getConnectionStatus());

    return unsubscribe;
  }, []);

  // Handle reconnection after wake from sleep or tab becoming visible
  useEffect(() => {
    if (!isVisible || !isGuestSession || !guestUser) return;

    // If page was hidden for more than 10 seconds, might have missed disconnect events
    if (wasHiddenDuration > 10000) {
      console.log(
        `🔄 Page visible after ${Math.round(
          wasHiddenDuration / 1000
        )}s - reconnecting...`
      );

      // If user was in a chat, clear it since the other user likely disconnected
      if (connectedUser) {
        console.log("🧹 Clearing stale chat session after disconnect period");
        setConnectedUser(null);
        clearChatHistory();
        sessionStorage.removeItem("chat_connected_user");

        // Mark that we need to redirect
        sessionStorage.setItem("was_disconnected", "true");
      }

      // Throttle reconnection attempts
      const now = Date.now();
      if (now - lastReconnectAttemptRef.current < 5000) {
        console.log("⏳ Skipping reconnect - too soon after last attempt");
        return;
      }
      lastReconnectAttemptRef.current = now;

      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Check if we're actually disconnected
      if (!socketService.getConnectionStatus()) {
        console.log("🔄 Attempting to reconnect socket...");

        // Disconnect and reconnect cleanly
        socketService.disconnect();

        // Small delay to ensure clean disconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSocket();
        }, 500);
      } else {
        console.log("✅ Socket already connected");
      }
    }
  }, [isVisible, wasHiddenDuration, isGuestSession, guestUser, connectedUser]);

  // Cleanup reconnection timeout on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle network connectivity changes
  useEffect(() => {
    if (!isGuestSession || !guestUser) return;

    const handleOnline = () => {
      console.log("🌐 Network is back online");

      // Check if socket is disconnected
      if (!socketService.getConnectionStatus()) {
        console.log("🔄 Reconnecting after network restoration...");

        // Throttle reconnection
        const now = Date.now();
        if (now - lastReconnectAttemptRef.current < 3000) {
          return;
        }
        lastReconnectAttemptRef.current = now;

        // Attempt to reconnect
        setTimeout(() => {
          socketService.disconnect();
          connectSocket();
        }, 1000);
      }
    };

    const handleOffline = () => {
      console.log("📵 Network is offline");
      setIsConnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check current network status on mount
    if (typeof window !== "undefined" && !navigator.onLine) {
      console.log("📵 Starting in offline mode");
      setIsConnected(false);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isGuestSession, guestUser]);

  const connectSocket = (): void => {
    try {
      console.log("🔌 Attempting to connect socket...");

      // Pass guest user data if available
      const socketGuestUser = guestUser
        ? {
            id: guestUser.id,
            username: guestUser.username,
            deviceId: guestUser.deviceId,
            isGuest: true,
          }
        : undefined;

      socketService.connect(socketGuestUser);
      setupSocketListeners();
      console.log("✅ Socket connection initiated");
    } catch (error) {
      console.error("❌ Failed to connect socket:", error);
    }
  };

  const setupSocketListeners = (): void => {
    // Remove all previous listeners to prevent duplicates
    console.log("🧹 Cleaning up old socket listeners");
    const events = [
      "connection:established",
      "user:match:searching",
      "user:matched",
      "user:match:no_users",
      "user:match:error",
      "user:match:cancelled",
      "chat:message",
      "chat:message:sent",
      "chat:message:delivered",
      "chat:cleared",
      "user:disconnected",
      "room:closed",
      "room:user_joined",
      "room:user_left",
      "chat:typing:start",
      "chat:typing:stop",
      "chat:error",
      "presence:user_online",
      "presence:user_offline",
      "presence:searching_started",
      "presence:searching_stopped",
      "stats:update",
      "users:online:update",
    ];

    events.forEach((event) => socketService.off(event));

    console.log("✅ Old listeners removed, setting up new ones");

    // Note: Connection status is now handled via the socket service callback system

    // Custom connection established event (if backend sends it)
    socketService.on("connection:established", (data) => {
      console.log("🎉 Socket connection established:", data);
    });

    // User matching events
    socketService.on("user:match:searching", (data) => {
      console.log("Searching for users:", data.message);
      setIsMatching(true);
    });

    socketService.on("user:matched", (data) => {
      console.log("🎉 MATCH RECEIVED:", data);
      console.log("👤 Matched user data:", data.matchedUser);
      console.log("🆔 Room ID:", data.roomId);

      if (!data.matchedUser) {
        console.error("❌ No matched user data received!");
        return;
      }

      // Ensure the matched user data has all required fields
      const validMatchedUser = {
        id: data.matchedUser.id || data.matchedUser._id,
        username: data.matchedUser.username,
        deviceId: data.matchedUser.deviceId || null,
        location: data.matchedUser.location || null,
        ip: data.matchedUser.ip || null,
      };

      console.log("✅ Setting connected user to:", validMatchedUser);

      // Update states in batch
      setConnectedUser(validMatchedUser);
      setIsMatching(false);
      clearChatHistory();

      console.log("🎉 Match processing complete!");
    });

    socketService.on("user:match:no_users", (data) => {
      console.log("No users available:", data.message);
      // Don't set isMatching to false here, as the user is still searching
      // The backend will keep them in searching state until they cancel or find a match
    });

    socketService.on("user:match:error", (data) => {
      console.error("Matching error:", data.message);
      setIsMatching(false);
    });

    socketService.on("user:match:cancelled", (data) => {
      console.log("Matching cancelled:", data.message);
      setIsMatching(false);
    });

    // Chat events
    socketService.on("chat:message", (message) => {
      console.log("New message:", message);
      addMessage(message);

      // Send delivery confirmation
      if (message.id && message.senderId !== guestUser?.id) {
        socketService.confirmMessageDelivered(message.id);
      }
    });

    socketService.on("chat:message:sent", (data) => {
      console.log("Message sent:", data);
      // Find the temporary message by timestamp and update its ID and status
      setMessages((prev) =>
        prev.map((msg) => {
          // Check if this is a temporary message that was just sent
          if (msg.id.startsWith("temp_") && msg.status === "sending") {
            // Update the message with the confirmed ID and status
            return { ...msg, id: data.messageId, status: "sent" };
          }
          return msg;
        })
      );
    });

    socketService.on("chat:message:delivered", (data) => {
      console.log("Message delivered:", data);
      // Update the message status to delivered
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            return { ...msg, status: "delivered" };
          }
          return msg;
        })
      );
    });

    socketService.on("chat:cleared", (data) => {
      console.log("Chat cleared by other user:", data);
      clearChatHistory();
      setConnectedUser(null);
    });

    socketService.on("user:disconnected", (data) => {
      console.log("User disconnected:", data);

      // Add system message about user leaving
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: `${
          connectedUser?.username || "Your chat partner"
        } has left the chat. The room will be closed.`,
        timestamp: new Date().toISOString(),
        status: "delivered",
      };
      addMessage(systemMessage);

      // Close the room after a short delay to allow reading the message
      setTimeout(() => {
        setConnectedUser(null);
        clearChatHistory();
      }, 5000);
    });

    // Handle room closing events
    socketService.on("room:closed", (data) => {
      console.log("🚪 Room closed:", data);

      // Add system message about room closure
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: data.message || "The other user has left. Room closed.",
        timestamp: new Date().toISOString(),
        status: "delivered",
      };
      addMessage(systemMessage);

      // Clear chat state immediately
      setConnectedUser(null);
      clearChatHistory();
      sessionStorage.removeItem("chat_connected_user");
      sessionStorage.removeItem("was_disconnected");

      // Redirect to home after brief delay to show message
      setTimeout(() => {
        window.location.href = "/";
      }, 1500); // 1.5 second delay to show message
    });

    // Room events
    socketService.on("room:user_joined", (data) => {
      console.log("User joined room:", data);
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: data.message || `${data.username} has joined the chat`,
        timestamp: new Date().toISOString(),
        status: "delivered",
      };
      addMessage(systemMessage);
    });

    socketService.on("room:user_left", (data) => {
      console.log("User left room:", data);
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: data.message || `${data.username} has left the chat`,
        timestamp: new Date().toISOString(),
        status: "delivered",
      };
      addMessage(systemMessage);
    });

    // Typing events
    socketService.on("chat:typing:start", (data) => {
      console.log("User started typing:", data);
      setIsTyping(true);
    });

    socketService.on("chat:typing:stop", (data) => {
      console.log("User stopped typing:", data);
      setIsTyping(false);
    });

    // Error events
    socketService.on("chat:error", (error) => {
      console.error("Chat error:", error.message);
    });

    // Real-time presence events
    socketService.on("presence:user_online", (data) => {
      console.log("User came online:", data);
      // Update user presence in real-time
    });

    socketService.on("presence:user_offline", (data) => {
      console.log("User went offline:", data);
      // Update user presence in real-time
    });

    socketService.on("presence:searching_started", (data) => {
      console.log("User started searching:", data);
      // Update searching status in real-time
    });

    socketService.on("presence:searching_stopped", (data) => {
      console.log("User stopped searching:", data);
      // Update searching status in real-time
    });

    // Real-time stats and user list updates (handled by GuestSessionContext)
    socketService.on("stats:update", (stats) => {
      console.log("Real-time stats update:", stats);
    });

    socketService.on("users:online:update", (users) => {
      console.log("Real-time online users update:", users);
    });
  };

  const requestMatch = (): void => {
    // The isMatching state will be set when we receive the user:match:searching event
    socketService.requestMatch();

    // Emit searching status
    socketService.updateSearchingStatus(true);
  };

  const cancelMatch = (): void => {
    socketService.cancelMatch();

    // Emit searching status
    socketService.updateSearchingStatus(false);
  };

  const sendMessage = (
    content: string | any,
    type: "text" | "file" | "voice" = "text"
  ): void => {
    if (!guestUser) return;

    const message: Message = {
      type,
      content,
      timestamp: new Date().toISOString(),
      id: `temp_${Date.now()}`,
      senderId: guestUser.id,
      senderUsername: guestUser.username,
      status: "sending",
    };

    addMessage(message);
    socketService.sendMessage(message);
  };

  const clearChat = (): void => {
    console.log("🧹 Clearing chat");
    socketService.clearChat();
    clearChatHistory();
    setConnectedUser(null);
  };

  const leaveRoom = (): void => {
    console.log("🚪 Leaving room");
    socketService.leaveRoom();
    clearChatHistory();
    setConnectedUser(null);
    // Also clear from sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chat_connected_user");
    }
  };

  const addMessage = (message: Message): void => {
    setMessages((prev) => [...prev, message]);
    saveChatHistory(message);
  };

  const addSystemMessage = (content: string): void => {
    const systemMessage: Message = {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: "system",
      senderUsername: "System",
      type: "system",
      content,
      timestamp: new Date().toISOString(),
      isSystemMessage: true,
    };
    addMessage(systemMessage);
  };

  const updateMessageStatus = (
    messageId: string,
    status: "sending" | "sent" | "delivered"
  ): void => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg))
    );
  };

  const clearChatHistory = (): void => {
    setMessages([]);
    if (guestUser && connectedUser) {
      const chatKey = `chat_${guestUser.id}_${connectedUser.id}`;
      // Guest users always use sessionStorage
      sessionStorage.removeItem(chatKey);
    }
  };

  const saveChatHistory = (message: Message): void => {
    if (guestUser && connectedUser) {
      const chatKey = `chat_${guestUser.id}_${connectedUser.id}`;
      // Guest users always use sessionStorage
      const existingMessages = JSON.parse(
        sessionStorage.getItem(chatKey) || "[]"
      );
      existingMessages.push(message);
      sessionStorage.setItem(chatKey, JSON.stringify(existingMessages));
    }
  };

  const getCurrentRoomId = (): string | null => {
    if (!guestUser || !connectedUser) return null;

    // Generate room ID the same way as the backend
    return [guestUser.id, connectedUser.id].sort().join("_");
  };

  const value: ChatContextType = {
    isConnected,
    connectedUser,
    messages,
    isTyping,
    isMatching,
    requestMatch,
    cancelMatch,
    sendMessage,
    addSystemMessage,
    clearChat,
    startTyping: () => socketService.startTyping(),
    stopTyping: () => socketService.stopTyping(),
    leaveRoom,
    getCurrentRoomId,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
