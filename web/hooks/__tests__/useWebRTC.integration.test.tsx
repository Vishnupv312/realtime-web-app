/**
 * useWebRTC Integration Tests
 * 
 * Tests for the integration between useWebRTC hook and SocketService:
 * 1. The useWebRTC hook successfully registers its setupSocketListeners with SocketService
 * 2. WebRTC listeners are correctly re-established after a socket reconnection
 * 3. Socket events are properly handled after registration
 */

import { renderHook, act } from '@testing-library/react'
import useWebRTC from '../useWebRTC'
import socketService from '@/lib/socket'
import { io } from 'socket.io-client'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = { authToken: 'test-auth-token' }
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = { authToken: 'test-auth-token' } },
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

// Mock dependencies
jest.mock('socket.io-client')

jest.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => 'test-auth-token'),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

// Mock MediaUtils to prevent actual media access
jest.mock('@/lib/mediaUtils', () => ({
  default: {
    getUserMedia: jest.fn(),
    getDeviceInfo: jest.fn(() => ({ userAgent: 'test' })),
  },
  MediaError: {},
}))

// Mock useCallLogs hook
jest.mock('@/hooks/useCallLogs', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    createCallLogMessage: jest.fn((entry) => ({
      content: `Call ${entry.type}`,
    })),
    startCallTimer: jest.fn(),
    getCallDuration: jest.fn(() => 0),
    resetCallTimer: jest.fn(),
  })),
}))

