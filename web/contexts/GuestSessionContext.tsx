"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { v4 as uuidv4 } from "uuid"
import socketService from "@/lib/socket"
import { guestAPI, setSessionRegenerationCallback } from "@/lib/api"

interface GuestUser {
  id: string
  username: string
  isOnline: boolean
  lastSeen: string
  socketId?: string
  connectedUser?: GuestUser | null
  deviceId: string
  location?: {
    country: string
    city: string
  }
  ip?: string
  isSearching: boolean
}

interface GuestSessionContextType {
  guestUser: GuestUser | null
  isGuestSession: boolean
  isRegenerating: boolean
  initializeGuestSession: (username?: string) => Promise<void>
  updateGuestUser: (updates: Partial<GuestUser>) => void
  setOnlineStatus: (isOnline: boolean) => void
  setSearchingStatus: (isSearching: boolean) => void
  setConnectedUser: (user: GuestUser | null) => void
  setSocketId: (socketId: string) => void
  clearGuestSession: () => void
  generateGuestUsername: () => string
  // Real-time data
  realTimeStats: {
    totalUsers: number
    onlineUsers: number
    availableUsers: number
    connectedUsers: number
  }
  onlineUsers: any[]
}

const GuestSessionContext = createContext<GuestSessionContextType | undefined>(undefined)

export const useGuestSession = () => {
  const context = useContext(GuestSessionContext)
  if (!context) {
    throw new Error("useGuestSession must be used within a GuestSessionProvider")
  }
  return context
}

const GUEST_ADJECTIVES = [
  "Cool", "Happy", "Smart", "Brave", "Kind", "Quick", "Bright", "Calm", "Swift", "Bold",
  "Wise", "Nice", "Fun", "Wild", "Free", "Pure", "Fast", "True", "Good", "Fair"
]

const GUEST_NOUNS = [
  "Panda", "Tiger", "Eagle", "Wolf", "Fox", "Bear", "Lion", "Shark", "Hawk", "Owl",
  "Cat", "Dog", "Bird", "Fish", "Deer", "Frog", "Duck", "Bee", "Star", "Moon"
]

