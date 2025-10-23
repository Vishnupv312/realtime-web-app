import { io, type Socket } from "socket.io-client"
import Cookies from "js-cookie"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
console.log('🔧 Socket URL:', SOCKET_URL)
console.log('🔧 Environment SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL)

interface GuestUser {
  id: string
  username: string
  deviceId: string
  isGuest: boolean
}

class SocketService {
  private socket: Socket | null = null
  public isConnected = false
  private connectionCallbacks: ((connected: boolean) => void)[] = []
  private currentUser: any = null

  connect(guestUser?: GuestUser): Socket {
    // Try to get token from different sources
    const regularToken = Cookies.get("authToken") || localStorage.getItem("authToken")
    const guestToken = sessionStorage.getItem("guestAuthToken")
    
    // Prioritize regular auth token, fallback to guest token
    const token = regularToken || guestToken

    // For guest-only app, we need either a JWT token or guest user data
    if (!token) {
      console.error("❌ No JWT authentication token found")
      throw new Error("Authentication token required. Please create a guest session first.")
    }

    console.log("🔌 Attempting to connect to:", SOCKET_URL)
    console.log("🔑 Using auth token:", token ? `${token.substring(0, 10)}...` : "None")
    console.log("👤 Guest user:", guestUser ? guestUser.username : "From JWT token")

    // Store current user for presence management
    this.currentUser = guestUser || null

    // Disconnect existing socket if any
    if (this.socket) {
      this.socket.disconnect()
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: token, // Use JWT token for authentication (required by backend)
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true
    })

    this.setupEventListeners()
    return this.socket
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on("connect", () => {
      console.log("✅ Successfully connected to server:", SOCKET_URL)
      console.log("🎉 Socket ID:", this.socket?.id)
      this.isConnected = true
      this.notifyConnectionChange(true)
      
      // Emit presence update on connection
      if (this.currentUser) {
        this.registerGuestUser(this.currentUser)
      }
      this.updateOnlineStatus(true)
    })

    this.socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected from server. Reason:", reason)
      this.isConnected = false
      this.notifyConnectionChange(false)
      
      // Update presence on disconnect
      this.updateOnlineStatus(false)
    })

    this.socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", {
        message: error.message,
        description: error.description,
        context: error.context,
        type: error.type
      })
      this.isConnected = false
      this.notifyConnectionChange(false)
    })
    
    this.socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconnected after", attemptNumber, "attempts")
      this.isConnected = true
      this.notifyConnectionChange(true)
    })
    
    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Reconnection attempt #", attemptNumber)
    })
    
    this.socket.on("reconnect_error", (error) => {
      console.error("❌ Reconnection error:", error.message)
    })
    
    this.socket.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect after all attempts")
      this.isConnected = false
      this.notifyConnectionChange(false)
    })
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected)
      } catch (error) {
        console.error('Error in connection callback:', error)
      }
    })
  }

  // Connection status methods
  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.push(callback)
    // Return unsubscribe function
    return () => {
      const index = this.connectionCallbacks.indexOf(callback)
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1)
      }
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      this.notifyConnectionChange(false)
    }
  }

  // User matching
  requestMatch(): void {
    this.socket?.emit("user:match")
  }

  cancelMatch(): void {
    this.socket?.emit("user:match:cancel")
  }

  // Chat methods
  sendMessage(message: any): void {
    this.socket?.emit("chat:message", message)
  }

  clearChat(): void {
    this.socket?.emit("chat:clear")
  }

  // Room management
  leaveRoom(): void {
    this.socket?.emit("leave-room")
  }

  closeRoom(): void {
    this.socket?.emit("close-room")
  }
  
  // Message status confirmation
  confirmMessageDelivered(messageId: string): void {
    this.socket?.emit("chat:message:delivered", { messageId })
  }

  // WebRTC methods
  sendOffer(offer: RTCSessionDescriptionInit, type: string): void {
    this.socket?.emit("webrtc:offer", { offer, type })
  }

  sendAnswer(answer: RTCSessionDescriptionInit): void {
    this.socket?.emit("webrtc:answer", { answer })
  }

  sendIceCandidate(candidate: RTCIceCandidate): void {
    this.socket?.emit("webrtc:ice-candidate", { candidate })
  }

  sendCallEnd(): void {
    this.socket?.emit("webrtc:call-end")
  }

  sendCallReject(): void {
    this.socket?.emit("webrtc:call-reject")
  }

  sendCallTimeout(): void {
    this.socket?.emit("webrtc:call-timeout")
  }

  // Typing indicators
  startTyping(): void {
    this.socket?.emit("chat:typing:start")
  }

  stopTyping(): void {
    this.socket?.emit("chat:typing:stop")
  }

  // Real-time Presence Management
  updateOnlineStatus(isOnline: boolean): void {
    this.socket?.emit("presence:online", { isOnline, timestamp: new Date().toISOString() })
  }

  updateSearchingStatus(isSearching: boolean): void {
    this.socket?.emit("presence:searching", { isSearching })
  }

  requestPresenceUpdate(): void {
    this.socket?.emit("presence:request_update")
  }

  // Get real-time stats
  requestStats(): void {
    this.socket?.emit("stats:request")
  }

  requestOnlineUsers(): void {
    this.socket?.emit("users:online:request")
  }

  // Guest session management
  registerGuestUser(guestUser: GuestUser): void {
    this.socket?.emit("guest:register", guestUser)
  }

  updateGuestUser(updates: Partial<GuestUser>): void {
    this.socket?.emit("guest:update", updates)
  }

  // Heartbeat for presence
  sendHeartbeat(): void {
    this.socket?.emit("presence:heartbeat", { timestamp: new Date().toISOString() })
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback)
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback)
  }
}

const socketService = new SocketService()
export default socketService
