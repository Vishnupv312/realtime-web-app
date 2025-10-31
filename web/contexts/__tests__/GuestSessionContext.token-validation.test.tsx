/**
 * GuestSessionContext Token Validation Tests
 * 
 * Tests for token validation on page load:
 * 1. Validate token expiration on context initialization
 * 2. Clear expired tokens automatically
 * 3. Restore valid sessions correctly
 * 4. Sync session data after regeneration
 * 5. Handle invalid session data gracefully
 */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { GuestSessionProvider, useGuestSession } from '../GuestSessionContext'
import { guestAPI } from '@/lib/api'

// Mock dependencies
jest.mock('@/lib/socket', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    off: jest.fn(),
    getConnectionStatus: jest.fn(() => false),
    registerGuestUser: jest.fn(),
    updateOnlineStatus: jest.fn(),
    updateSearchingStatus: jest.fn(),
    sendHeartbeat: jest.fn(),
    requestStats: jest.fn(),
    requestOnlineUsers: jest.fn(),
  },
}))

jest.mock('@/lib/api', () => ({
  guestAPI: {
    createSession: jest.fn(),
    getMe: jest.fn(),
  },
  setSessionRegenerationCallback: jest.fn(),
}))

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}))

// Helper to create JWT token
const createMockToken = (expiresInSeconds: number): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    userId: 'guest_test_123',
    username: 'TestUser',
    isGuest: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }))
  const signature = 'mock-signature'
  return `${header}.${payload}.${signature}`
}

// Mock storage
const createStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
    get store() { return store },
    set store(value: Record<string, string>) { store = value },
  }
}

