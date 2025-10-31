/**
 * SocketService Token Expiration Tests
 * 
 * Tests for token expiration handling:
 * 1. Detect expired token errors on connection
 * 2. Automatically regenerate guest session
 * 3. Reconnect with new token
 * 4. Prevent infinite regeneration loops
 * 5. Handle regeneration failures gracefully
 */

import { io } from 'socket.io-client'
import Cookies from 'js-cookie'

// Mock modules before importing SocketService
jest.mock('socket.io-client')
jest.mock('js-cookie')
jest.mock('../api', () => ({
  guestAPI: {
    createSession: jest.fn(),
  },
}))

import { guestAPI } from '../api'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock })

describe('SocketService - Token Expiration Handling', () => {
  let SocketService: any
  let socketService: any
  let mockSocket: any
  let connectErrorHandler: any

  beforeEach(() => {
    // Clear storage mocks
    localStorageMock.clear()
    sessionStorageMock.clear()
    
    // Set up test device ID
    localStorageMock.setItem('guest_deviceId', 'test-device-123')
    
    // Create a mock socket instance
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
      id: 'test-socket-id',
    }

    // Mock io to return our mock socket
    ;(io as jest.Mock).mockReturnValue(mockSocket)
    
    // Mock guest API response
    ;(guestAPI.createSession as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'new-fresh-token-12345',
          user: {
            id: 'guest_new_user_id',
            username: 'BraveLion4567',
          },
        },
      },
    })
    
    // Import SocketService after mocking
    const socketModule = require('../socket')
    socketService = socketModule.default
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Token Expiration Detection', () => {
    test('should detect "Token has expired" error on connect_error', async () => {
      // Set up expired token
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      sessionStorageMock.setItem('guest_user_session', JSON.stringify({
        id: 'guest_old_id',
        username: 'OldUser123',
        deviceId: 'test-device-123',
      }))

      // Connect socket
      socketService.connect()
      
      // Get the connect_error handler
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      expect(connectErrorHandler).toBeDefined()
      
      // Simulate token expired error
      const error = {
        message: 'Token has expired',
        description: undefined,
        context: undefined,
        type: undefined,
      }
      
      await connectErrorHandler(error)
      
      // Should call guest API to create new session
      expect(guestAPI.createSession).toHaveBeenCalledWith({
        username: expect.stringMatching(/^[A-Z][a-z]+[A-Z][a-z]+\d{1,4}$/),
      })
    })

    test('should clear expired token and session data on expiration', async () => {
      // Set up expired token
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      sessionStorageMock.setItem('guest_user_session', JSON.stringify({
        id: 'guest_old_id',
        username: 'OldUser123',
      }))

      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Should store new token and session
      expect(sessionStorageMock.getItem('guestAuthToken')).toBe('new-fresh-token-12345')
      const newSession = JSON.parse(sessionStorageMock.getItem('guest_user_session') || '{}')
      expect(newSession.id).toBe('guest_new_user_id')
      expect(newSession.username).toBe('BraveLion4567')
    })

    test('should NOT trigger regeneration for non-expiration errors', async () => {
      sessionStorageMock.setItem('guestAuthToken', 'valid-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      // Simulate different error
      await connectErrorHandler({ message: 'Network error' })
      
      // Should NOT call API to regenerate
      expect(guestAPI.createSession).not.toHaveBeenCalled()
    })
  })

  describe('Token Regeneration', () => {
    test('should generate new username with correct format', async () => {
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Check username format: AdjectiveNounNumber
      const apiCall = (guestAPI.createSession as jest.Mock).mock.calls[0][0]
      expect(apiCall.username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{1,4}$/)
    })

    test('should reconnect socket after successful regeneration', async () => {
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      const initialIoCalls = (io as jest.Mock).mock.calls.length
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Should call io again to reconnect
      expect((io as jest.Mock).mock.calls.length).toBeGreaterThan(initialIoCalls)
    })

    test('should update currentUser with new credentials', async () => {
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Check currentUser was updated
      const currentUser = (socketService as any).currentUser
      expect(currentUser).toEqual({
        id: 'guest_new_user_id',
        username: 'BraveLion4567',
        deviceId: 'test-device-123',
        isGuest: true,
      })
    })
  })

  describe('Regeneration Loop Prevention', () => {
    test('should prevent concurrent regeneration attempts', async () => {
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      // Trigger multiple expired token errors simultaneously
      const promise1 = connectErrorHandler({ message: 'Token has expired' })
      const promise2 = connectErrorHandler({ message: 'Token has expired' })
      const promise3 = connectErrorHandler({ message: 'Token has expired' })
      
      await Promise.all([promise1, promise2, promise3])
      
      // Should only call API once
      expect(guestAPI.createSession).toHaveBeenCalledTimes(1)
    })

    test('should reset regeneration flag after completion', async () => {
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Should allow new regeneration after first completes
      expect((socketService as any).isRegeneratingToken).toBe(false)
    })
  })

  describe('Regeneration Failure Handling', () => {
    test('should handle API failure gracefully', async () => {
      // Mock API failure
      ;(guestAPI.createSession as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )
      
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      // Should not throw
      await expect(
        connectErrorHandler({ message: 'Token has expired' })
      ).resolves.not.toThrow()
      
      // Should reset flag even on failure
      expect((socketService as any).isRegeneratingToken).toBe(false)
    })

    test('should handle invalid API response', async () => {
      // Mock invalid response
      ;(guestAPI.createSession as jest.Mock).mockResolvedValueOnce({
        data: {
          success: false,
        },
      })
      
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Should not store invalid data
      expect(sessionStorageMock.getItem('guestAuthToken')).toBeNull()
    })

    test('should handle missing API response token', async () => {
      // Mock response without token
      ;(guestAPI.createSession as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            user: {
              id: 'guest_123',
              username: 'TestUser',
            },
          },
        },
      })
      
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      // Should not proceed without token
      expect(sessionStorageMock.getItem('guestAuthToken')).toBeNull()
    })
  })

  describe('Device ID Persistence', () => {
    test('should use existing device ID during regeneration', async () => {
      const existingDeviceId = 'existing-device-456'
      localStorageMock.setItem('guest_deviceId', existingDeviceId)
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      await connectErrorHandler({ message: 'Token has expired' })
      
      const newSession = JSON.parse(sessionStorageMock.getItem('guest_user_session') || '{}')
      expect(newSession.deviceId).toBe(existingDeviceId)
    })

    test('should handle missing device ID gracefully', async () => {
      // Clear device ID from localStorage
      localStorageMock.removeItem('guest_deviceId')
      sessionStorageMock.setItem('guestAuthToken', 'expired-token')
      
      socketService.connect()
      
      connectErrorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1]
      
      // Should not throw
      await expect(
        connectErrorHandler({ message: 'Token has expired' })
      ).resolves.not.toThrow()
      
      const newSession = JSON.parse(sessionStorageMock.getItem('guest_user_session') || '{}')
      expect(newSession.deviceId).toBe('')
    })
  })
})