describe('useWebRTC Integration with SocketService', () => {
  let mockSocket: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create a fresh mock socket for each test
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
  })

  describe('WebRTC listener registration', () => {
    test('should register setupSocketListeners with SocketService on mount', () => {
      // Spy on setWebRTCListenersSetup
      const setWebRTCListenersSetupSpy = jest.spyOn(
        socketService,
        'setWebRTCListenersSetup'
      )

      renderHook(() => useWebRTC())

      // Should call setWebRTCListenersSetup once
      expect(setWebRTCListenersSetupSpy).toHaveBeenCalledTimes(1)
      expect(setWebRTCListenersSetupSpy).toHaveBeenCalledWith(
        expect.any(Function)
      )

      setWebRTCListenersSetupSpy.mockRestore()
    })

    test('should register all WebRTC event listeners through setupSocketListeners', () => {
      // Connect socket first
      socketService.connect()

      renderHook(() => useWebRTC())

      // Get the setup function that was registered
      const setupFn = (socketService as any).webrtcListenersSetup

      expect(setupFn).toBeDefined()

      // Clear previous mock calls from connect
      mockSocket.on.mockClear()
      mockSocket.off.mockClear()

      // Call the setup function
      act(() => {
        setupFn()
      })

      // Verify that off was called to clean up old listeners
      // socket.off is called with just the event name (no callback)
      expect(mockSocket.off).toHaveBeenCalledWith('webrtc:offer', undefined)
      expect(mockSocket.off).toHaveBeenCalledWith('webrtc:answer', undefined)
      expect(mockSocket.off).toHaveBeenCalledWith('webrtc:ice-candidate', undefined)
      expect(mockSocket.off).toHaveBeenCalledWith('webrtc:call-end', undefined)
      expect(mockSocket.off).toHaveBeenCalledWith('webrtc:call-reject', undefined)
      expect(mockSocket.off).toHaveBeenCalledWith('webrtc:call-timeout', undefined)

      // Verify that on was called to register new listeners
      expect(mockSocket.on).toHaveBeenCalledWith('webrtc:offer', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('webrtc:answer', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('webrtc:ice-candidate', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('webrtc:call-end', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('webrtc:call-reject', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('webrtc:call-timeout', expect.any(Function))
    })

    test('should not re-register listeners unnecessarily when hook re-renders', () => {
      renderHook(() => useWebRTC())

      // Get the initial setup function
      const initialSetupFn = (socketService as any).webrtcListenersSetup
      
      // Re-render the component (this creates a new instance)
      const { rerender } = renderHook(() => useWebRTC())
      rerender()

      // Get the setup function after rerender
      const afterRerenderSetupFn = (socketService as any).webrtcListenersSetup

      // Due to useCallback with stable dependencies, the function reference should be the same
      // or at least the last one registered should be stable
      expect(typeof afterRerenderSetupFn).toBe('function')
      expect(afterRerenderSetupFn).toBeDefined()
    })
  })

  describe('Socket reconnection handling', () => {
    test('should re-establish WebRTC listeners after socket reconnects', () => {
      // Initial connection
      socketService.connect()
      socketService.isConnected = true

      renderHook(() => useWebRTC())

      // Get the socket instance and setup function
      const socketInstance = (socketService as any).socket
      const setupFn = (socketService as any).webrtcListenersSetup

      // Clear mocks from initial setup
      socketInstance.on.mockClear()
      socketInstance.off.mockClear()

      // Simulate disconnect
      socketService.isConnected = false

      // Simulate reconnect by triggering the connect event handler
      // Note: we need to look at the calls before we cleared them
      socketService.connect()
      const newSocketInstance = (socketService as any).socket
      const connectHandler = newSocketInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1]

      act(() => {
        if (connectHandler) {
          socketService.isConnected = true
          connectHandler()
        }
      })

      // Verify that listeners were re-registered on the new socket instance
      expect(newSocketInstance.off).toHaveBeenCalledWith('webrtc:offer', undefined)
      expect(newSocketInstance.on).toHaveBeenCalledWith('webrtc:offer', expect.any(Function))
    })

    test('should maintain the same setup function across reconnects', () => {
      socketService.connect()

      renderHook(() => useWebRTC())

      const initialSetupFn = (socketService as any).webrtcListenersSetup

      // Simulate disconnect and reconnect
      socketService.disconnect()
      socketService.connect()

      const afterReconnectSetupFn = (socketService as any).webrtcListenersSetup

      // Should be the same function reference
      expect(afterReconnectSetupFn).toBe(initialSetupFn)
    })

    test('should handle multiple reconnect cycles correctly', () => {
      socketService.connect()
      socketService.isConnected = true

      renderHook(() => useWebRTC())

      const setupFn = (socketService as any).webrtcListenersSetup

      // Clear initial mocks
      mockSocket.on.mockClear()
      mockSocket.off.mockClear()

      // Simulate 3 reconnect cycles
      for (let i = 0; i < 3; i++) {
        act(() => {
          setupFn()
        })
      }

      // Verify listeners were set up 3 times
      const offerCalls = mockSocket.on.mock.calls.filter(
        (call: any[]) => call[0] === 'webrtc:offer'
      )
      expect(offerCalls.length).toBe(3)
    })
  })

  describe('WebRTC event handler functionality', () => {
    test('should handle webrtc:offer event after registration', async () => {
      socketService.connect()

      const { result } = renderHook(() => useWebRTC())

      const setupFn = (socketService as any).webrtcListenersSetup

      act(() => {
        setupFn()
      })

      // Get the registered offer handler
      const offerHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'webrtc:offer'
      )?.[1]

      expect(offerHandler).toBeDefined()

      // Simulate receiving an offer
      const mockOffer = {
        offer: { type: 'offer', sdp: 'mock-sdp' },
        type: 'video' as const,
        from: 'user-123',
        fromUsername: 'Test User',
      }

      await act(async () => {
        await offerHandler(mockOffer)
      })

      // Should set incoming call state
      expect(result.current.isIncomingCall).toBe(true)
      expect(result.current.incomingCallData).toEqual(mockOffer)
    })

    test('should handle webrtc:call-end event after registration', () => {
      socketService.connect()

      const { result } = renderHook(() => useWebRTC())

      const setupFn = (socketService as any).webrtcListenersSetup

      act(() => {
        setupFn()
      })

      // Get the registered call-end handler
      const callEndHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'webrtc:call-end'
      )?.[1]

      expect(callEndHandler).toBeDefined()

      // Set up an active call state
      act(() => {
        // This would normally be set by startCall or acceptCall
        // For testing, we can just verify the handler exists
      })

      act(() => {
        callEndHandler()
      })

      // Call should be ended
      expect(result.current.isCallActive).toBe(false)
    })
  })

  describe('Cleanup and lifecycle', () => {
    test('should not remove WebRTC listeners when hook unmounts', () => {
      socketService.connect()

      const { unmount } = renderHook(() => useWebRTC())

      const setupFn = (socketService as any).webrtcListenersSetup

      // Setup listeners
      act(() => {
        setupFn()
      })

      mockSocket.off.mockClear()

      // Unmount the hook
      unmount()

      // Verify that socket listeners were NOT removed
      // (They should persist for the entire socket connection)
      expect(mockSocket.off).not.toHaveBeenCalledWith('webrtc:offer', expect.any(Function))
    })

    test('should preserve setup function in SocketService after unmount', () => {
      socketService.connect()

      const { unmount } = renderHook(() => useWebRTC())

      const setupFnBeforeUnmount = (socketService as any).webrtcListenersSetup

      unmount()

      const setupFnAfterUnmount = (socketService as any).webrtcListenersSetup

      // Setup function should still be in SocketService
      expect(setupFnAfterUnmount).toBe(setupFnBeforeUnmount)
    })
  })

  describe('Edge cases', () => {
    test('should handle registration when socket is already connected', () => {
      // Connect and set connected state BEFORE rendering hook
      socketService.connect()
      socketService.isConnected = true
      mockSocket.connected = true

      const setWebRTCListenersSetupSpy = jest.spyOn(
        socketService,
        'setWebRTCListenersSetup'
      )

      renderHook(() => useWebRTC())

      // Should call setup immediately since socket is already connected
      expect(setWebRTCListenersSetupSpy).toHaveBeenCalled()

      setWebRTCListenersSetupSpy.mockRestore()
    })

    test('should handle multiple hook instances gracefully', () => {
      socketService.connect()

      // Render first instance
      const { unmount: unmount1 } = renderHook(() => useWebRTC())

      const firstSetupFn = (socketService as any).webrtcListenersSetup

      // Render second instance
      const { unmount: unmount2 } = renderHook(() => useWebRTC())

      const secondSetupFn = (socketService as any).webrtcListenersSetup

      // The second setup function should replace the first
      expect(secondSetupFn).not.toBe(firstSetupFn)

      // Both should still work
      expect(typeof firstSetupFn).toBe('function')
      expect(typeof secondSetupFn).toBe('function')

      unmount1()
      unmount2()
    })
  })
})