describe('GuestSessionContext - Token Validation', () => {
  let sessionStorageMock: ReturnType<typeof createStorageMock>
  let localStorageMock: ReturnType<typeof createStorageMock>
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    // Create fresh storage mocks
    sessionStorageMock = createStorageMock()
    localStorageMock = createStorageMock()

    Object.defineProperty(global, 'sessionStorage', { 
      value: sessionStorageMock,
      writable: true,
    })
    Object.defineProperty(global, 'localStorage', { 
      value: localStorageMock,
      writable: true,
    })

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Mock API responses
    ;(guestAPI.createSession as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: createMockToken(7200), // 2 hours
          user: {
            id: 'guest_new_456',
            username: 'NewUser123',
          },
        },
      },
    })
    ;(guestAPI.getMe as jest.Mock).mockResolvedValue({
      data: { success: true },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('Token Expiration Validation on Load', () => {
    test('should restore valid session with non-expired token', () => {
      const validToken = createMockToken(7200) // 2 hours from now
      const guestUser = {
        id: 'guest_test_123',
        username: 'TestUser',
        deviceId: 'device-123',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        isSearching: false,
      }

      sessionStorageMock.store = {
        guestAuthToken: validToken,
        guest_user_session: JSON.stringify(guestUser),
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      // Should restore the session
      expect(result.current.guestUser).toEqual(guestUser)
      expect(result.current.isGuestSession).toBe(true)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Restored guest session'),
        'TestUser'
      )
    })

    test('should clear expired token and not restore session', () => {
      const expiredToken = createMockToken(-3600) // Expired 1 hour ago
      const guestUser = {
        id: 'guest_test_123',
        username: 'TestUser',
        deviceId: 'device-123',
      }

      sessionStorageMock.store = {
        guestAuthToken: expiredToken,
        guest_user_session: JSON.stringify(guestUser),
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      // Should NOT restore the session
      expect(result.current.guestUser).toBeNull()
      expect(result.current.isGuestSession).toBe(false)
      
      // Should clear storage
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guestAuthToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guest_user_session')
      
      // Should log warning
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stored token has expired')
      )
    })

    test('should detect token expiring soon (within 1 minute)', () => {
      const expiringToken = createMockToken(30) // Expires in 30 seconds
      const guestUser = {
        id: 'guest_test_123',
        username: 'TestUser',
        deviceId: 'device-123',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        isSearching: false,
      }

      sessionStorageMock.store = {
        guestAuthToken: expiringToken,
        guest_user_session: JSON.stringify(guestUser),
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      // Should still restore (not expired yet)
      expect(result.current.guestUser).toEqual(guestUser)
    })

    test('should handle malformed JWT token gracefully', () => {
      const invalidToken = 'invalid.token.format'
      const guestUser = {
        id: 'guest_test_123',
        username: 'TestUser',
      }

      sessionStorageMock.store = {
        guestAuthToken: invalidToken,
        guest_user_session: JSON.stringify(guestUser),
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      // Should NOT restore
      expect(result.current.guestUser).toBeNull()
      
      // Should clear storage
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guestAuthToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guest_user_session')
    })

    test('should handle JWT with invalid payload structure', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const payload = btoa('invalid json')
      const invalidToken = `${header}.${payload}.signature`

      sessionStorageMock.store = {
        guestAuthToken: invalidToken,
        guest_user_session: JSON.stringify({ id: 'test', username: 'Test' }),
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      expect(result.current.guestUser).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to decode token'),
        expect.any(Error)
      )
    })
  })

  describe('Incomplete Session Data Cleanup', () => {
    test('should clear session data if token exists but session data is missing', () => {
      const validToken = createMockToken(7200)

      sessionStorageMock.store = {
        guestAuthToken: validToken,
        // No guest_user_session
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      expect(result.current.guestUser).toBeNull()
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guestAuthToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guest_user_session')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up incomplete')
      )
    })

    test('should clear token if session data exists but token is missing', () => {
      const guestUser = {
        id: 'guest_test_123',
        username: 'TestUser',
      }

      sessionStorageMock.store = {
        guest_user_session: JSON.stringify(guestUser),
        // No guestAuthToken
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      expect(result.current.guestUser).toBeNull()
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guest_user_session')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guestAuthToken')
    })

    test('should handle corrupted session data JSON', () => {
      const validToken = createMockToken(7200)

      sessionStorageMock.store = {
        guestAuthToken: validToken,
        guest_user_session: 'invalid json {',
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      expect(result.current.guestUser).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse stored guest session'),
        expect.any(Error)
      )
    })
  })

  describe('Session Synchronization', () => {
    test('should sync guest user when session changes in storage', async () => {
      jest.useFakeTimers()
      
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      // Initially no user
      expect(result.current.guestUser).toBeNull()

      // Initialize a session
      await act(async () => {
        await result.current.initializeGuestSession()
      })

      const initialUserId = result.current.guestUser?.id

      // Simulate socket service regenerating the session
      const newToken = createMockToken(7200)
      const newUser = {
        id: 'guest_regenerated_789',
        username: 'RegeneratedUser',
        deviceId: 'device-123',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        isSearching: false,
      }

      sessionStorageMock.store = {
        guestAuthToken: newToken,
        guest_user_session: JSON.stringify(newUser),
      }

      // Fast-forward timers to trigger sync interval (2000ms)
      await act(async () => {
        jest.advanceTimersByTime(2100)
      })

      // User should be updated
      expect(result.current.guestUser?.id).toBe('guest_regenerated_789')
      expect(result.current.guestUser?.username).toBe('RegeneratedUser')
      expect(result.current.guestUser?.id).not.toBe(initialUserId)
      
      jest.useRealTimers()
    })
  })

  describe('Session Creation', () => {
    test('should create new session when none exists', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      await act(async () => {
        await result.current.initializeGuestSession()
      })

      expect(guestAPI.createSession).toHaveBeenCalled()
      expect(result.current.guestUser).toBeTruthy()
      expect(result.current.isGuestSession).toBe(true)
    })

    test('should store token in sessionStorage after creation', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      await act(async () => {
        await result.current.initializeGuestSession()
      })

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'guestAuthToken',
        expect.any(String)
      )
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'guest_user_session',
        expect.any(String)
      )
    })
  })

  describe('Clear Session', () => {
    test('should clear both token and session data', async () => {
      const validToken = createMockToken(7200)
      const guestUser = {
        id: 'guest_test_123',
        username: 'TestUser',
        deviceId: 'device-123',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        isSearching: false,
      }

      sessionStorageMock.store = {
        guestAuthToken: validToken,
        guest_user_session: JSON.stringify(guestUser),
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GuestSessionProvider>{children}</GuestSessionProvider>
      )

      const { result } = renderHook(() => useGuestSession(), { wrapper })

      expect(result.current.guestUser).toBeTruthy()

      act(() => {
        result.current.clearGuestSession()
      })

      expect(result.current.guestUser).toBeNull()
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guestAuthToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('guest_user_session')
    })
  })
})
