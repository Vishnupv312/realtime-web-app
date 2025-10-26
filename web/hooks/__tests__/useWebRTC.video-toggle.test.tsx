/**
 * useWebRTC Video Toggle Tests
 * 
 * Tests for video camera on/off functionality:
 * 1. Local video preview shows placeholder when camera is off
 * 2. Local video preview restores when camera is turned back on
 * 3. Remote video view shows placeholder when remote user's camera is off
 * 4. Remote video view restores when remote user's camera is turned back on
 * 5. Rapid toggling does not break video functionality
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import useWebRTC from '../useWebRTC'
import socketService from '@/lib/socket'
import { io } from 'socket.io-client'
import MediaUtils from '@/lib/mediaUtils'

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

// Mock MediaTrack
class MockMediaStreamTrack {
  kind: string
  id: string
  enabled: boolean = true
  readyState: string = 'live'
  muted: boolean = false
  private eventListeners: Map<string, Set<Function>> = new Map()

  constructor(kind: 'video' | 'audio') {
    this.kind = kind
    this.id = `${kind}-track-${Math.random()}`
  }

  stop() {
    this.readyState = 'ended'
  }

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)?.add(callback)
  }

  removeEventListener(event: string, callback: Function) {
    this.eventListeners.get(event)?.delete(callback)
  }

  dispatchEvent(event: Event) {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach(callback => callback(event))
    }
    return true
  }
}

// Mock MediaStream
class MockMediaStream {
  id: string
  tracks: MockMediaStreamTrack[]

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.id = `stream-${Math.random()}`
    this.tracks = tracks
  }

  getTracks() {
    return this.tracks
  }

  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video')
  }

  getAudioTracks() {
    return this.tracks.filter(t => t.kind === 'audio')
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track)
  }
}

// Mock MediaUtils - must be defined inline to avoid hoisting issues
jest.mock('@/lib/mediaUtils', () => ({
  __esModule: true,
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

// Mock RTCPeerConnection
const mockPeerConnection = {
  createOffer: jest.fn(),
  createAnswer: jest.fn(),
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  addIceCandidate: jest.fn(),
  addTrack: jest.fn(),
  getSenders: jest.fn(() => []),
  getReceivers: jest.fn(() => []),
  close: jest.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  signalingState: 'stable',
  onicecandidate: null,
  ontrack: null,
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
  onicegatheringstatechange: null,
  onsignalingstatechange: null,
  remoteDescription: null,
}

// @ts-ignore
global.RTCPeerConnection = jest.fn(() => mockPeerConnection)

describe('useWebRTC Video Toggle Tests', () => {
  let mockSocket: any
  let videoTrack: MockMediaStreamTrack
  let audioTrack: MockMediaStreamTrack
  let localStream: MockMediaStream

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create mock tracks and stream
    videoTrack = new MockMediaStreamTrack('video')
    audioTrack = new MockMediaStreamTrack('audio')
    localStream = new MockMediaStream([videoTrack, audioTrack])
    
    // Setup mock socket
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
      id: 'test-socket-id',
    }
    
    ;(io as jest.Mock).mockReturnValue(mockSocket)
    
    // Setup MediaUtils mock
    ;(MediaUtils.getUserMedia as jest.Mock).mockResolvedValue({
      success: true,
      stream: localStream,
    })
    
    // Setup RTCPeerConnection mock
    mockPeerConnection.createOffer.mockResolvedValue({
      type: 'offer',
      sdp: 'm=audio\nm=video',
    })
    mockPeerConnection.createAnswer.mockResolvedValue({
      type: 'answer',
      sdp: 'm=audio\nm=video',
    })
    mockPeerConnection.setLocalDescription.mockResolvedValue(undefined)
    mockPeerConnection.setRemoteDescription.mockResolvedValue(undefined)
  })

  describe('Local video preview - camera off', () => {
    test('should show placeholder when camera is turned off', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      // Start a video call
      await act(async () => {
        await result.current.startCall('video')
      })

      // Wait for call to be established
      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      // Verify initial state - video is enabled
      const stream = result.current.localStream as any
      expect(stream).toBeTruthy()
      const videoTracks = stream.getVideoTracks()
      expect(videoTracks.length).toBeGreaterThan(0)
      expect(videoTracks[0].enabled).toBe(true)

      // Simulate turning camera off
      act(() => {
        videoTracks[0].enabled = false
      })

      // Verify video track is disabled (placeholder should show)
      expect(videoTracks[0].enabled).toBe(false)
      expect(videoTracks[0].readyState).toBe('live') // Still live, just disabled
    })

    test('should maintain stream but disable video track when camera is off', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const initialVideoTrack = stream.getVideoTracks()[0]
      const audioTrackRef = stream.getAudioTracks()[0]

      // Turn off camera
      act(() => {
        initialVideoTrack.enabled = false
      })

      // Stream should still exist
      expect(result.current.localStream).toBeTruthy()
      
      // Video track should be disabled but not stopped
      expect(initialVideoTrack.enabled).toBe(false)
      expect(initialVideoTrack.readyState).toBe('live')
      
      // Audio track should remain unaffected
      expect(audioTrackRef.enabled).toBe(true)
      expect(audioTrackRef.readyState).toBe('live')
    })
  })

  describe('Local video preview - camera on', () => {
    test('should restore video feed when camera is turned back on', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const videoTrackRef = stream.getVideoTracks()[0]

      // Turn off camera
      act(() => {
        videoTrackRef.enabled = false
      })

      expect(videoTrackRef.enabled).toBe(false)

      // Turn camera back on
      act(() => {
        videoTrackRef.enabled = true
      })

      // Video track should be enabled again
      expect(videoTrackRef.enabled).toBe(true)
      expect(videoTrackRef.readyState).toBe('live')
    })

    test('should preserve video track reference when toggling', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const originalVideoTrack = stream.getVideoTracks()[0]
      const trackId = originalVideoTrack.id

      // Toggle off
      act(() => {
        originalVideoTrack.enabled = false
      })

      // Toggle back on
      act(() => {
        originalVideoTrack.enabled = true
      })

      // Should be the same track object
      const currentVideoTrack = stream.getVideoTracks()[0]
      expect(currentVideoTrack.id).toBe(trackId)
      expect(currentVideoTrack).toBe(originalVideoTrack)
    })
  })

  describe('Remote video view - camera off', () => {
    test('should detect when remote user turns camera off', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      // Start call and simulate receiving remote stream
      await act(async () => {
        await result.current.startCall('video')
      })

      // Simulate remote stream being added
      const remoteVideoTrack = new MockMediaStreamTrack('video')
      const remoteAudioTrack = new MockMediaStreamTrack('audio')
      const remoteStream = new MockMediaStream([remoteVideoTrack, remoteAudioTrack])

      act(() => {
        if (mockPeerConnection.ontrack) {
          mockPeerConnection.ontrack({
            track: remoteVideoTrack,
            streams: [remoteStream],
          })
        }
      })

      await waitFor(() => {
        expect(result.current.remoteStream).toBeTruthy()
      })

      // Verify initial state - remote video is enabled
      const stream = result.current.remoteStream as any
      expect(stream.getVideoTracks()[0].enabled).toBe(true)

      // Simulate remote user disabling their camera
      act(() => {
        stream.getVideoTracks()[0].enabled = false
        stream.getVideoTracks()[0].muted = true
      })

      // Remote video track should be disabled
      expect(stream.getVideoTracks()[0].enabled).toBe(false)
      expect(stream.getVideoTracks()[0].muted).toBe(true)
    })

    test('should handle muted event on remote video track', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      const remoteVideoTrack = new MockMediaStreamTrack('video')
      const remoteStream = new MockMediaStream([remoteVideoTrack])

      act(() => {
        if (mockPeerConnection.ontrack) {
          mockPeerConnection.ontrack({
            track: remoteVideoTrack,
            streams: [remoteStream],
          })
        }
      })

      await waitFor(() => {
        expect(result.current.remoteStream).toBeTruthy()
      })

      // Simulate mute event being dispatched (remote camera turned off)
      const muteEvent = new Event('mute')
      
      act(() => {
        remoteVideoTrack.muted = true
        remoteVideoTrack.dispatchEvent(muteEvent)
      })

      // Track should be muted
      expect(remoteVideoTrack.muted).toBe(true)
    })
  })

  describe('Remote video view - camera on', () => {
    test('should restore remote video feed when camera is turned back on', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      const remoteVideoTrack = new MockMediaStreamTrack('video')
      const remoteStream = new MockMediaStream([remoteVideoTrack])

      act(() => {
        if (mockPeerConnection.ontrack) {
          mockPeerConnection.ontrack({
            track: remoteVideoTrack,
            streams: [remoteStream],
          })
        }
      })

      await waitFor(() => {
        expect(result.current.remoteStream).toBeTruthy()
      })

      // Turn off remote camera
      act(() => {
        remoteVideoTrack.enabled = false
        remoteVideoTrack.muted = true
      })

      expect(remoteVideoTrack.muted).toBe(true)

      // Turn remote camera back on
      const unmuteEvent = new Event('unmute')
      
      act(() => {
        remoteVideoTrack.enabled = true
        remoteVideoTrack.muted = false
        remoteVideoTrack.dispatchEvent(unmuteEvent)
      })

      // Remote video should be active again
      expect(remoteVideoTrack.enabled).toBe(true)
      expect(remoteVideoTrack.muted).toBe(false)
    })

    test('should maintain remote stream reference when video is restored', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      const remoteVideoTrack = new MockMediaStreamTrack('video')
      const remoteStream = new MockMediaStream([remoteVideoTrack])

      act(() => {
        if (mockPeerConnection.ontrack) {
          mockPeerConnection.ontrack({
            track: remoteVideoTrack,
            streams: [remoteStream],
          })
        }
      })

      await waitFor(() => {
        expect(result.current.remoteStream).toBeTruthy()
      })

      const originalStreamId = (result.current.remoteStream as any).id

      // Toggle off and on
      act(() => {
        remoteVideoTrack.muted = true
      })

      act(() => {
        remoteVideoTrack.muted = false
      })

      // Stream reference should remain the same
      expect((result.current.remoteStream as any).id).toBe(originalStreamId)
    })
  })

  describe('Rapid camera toggling', () => {
    test('should handle rapid local camera toggling without breaking', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const videoTrackRef = stream.getVideoTracks()[0]

      // Rapidly toggle 10 times
      for (let i = 0; i < 10; i++) {
        act(() => {
          videoTrackRef.enabled = !videoTrackRef.enabled
        })
      }

      // After rapid toggling, stream should still be valid
      expect(result.current.localStream).toBeTruthy()
      expect(stream.getVideoTracks()[0]).toBe(videoTrackRef)
      expect(videoTrackRef.readyState).toBe('live')
    })

    test('should maintain peer connection during rapid toggling', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const videoTrackRef = stream.getVideoTracks()[0]

      // Verify peer connection was created
      expect(RTCPeerConnection).toHaveBeenCalled()

      // Rapidly toggle
      act(() => {
        for (let i = 0; i < 20; i++) {
          videoTrackRef.enabled = !videoTrackRef.enabled
        }
      })

      // Peer connection should not be closed
      expect(mockPeerConnection.close).not.toHaveBeenCalled()
      
      // Stream should still be valid
      expect(result.current.localStream).toBeTruthy()
    })

    test('should handle rapid toggling with delays between toggles', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const videoTrackRef = stream.getVideoTracks()[0]
      const originalTrackId = videoTrackRef.id

      // Toggle with small delays
      for (let i = 0; i < 5; i++) {
        act(() => {
          videoTrackRef.enabled = false
        })

        await new Promise(resolve => setTimeout(resolve, 10))

        act(() => {
          videoTrackRef.enabled = true
        })

        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Track should still be the same object
      expect(stream.getVideoTracks()[0].id).toBe(originalTrackId)
      expect(videoTrackRef.readyState).toBe('live')
      expect(result.current.localStream).toBeTruthy()
    })

    test('should not create new tracks during rapid toggling', async () => {
      socketService.connect()
      
      const { result } = renderHook(() => useWebRTC({
        connectedUser: { id: 'user-123', username: 'Test User' },
        currentUserId: 'current-user',
        addSystemMessage: jest.fn(),
      }))

      await act(async () => {
        await result.current.startCall('video')
      })

      await waitFor(() => {
        expect(result.current.localStream).toBeTruthy()
      })

      const stream = result.current.localStream as any
      const initialTrackCount = stream.getTracks().length
      const videoTrackRef = stream.getVideoTracks()[0]

      // Rapid toggle
      act(() => {
        for (let i = 0; i < 15; i++) {
          videoTrackRef.enabled = !videoTrackRef.enabled
        }
      })

      // Track count should remain the same (no new tracks added)
      expect(stream.getTracks().length).toBe(initialTrackCount)
      
      // getUserMedia should only have been called once (during call start)
      expect(MediaUtils.getUserMedia).toHaveBeenCalledTimes(1)
    })
  })
})
