"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { authAPI, userAPI } from "@/lib/api"
import Cookies from "js-cookie"
import { v4 as uuidv4 } from "uuid"

interface User {
  id: string
  username: string
  email: string
  isOnline: boolean
  lastSeen: string
  deviceId: string
  ip?: string
  location?: {
    country: string
    region?: string
    city: string
    timezone?: string
  }
  connectedUser?: any
  createdAt: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: User }>
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message?: string; user?: User }>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
    generateDeviceId()
  }, [])

  const generateDeviceId = (): string => {
    let deviceId = localStorage.getItem("deviceId")
    if (!deviceId) {
      deviceId = uuidv4()
      localStorage.setItem("deviceId", deviceId)
    }
    return deviceId
  }

  const checkAuth = async (): Promise<void> => {
    try {
      const token = Cookies.get("authToken") || localStorage.getItem("authToken")
      if (!token) {
        setLoading(false)
        return
      }

      const response = await authAPI.getMe()
      setUser(response.data.data.user)
      setIsAuthenticated(true)
    } catch (error) {
      console.error("Auth check failed:", error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password })
      const { token, user } = response.data.data

      // Store token and user data
      Cookies.set("authToken", token, { expires: 7 })
      localStorage.setItem("authToken", token)
      localStorage.setItem("currentUser", JSON.stringify(user))

      setUser(user)
      setIsAuthenticated(true)

      // Update device info
      const deviceId = generateDeviceId()
      await updateDeviceInfo(deviceId)

      return { success: true, user }
    } catch (error: any) {
      console.error("Login failed:", error)
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      }
    }
  }

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await authAPI.register({ username, email, password })
      const { token, user } = response.data.data

      // Store token and user data
      Cookies.set("authToken", token, { expires: 7 })
      localStorage.setItem("authToken", token)
      localStorage.setItem("currentUser", JSON.stringify(user))

      setUser(user)
      setIsAuthenticated(true)

      // Update device info
      const deviceId = generateDeviceId()
      await updateDeviceInfo(deviceId)

      return { success: true, user }
    } catch (error: any) {
      console.error("Registration failed:", error)
      return {
        success: false,
        message: error.response?.data?.message || "Registration failed",
      }
    }
  }

  const logout = (): void => {
    Cookies.remove("authToken")
    localStorage.removeItem("authToken")
    localStorage.removeItem("currentUser")
    setUser(null)
    setIsAuthenticated(false)
  }

  const updateDeviceInfo = async (deviceId: string): Promise<void> => {
    try {
      await userAPI.updateDevice({ deviceId })
    } catch (error) {
      console.error("Failed to update device info:", error)
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
