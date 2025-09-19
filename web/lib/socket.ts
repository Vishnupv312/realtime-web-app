import { io, type Socket } from "socket.io-client"
import Cookies from "js-cookie"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3005"
console.log('Socket URL:', SOCKET_URL)
console.log('Environment SOCKET_URL:', process.env.NEXT_PUBLIC_SOCKET_URL)

class SocketService {
  private socket: Socket | null = null
  public isConnected = false

  connect(): Socket {
    const token = Cookies.get("authToken") || localStorage.getItem("authToken")

    if (!token) {
      throw new Error("No authentication token found")
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    this.setupEventListeners()
    return this.socket
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on("connect", () => {
      console.log("Connected to server")
      this.isConnected = true
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server")
      this.isConnected = false
    })

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message)
      this.isConnected = false
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
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

  // Typing indicators
  startTyping(): void {
    this.socket?.emit("chat:typing:start")
  }

  stopTyping(): void {
    this.socket?.emit("chat:typing:stop")
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
