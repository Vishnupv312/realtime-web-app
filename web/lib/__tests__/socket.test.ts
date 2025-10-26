/**
 * SocketService Unit Tests
 * 
 * Tests for the SocketService class focusing on WebRTC listener management:
 * 1. setWebRTCListenersSetup correctly stores the provided setup function
 * 2. setWebRTCListenersSetup immediately calls the setup function if socket is already connected
 * 3. The registered WebRTC listener setup function is called when socket connects or reconnects
 */

import { io } from 'socket.io-client'
import Cookies from 'js-cookie'

// Mock modules before importing SocketService
jest.mock('socket.io-client')
jest.mock('js-cookie')

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

describe('SocketService - WebRTC Listener Setup', () => {
  let SocketService: any
  let socketService: any
  let mockSocket: any

  beforeEach(() => {
    // Clear all module cache to get a fresh instance
    jest.resetModules()
    
    // Clear storage mocks
    localStorageMock.clear()
    sessionStorageMock.clear()
    
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
    
    // Mock Cookies.get to return a test token
    ;(Cookies.get as jest.Mock).mockReturnValue('test-auth-token')
    
    // Also set a token in localStorage as fallback
    localStorageMock.setItem('authToken', 'test-auth-token')

    // Import SocketService fresh after mocking
    const socketModule = require('../socket')
    SocketService = socketModule.default.constructor
    socketService = socketModule.default
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('setWebRTCListenersSetup', () => {
    test('should store the provided setup function', () => {
      const setupFn = jest.fn()
      
      socketService.setWebRTCListenersSetup(setupFn)
      
      // Access private property for testing
      expect((socketService as any).webrtcListenersSetup).toBe(setupFn)
    })

    test('should NOT call setup function immediately when socket is not connected', () => {
      const setupFn = jest.fn()
      
      // Ensure socket is not connected
      socketService.isConnected = false
      mockSocket.connected = false
      
      socketService.setWebRTCListenersSetup(setupFn)
      
      expect(setupFn).not.toHaveBeenCalled()
    })

    test('should call setup function immediately when socket is already connected', () => {
      const setupFn = jest.fn()
      
      // Set up a connected socket
      socketService.connect()
      socketService.isConnected = true
      mockSocket.connected = true
      
      socketService.setWebRTCListenersSetup(setupFn)
      
      expect(setupFn).toHaveBeenCalledTimes(1)
    })

    test('should replace previous setup function with new one', () => {
      const firstSetupFn = jest.fn()
      const secondSetupFn = jest.fn()
      
      socketService.setWebRTCListenersSetup(firstSetupFn)
      socketService.setWebRTCListenersSetup(secondSetupFn)
      
      // Access private property
      expect((socketService as any).webrtcListenersSetup).toBe(secondSetupFn)
      expect((socketService as any).webrtcListenersSetup).not.toBe(firstSetupFn)
    })
  })

  describe('WebRTC listeners on socket connect', () => {
    test('should call registered setup function when socket connects', () => {
      const setupFn = jest.fn()
      
      // Connect the socket first
      socketService.connect()
      
      // Register the setup function after connecting
      socketService.setWebRTCListenersSetup(setupFn)
      
      // Get the socket instance that was created
      const socketInstance = (socketService as any).socket
      
      // Get the connect handler that was registered
      const connectHandler = socketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]
      
      expect(connectHandler).toBeDefined()
      
      // Simulate socket connect event
      socketService.isConnected = true
      connectHandler()
      
      // Setup function should be called when socket connects
      expect(setupFn).toHaveBeenCalledTimes(1)
    })

    test('should call registered setup function on reconnect', () => {
      const setupFn = jest.fn()
      
      // First connection
      socketService.connect()
      socketService.setWebRTCListenersSetup(setupFn)
      
      const socketInstance = (socketService as any).socket
      
      // Get the connect handler
      const connectHandler = socketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]
      
      // Simulate disconnect
      socketService.isConnected = false
      
      // Simulate reconnect
      socketService.isConnected = true
      connectHandler()
      
      expect(setupFn).toHaveBeenCalled()
    })

    test('should NOT call setup function if it was not registered', () => {
      // Connect without registering a setup function
      socketService.connect()
      
      const socketInstance = (socketService as any).socket
      
      const connectHandler = socketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]
      
      // Simulate connect - should not throw error
      expect(() => {
        socketService.isConnected = true
        connectHandler()
      }).not.toThrow()
    })

    test('should call setup function multiple times on multiple reconnects', () => {
      const setupFn = jest.fn()
      
      socketService.connect()
      socketService.setWebRTCListenersSetup(setupFn)
      
      const socketInstance = (socketService as any).socket
      
      const connectHandler = socketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]
      
      // Simulate multiple reconnects
      for (let i = 0; i < 3; i++) {
        socketService.isConnected = true
        connectHandler()
      }
      
      expect(setupFn).toHaveBeenCalledTimes(3)
    })
  })

  describe('WebRTC listeners lifecycle', () => {
    test('should preserve setup function after disconnect', () => {
      const setupFn = jest.fn()
      
      socketService.connect()
      socketService.setWebRTCListenersSetup(setupFn)
      
      // Disconnect
      socketService.disconnect()
      
      // Setup function should still be stored
      expect((socketService as any).webrtcListenersSetup).toBe(setupFn)
    })

    test('should call setup function after reconnecting following a disconnect', () => {
      const setupFn = jest.fn()
      
      // Initial connection and setup
      socketService.connect()
      socketService.setWebRTCListenersSetup(setupFn)
      
      // Disconnect
      socketService.disconnect()
      socketService.isConnected = false
      
      // Clear the mock to count only reconnect calls
      setupFn.mockClear()
      
      // Reconnect
      socketService.connect()
      const socketInstance = (socketService as any).socket
      const connectHandler = socketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]
      
      socketService.isConnected = true
      connectHandler()
      
      // Should be called on reconnect
      expect(setupFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration with socket events', () => {
    test('should set up connect event handler that calls WebRTC setup', () => {
      const setupFn = jest.fn()
      
      socketService.connect()
      
      const socketInstance = (socketService as any).socket
      
      // Verify that a 'connect' event handler was registered
      const connectCalls = socketInstance.on.mock.calls.filter(
        (call: any[]) => call[0] === 'connect'
      )
      
      expect(connectCalls.length).toBeGreaterThan(0)
    })

    test('should work correctly when setup function is registered before connect', () => {
      const setupFn = jest.fn()
      
      // Register setup function first
      socketService.setWebRTCListenersSetup(setupFn)
      
      // Then connect
      socketService.connect()
      socketService.isConnected = true
      
      const socketInstance = (socketService as any).socket
      
      const connectHandler = socketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]
      
      connectHandler()
      
      expect(setupFn).toHaveBeenCalled()
    })

    test('should work correctly when setup function is registered after connect', () => {
      const setupFn = jest.fn()
      
      // Connect first
      socketService.connect()
      socketService.isConnected = true
      mockSocket.connected = true
      
      // Then register setup function (should be called immediately)
      socketService.setWebRTCListenersSetup(setupFn)
      
      expect(setupFn).toHaveBeenCalledTimes(1)
    })
  })
})