export const GuestSessionProvider = ({ children }: { children: ReactNode }) => {
  const [guestUser, setGuestUser] = useState<GuestUser | null>(() => {
    // Try to restore from sessionStorage
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('guest_user_session')
      const storedToken = sessionStorage.getItem('guestAuthToken')
      
      // Only restore if both session data AND JWT token exist
      if (stored && storedToken) {
        try {
          const parsedUser = JSON.parse(stored)
          // Validate that it's a proper guest user object
          if (parsedUser && parsedUser.id && parsedUser.username) {
            // Check if token is expired by decoding the JWT
            try {
              const tokenParts = storedToken.split('.')
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]))
                const expirationTime = payload.exp * 1000 // Convert to milliseconds
                const currentTime = Date.now()
                
                if (expirationTime < currentTime) {
                  console.log('⚠️ Stored token has expired, clearing session')
                  sessionStorage.removeItem('guest_user_session')
                  sessionStorage.removeItem('guestAuthToken')
                  return null
                }
                
                console.log('⚙️ Restored guest session:', parsedUser.username)
                return parsedUser
              }
            } catch (tokenError) {
              console.error('Failed to decode token:', tokenError)
              sessionStorage.removeItem('guest_user_session')
              sessionStorage.removeItem('guestAuthToken')
              return null
            }
          }
        } catch (e) {
          console.error('Failed to parse stored guest session:', e)
          // Clean up invalid session data
          sessionStorage.removeItem('guest_user_session')
          sessionStorage.removeItem('guestAuthToken')
        }
      } else if (stored || storedToken) {
        // If only one exists, clean up both for consistency
        console.log('🧹 Cleaning up incomplete guest session data')
        sessionStorage.removeItem('guest_user_session')
        sessionStorage.removeItem('guestAuthToken')
      }
    }
    return null
  })

  const [isGuestSession, setIsGuestSession] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [realTimeStats, setRealTimeStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    availableUsers: 0,
    connectedUsers: 0
  })
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])

  // Fallback stats when socket is not connected
  const fallbackStats = {
    totalUsers: Math.floor(Math.random() * 500) + 100,
    onlineUsers: Math.floor(Math.random() * 50) + 10,
    availableUsers: Math.floor(Math.random() * 20) + 5,
    connectedUsers: Math.floor(Math.random() * 15) + 2
  }

  useEffect(() => {
    // Set guest session flag based on whether we have a guest user
    setIsGuestSession(!!guestUser)

    // Provide regeneration callback to API layer
    setSessionRegenerationCallback(async () => {
      setIsRegenerating(true)
      try {
        await initializeGuestSession();
        // Reconnect socket if needed
        if (!socketService.getConnectionStatus()) {
          try {
            const newUser = JSON.parse(sessionStorage.getItem('guest_user_session') || '{}')
            const socketGuestUser = newUser.id ? {
              id: newUser.id,
              username: newUser.username,
              deviceId: newUser.deviceId,
              isGuest: true
            } : undefined
            socketService.connect(socketGuestUser)
          } catch (e) {
            console.error('Failed to reconnect socket after regeneration:', e)
          }
        }
      } finally {
        setIsRegenerating(false)
      }
    })

    return () => setSessionRegenerationCallback(null)
  }, [guestUser])

  // Save to sessionStorage whenever guestUser changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (guestUser) {
        sessionStorage.setItem('guest_user_session', JSON.stringify(guestUser))
      } else {
        sessionStorage.removeItem('guest_user_session')
      }
    }
  }, [guestUser])

  // Setup socket event listeners for real-time presence
  useEffect(() => {
    // Listen for real-time stats updates
    const handleStatsUpdate = (stats: any) => {
      setRealTimeStats(stats)
    }

    // Listen for online users updates
    const handleOnlineUsersUpdate = (users: any[]) => {
      setOnlineUsers(users)
    }

    // Listen for presence updates
    const handlePresenceUpdate = (data: any) => {
      if (guestUser && data.userId === guestUser.id) {
        updateGuestUser({
          isOnline: data.isOnline,
          lastSeen: data.lastSeen
        })
      }
    }
    
    // Check for session changes (e.g., from socket service token regeneration)
    const checkSessionSync = () => {
      const storedUser = sessionStorage.getItem('guest_user_session')
      const storedToken = sessionStorage.getItem('guestAuthToken')
      
      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser)
          // Only update if the user ID changed (indicates regeneration)
          if (guestUser && parsedUser.id !== guestUser.id) {
            console.log('🔄 Syncing guest session after regeneration:', parsedUser.username)
            setGuestUser(parsedUser)
          }
        } catch (e) {
          console.error('Failed to sync guest session:', e)
        }
      }
    }
    
    // Listen for session expiration events from socket service
    const handleSessionExpired = () => {
      console.log('⚠️ Session expired event received')
      setIsRegenerating(true)
    }
    
    const handleSessionRegenerated = (event: any) => {
      console.log('✅ Session regenerated event received:', event.detail?.user?.username)
      setIsRegenerating(false)
      if (event.detail?.user) {
        setGuestUser(event.detail.user)
      }
    }

    // Register socket event listeners
    socketService.on('stats:update', handleStatsUpdate)
    socketService.on('users:online:update', handleOnlineUsersUpdate)
    socketService.on('presence:update', handlePresenceUpdate)
    
    // Register window event listeners for session management
    window.addEventListener('guest:session:expired', handleSessionExpired)
    window.addEventListener('guest:session:regenerated', handleSessionRegenerated)

    // Request initial data
    if (socketService.getConnectionStatus()) {
      socketService.requestStats()
      socketService.requestOnlineUsers()
    }

    // Setup heartbeat for presence if guest user exists
    let heartbeatInterval: NodeJS.Timeout | null = null
    let sessionValidationInterval: NodeJS.Timeout | null = null
    let sessionSyncInterval: NodeJS.Timeout | null = null
    
    if (guestUser) {
      heartbeatInterval = setInterval(() => {
        if (socketService.getConnectionStatus()) {
          socketService.sendHeartbeat()
        }
      }, 30000) // Send heartbeat every 30 seconds
      
      // Periodic session validation - check every 5 minutes
      sessionValidationInterval = setInterval(async () => {
        const token = sessionStorage.getItem('guestAuthToken')
        if (token && guestUser) {
          try {
            // Try to validate the session by making a simple API call
            await guestAPI.getMe()
            console.log('✅ Session validation successful')
          } catch (error: any) {
            if (error.response?.status === 401) {
              console.log('🔄 Session expired during validation, regenerating...')
              // Session expired, regeneration will be handled by API interceptor
            } else {
              console.log('⚠️ Session validation failed (network error):', error.message)
            }
          }
        }
      }, 5 * 60 * 1000) // Check every 5 minutes
      
      // Check for session sync every 2 seconds (to catch socket regeneration)
      sessionSyncInterval = setInterval(checkSessionSync, 2000)
    }

    // Cleanup
    return () => {
      socketService.off('stats:update', handleStatsUpdate)
      socketService.off('users:online:update', handleOnlineUsersUpdate)
      socketService.off('presence:update', handlePresenceUpdate)
      
      window.removeEventListener('guest:session:expired', handleSessionExpired)
      window.removeEventListener('guest:session:regenerated', handleSessionRegenerated)
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
      if (sessionValidationInterval) {
        clearInterval(sessionValidationInterval)
      }
      if (sessionSyncInterval) {
        clearInterval(sessionSyncInterval)
      }
    }
  }, [guestUser])

  const generateDeviceId = (): string => {
    let deviceId = localStorage.getItem("guest_deviceId")
    if (!deviceId) {
      deviceId = uuidv4()
      localStorage.setItem("guest_deviceId", deviceId)
    }
    return deviceId
  }

  const generateGuestUsername = (): string => {
    const randomAdjective = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)]
    const randomNoun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)]
    const randomNumber = Math.floor(Math.random() * 9999) + 1
    return `${randomAdjective}${randomNoun}${randomNumber}`
  }

  const initializeGuestSession = async (username?: string): Promise<void> => {
    const guestUsername = username || generateGuestUsername()
    const deviceId = generateDeviceId()
    
    try {
      // Call backend API to create guest session and get JWT token
      const response = await guestAPI.createSession({
        username: guestUsername
      })
      
      const data = response.data
      
      if (!data.success || !data.data.token) {
        throw new Error('Invalid response from guest session API')
      }
      
      // Store JWT token in sessionStorage
      sessionStorage.setItem('guestAuthToken', data.data.token)
      
      // Create guest user object from API response
      const newGuestUser: GuestUser = {
        id: data.data.user.id,
        username: data.data.user.username,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceId,
        isSearching: false,
        connectedUser: null,
      }

      setGuestUser(newGuestUser)
      
      console.log('✅ Guest session created successfully:', newGuestUser.username)
      
      // Register guest user with socket service for real-time presence
      try {
        const socketGuestUser = {
          id: newGuestUser.id,
          username: newGuestUser.username,
          deviceId: newGuestUser.deviceId,
          isGuest: true
        }
        socketService.registerGuestUser(socketGuestUser)
      } catch (error) {
        console.log("Socket service not ready yet, will register on connect")
      }
    } catch (error) {
      console.error('❌ Failed to create guest session:', error)
      
      // Fallback to local guest user creation (without JWT)
      const newGuestUser: GuestUser = {
        id: `guest_${uuidv4()}`,
        username: guestUsername,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        deviceId,
        isSearching: false,
        connectedUser: null,
      }

      setGuestUser(newGuestUser)
      
      // Show error to user
      throw error
    }
  }

  const updateGuestUser = (updates: Partial<GuestUser>): void => {
    setGuestUser(prev => {
      if (!prev) return null
      const updated = { ...prev, ...updates }
      return updated
    })
  }

  const setOnlineStatus = (isOnline: boolean): void => {
    updateGuestUser({
      isOnline,
      lastSeen: isOnline ? new Date().toISOString() : new Date().toISOString()
    })
    
    // Emit real-time presence update
    socketService.updateOnlineStatus(isOnline)
  }

  const setSearchingStatus = (isSearching: boolean): void => {
    updateGuestUser({ isSearching })
    
    // Emit real-time searching status
    socketService.updateSearchingStatus(isSearching)
  }

  const setConnectedUser = (user: GuestUser | null): void => {
    updateGuestUser({ connectedUser: user })
  }

  const setSocketId = (socketId: string): void => {
    updateGuestUser({ socketId })
  }

  const clearGuestSession = (): void => {
    setGuestUser(null)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('guest_user_session')
      sessionStorage.removeItem('guestAuthToken')
    }
  }

  const value: GuestSessionContextType = {
    guestUser,
    isGuestSession,
    isRegenerating,
    initializeGuestSession,
    updateGuestUser,
    setOnlineStatus,
    setSearchingStatus,
    setConnectedUser,
    setSocketId,
    clearGuestSession,
    generateGuestUsername,
    // Real-time data with fallback
    realTimeStats: realTimeStats.totalUsers > 0 ? realTimeStats : fallbackStats,
    onlineUsers,
  }

  return (
    <GuestSessionContext.Provider value={value}>
      {children}
    </GuestSessionContext.Provider>
  )
}