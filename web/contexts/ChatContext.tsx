"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import socketService from "@/lib/socket"
import { useAuth } from "./AuthContext"

interface ConnectedUser {
  id: string
  username: string
  deviceId: string
  location?: {
    country: string
    city: string
  }
  ip?: string
}

interface Message {
  id: string
  senderId: string
  senderUsername: string
  type: "text" | "file" | "voice"
  content:
    | string
    | {
        // File/voice content structure matching backend response
        fileId?: string
        filename: string
        fileType?: string
        fileSize?: number
        tempUrl?: string
        downloadUrl?: string
        isImage?: boolean
        fileTypeCategory?: string
        expiresAt?: string
        duration?: number // For voice messages
      }
  timestamp: string
  status?: "sending" | "sent" | "delivered"
}

interface ChatContextType {
  isConnected: boolean
  connectedUser: ConnectedUser | null
  messages: Message[]
  isTyping: boolean
  isMatching: boolean
  requestMatch: () => void
  cancelMatch: () => void
  sendMessage: (content: string | any, type?: "text" | "file" | "voice") => void
  clearChat: () => void
  startTyping: () => void
  stopTyping: () => void
  leaveRoom: () => void
  getCurrentRoomId: () => string | null
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  
  // Persist connectedUser in sessionStorage to survive hot reloads
  const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('chat_connected_user')
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          console.error('Failed to parse stored connected user:', e)
        }
      }
    }
    return null
  })
  
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  
  // Save connectedUser to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (connectedUser) {
        sessionStorage.setItem('chat_connected_user', JSON.stringify(connectedUser))
      } else {
        sessionStorage.removeItem('chat_connected_user')
      }
    }
  }, [connectedUser])

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket()
    }

    return () => {
      socketService.disconnect()
    }
  }, [isAuthenticated, user])

  const connectSocket = (): void => {
    try {
      console.log("🔌 Attempting to connect socket...")
      socketService.connect()
      setupSocketListeners()
      console.log("✅ Socket connection initiated")
    } catch (error) {
      console.error("❌ Failed to connect socket:", error)
    }
  }

  const setupSocketListeners = (): void => {
    // Connection events
    socketService.on("connection:established", (data) => {
      console.log("🎉 Socket connected successfully:", data)
      setIsConnected(true)
      console.log("✅ isConnected state set to true")
    })

    // User matching events
    socketService.on("user:match:searching", (data) => {
      console.log("Searching for users:", data.message)
      setIsMatching(true)
    })
    
    socketService.on("user:matched", (data) => {
      console.log("🎉 MATCH RECEIVED:", data)
      console.log("👤 Matched user data:", data.matchedUser)
      console.log("🆔 Room ID:", data.roomId)
      
      if (!data.matchedUser) {
        console.error("❌ No matched user data received!")
        return
      }
      
      // Ensure the matched user data has all required fields
      const validMatchedUser = {
        id: data.matchedUser.id || data.matchedUser._id,
        username: data.matchedUser.username,
        deviceId: data.matchedUser.deviceId || null,
        location: data.matchedUser.location || null,
        ip: data.matchedUser.ip || null
      }
      
      console.log("✅ Setting connected user to:", validMatchedUser)
      
      // Update states in batch
      setConnectedUser(validMatchedUser)
      setIsMatching(false)
      clearChatHistory()
      
      console.log("🎉 Match processing complete!")
    })

    socketService.on("user:match:no_users", (data) => {
      console.log("No users available:", data.message)
      // Don't set isMatching to false here, as the user is still searching
      // The backend will keep them in searching state until they cancel or find a match
    })

    socketService.on("user:match:error", (data) => {
      console.error("Matching error:", data.message)
      setIsMatching(false)
    })
    
    socketService.on("user:match:cancelled", (data) => {
      console.log("Matching cancelled:", data.message)
      setIsMatching(false)
    })

    // Chat events
    socketService.on("chat:message", (message) => {
      console.log("New message:", message)
      addMessage(message)
      
      // Send delivery confirmation
      if (message.id && message.senderId !== user?.id) {
        socketService.confirmMessageDelivered(message.id)
      }
    })

    socketService.on("chat:message:sent", (data) => {
      console.log("Message sent:", data)
      // Find the temporary message by timestamp and update its ID and status
      setMessages((prev) => prev.map((msg) => {
        // Check if this is a temporary message that was just sent
        if (msg.id.startsWith('temp_') && msg.status === 'sending') {
          // Update the message with the confirmed ID and status
          return { ...msg, id: data.messageId, status: 'sent' }
        }
        return msg
      }))
    })
    
    socketService.on("chat:message:delivered", (data) => {
      console.log("Message delivered:", data)
      // Update the message status to delivered
      setMessages((prev) => prev.map((msg) => {
        if (msg.id === data.messageId) {
          return { ...msg, status: 'delivered' }
        }
        return msg
      }))
    })

    socketService.on("chat:cleared", (data) => {
      console.log("Chat cleared by other user:", data)
      clearChatHistory()
      setConnectedUser(null)
    })

    socketService.on("user:disconnected", (data) => {
      console.log("User disconnected:", data)
      
      // Add system message about user leaving
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: `${connectedUser?.username || 'Your chat partner'} has left the chat. The room will be closed.`,
        timestamp: new Date().toISOString(),
        status: "delivered"
      }
      addMessage(systemMessage)
      
      // Close the room after a short delay to allow reading the message
      setTimeout(() => {
        setConnectedUser(null)
        clearChatHistory()
      }, 5000)
    })

    // Handle room closing events
    socketService.on("room:closed", (data) => {
      console.log("Room closed:", data)
      
      // Add system message about room closure
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: data.message || "The other user has left. Room closed.",
        timestamp: new Date().toISOString(),
        status: "delivered"
      }
      addMessage(systemMessage)
      
      // Immediately close the room and redirect to dashboard
      setTimeout(() => {
        setConnectedUser(null)
        clearChatHistory()
        // Redirect to dashboard/home page
        window.location.href = "/dashboard"
      }, 2000) // 2 second delay to show message
    })
    
    // Room events
    socketService.on("room:user_joined", (data) => {
      console.log("User joined room:", data)
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: data.message || `${data.username} has joined the chat`,
        timestamp: new Date().toISOString(),
        status: "delivered"
      }
      addMessage(systemMessage)
    })
    
    socketService.on("room:user_left", (data) => {
      console.log("User left room:", data)
      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        senderId: "system",
        senderUsername: "System",
        type: "text",
        content: data.message || `${data.username} has left the chat`,
        timestamp: new Date().toISOString(),
        status: "delivered"
      }
      addMessage(systemMessage)
    })

    // Typing events
    socketService.on("chat:typing:start", (data) => {
      console.log("User started typing:", data)
      setIsTyping(true)
    })

    socketService.on("chat:typing:stop", (data) => {
      console.log("User stopped typing:", data)
      setIsTyping(false)
    })

    // Error events
    socketService.on("chat:error", (error) => {
      console.error("Chat error:", error.message)
    })
  }

  const requestMatch = (): void => {
    // The isMatching state will be set when we receive the user:match:searching event
    socketService.requestMatch()
  }

  const cancelMatch = (): void => {
    socketService.cancelMatch()
  }

  const sendMessage = (content: string | any, type: "text" | "file" | "voice" = "text"): void => {
    if (!user) return

    const message: Message = {
      type,
      content,
      timestamp: new Date().toISOString(),
      id: `temp_${Date.now()}`,
      senderId: user.id,
      senderUsername: user.username,
      status: "sending",
    }

    addMessage(message)
    socketService.sendMessage(message)
  }

  const clearChat = (): void => {
    console.log('🧹 Clearing chat')
    socketService.clearChat()
    clearChatHistory()
    setConnectedUser(null)
  }

  const leaveRoom = (): void => {
    console.log('🚪 Leaving room')
    socketService.leaveRoom()
    clearChatHistory()
    setConnectedUser(null)
    // Also clear from sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('chat_connected_user')
    }
  }

  const addMessage = (message: Message): void => {
    setMessages((prev) => [...prev, message])
    saveChatHistory(message)
  }

  const updateMessageStatus = (messageId: string, status: "sending" | "sent" | "delivered"): void => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg)))
  }

  const clearChatHistory = (): void => {
    setMessages([])
    if (user && connectedUser) {
      const chatKey = `chat_${user.id}_${connectedUser.id}`
      localStorage.removeItem(chatKey)
    }
  }

  const saveChatHistory = (message: Message): void => {
    if (user && connectedUser) {
      const chatKey = `chat_${user.id}_${connectedUser.id}`
      const existingMessages = JSON.parse(localStorage.getItem(chatKey) || "[]")
      existingMessages.push(message)
      localStorage.setItem(chatKey, JSON.stringify(existingMessages))
    }
  }

  const getCurrentRoomId = (): string | null => {
    if (!user || !connectedUser) return null
    
    // Generate room ID the same way as the backend
    return [user.id, connectedUser.id].sort().join('_')
  }

  const value: ChatContextType = {
    isConnected,
    connectedUser,
    messages,
    isTyping,
    isMatching,
    requestMatch,
    cancelMatch,
    sendMessage,
    clearChat,
    startTyping: () => socketService.startTyping(),
    stopTyping: () => socketService.stopTyping(),
    leaveRoom,
    getCurrentRoomId,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
