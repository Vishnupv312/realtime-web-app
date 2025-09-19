"use client"

import { useState, useEffect, useRef } from "react"
import socketService from "@/lib/socket"
import useCallLogs from "@/hooks/useCallLogs"
import MediaUtils, { type MediaError } from "@/lib/mediaUtils"

interface IncomingCallData {
  offer: RTCSessionDescriptionInit
  type: "video" | "audio"
  from: string
  fromUsername: string
}

type CallState = "idle" | "calling" | "ringing" | "connecting" | "connected"

interface UseWebRTCProps {
  connectedUser?: { id: string; username: string } | null
  currentUserId?: string
  addSystemMessage?: (content: string) => void
}

const useWebRTC = (props?: UseWebRTCProps) => {
  const { connectedUser, currentUserId, addSystemMessage } = props || {}
  const { createCallLogMessage, startCallTimer, getCallDuration, resetCallTimer } = useCallLogs()
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [callType, setCallType] = useState<"video" | "audio" | null>(null)
  const [callState, setCallState] = useState<CallState>("idle")
  const [incomingCallData, setIncomingCallData] = useState<IncomingCallData | null>(null)
  const [isCaller, setIsCaller] = useState(false)
  const [mediaError, setMediaError] = useState<MediaError | null>(null)
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false)

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const servers: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
  }

  useEffect(() => {
    setupSocketListeners()
    return () => {
      // Remove socket listeners to prevent memory leaks
      socketService.off("webrtc:offer", handleReceiveOffer)
      socketService.off("webrtc:answer", handleReceiveAnswer)
      socketService.off("webrtc:ice-candidate", handleReceiveIceCandidate)
      socketService.off("webrtc:call-end", handleReceiveCallEnd)
      socketService.off("webrtc:call-reject", handleReceiveCallReject)
      cleanup()
    }
  }, [])

  const setupSocketListeners = (): void => {
    socketService.on("webrtc:offer", handleReceiveOffer)
    socketService.on("webrtc:answer", handleReceiveAnswer)
    socketService.on("webrtc:ice-candidate", handleReceiveIceCandidate)
    socketService.on("webrtc:call-end", handleReceiveCallEnd)
    socketService.on("webrtc:call-reject", handleReceiveCallReject)
  }

  const createPeerConnection = (): RTCPeerConnection => {
    if (peerConnection.current) {
      peerConnection.current.close()
    }
    
    peerConnection.current = new RTCPeerConnection(servers)

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(event.candidate)
      }
    }

    peerConnection.current.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0])
      setRemoteStream(event.streams[0])
      setCallState("connected")
    }

    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current) {
        console.log('Connection state changed:', peerConnection.current.connectionState)
        if (peerConnection.current.connectionState === 'connected') {
          setCallState("connected")
        } else if (peerConnection.current.connectionState === 'disconnected' || 
                  peerConnection.current.connectionState === 'failed') {
          // Handle connection failures - end call as remote end to avoid double signaling
          endCall(true)
        }
      }
    }

    return peerConnection.current
  }

  const startCall = async (type: "video" | "audio" = "video"): Promise<void> => {
    try {
      console.log(`🚀 Starting ${type} call...`)
      console.log('📱 Device info:', MediaUtils.getDeviceInfo())
      
      setCallType(type)
      setCallState("calling")
      setIsCaller(true)
      setIsCallActive(true) // Show the modal immediately
      setMediaError(null) // Clear any previous errors
      setIsRequestingPermissions(true)
      
      // Log call start
      if (connectedUser && currentUserId && addSystemMessage) {
        const callLogEntry = {
          type: "call-start" as const,
          callType: type,
          timestamp: new Date().toISOString(),
          participants: {
            caller: currentUserId,
            callee: connectedUser.id
          }
        }
        const logMessage = createCallLogMessage(callLogEntry, currentUserId)
        addSystemMessage(logMessage.content)
        startCallTimer()
      }

      // Get local stream using mobile-compatible MediaUtils
      const mediaResult = await MediaUtils.getUserMedia(type === "video", true)
      setIsRequestingPermissions(false)

      if (!mediaResult.success || !mediaResult.stream) {
        console.error('❌ Failed to get media stream:', mediaResult.error)
        setMediaError(mediaResult.error || { type: 'UNKNOWN', message: 'Failed to access camera and microphone' })
        
        // Show error message to user
        if (addSystemMessage) {
          addSystemMessage(`❌ Call failed: ${mediaResult.error?.message || 'Unable to access camera and microphone'}`)
        }
        
        setCallState("idle")
        setIsCallActive(false)
        cleanup()
        return
      }

      const stream = mediaResult.stream
      setLocalStream(stream)
      console.log('✅ Local stream obtained successfully')

      // Set up video element right away for immediate preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        console.log('📹 Local video element configured')
      }

      // Create peer connection and add tracks
      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => {
        console.log(`➕ Adding ${track.kind} track to peer connection`)
        pc.addTrack(track, stream)
      })

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      socketService.sendOffer(offer, type)
      setCallState("ringing")
      console.log('📞 Call offer sent, waiting for response...')
      
    } catch (error: any) {
      console.error("❌ Error starting call:", error)
      setIsRequestingPermissions(false)
      
      const mediaError: MediaError = {
        type: 'UNKNOWN',
        message: error?.message || 'An unexpected error occurred while starting the call',
        originalError: error
      }
      setMediaError(mediaError)
      
      if (addSystemMessage) {
        addSystemMessage(`❌ Call failed: ${mediaError.message}`)
      }
      
      setCallState("idle")
      setIsCallActive(false)
      cleanup()
    }
  }

  const acceptCall = async (): Promise<void> => {
    if (!incomingCallData) return

    try {
      console.log(`📞 Accepting ${incomingCallData.type} call from ${incomingCallData.fromUsername}...`)
      console.log('📱 Device info:', MediaUtils.getDeviceInfo())
      
      setCallState("connecting")
      setIsCaller(false)
      setIsCallActive(true)
      setIsIncomingCall(false)
      setCallType(incomingCallData.type)
      setMediaError(null) // Clear any previous errors
      setIsRequestingPermissions(true)
      
      // Log call start when accepting (callee side)
      if (connectedUser && currentUserId && addSystemMessage) {
        const callLogEntry = {
          type: "call-start" as const,
          callType: incomingCallData.type,
          timestamp: new Date().toISOString(),
          participants: {
            caller: incomingCallData.from,
            callee: currentUserId
          }
        }
        const logMessage = createCallLogMessage(callLogEntry, currentUserId)
        addSystemMessage(logMessage.content)
        startCallTimer()
      }

      // Get local stream using mobile-compatible MediaUtils
      const mediaResult = await MediaUtils.getUserMedia(incomingCallData.type === "video", true)
      setIsRequestingPermissions(false)

      if (!mediaResult.success || !mediaResult.stream) {
        console.error('❌ Failed to get media stream while accepting call:', mediaResult.error)
        setMediaError(mediaResult.error || { type: 'UNKNOWN', message: 'Failed to access camera and microphone' })
        
        // Show error message to user
        if (addSystemMessage) {
          addSystemMessage(`❌ Failed to accept call: ${mediaResult.error?.message || 'Unable to access camera and microphone'}`)
        }
        
        setCallState("idle")
        setIsCallActive(false)
        setIsIncomingCall(false)
        cleanup()
        return
      }

      const stream = mediaResult.stream
      setLocalStream(stream)
      console.log('✅ Local stream obtained for call acceptance')

      // Set up video element for immediate preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        console.log('📹 Local video element configured for callee')
      }

      // Create peer connection and add tracks
      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => {
        console.log(`➕ Adding ${track.kind} track to peer connection (callee)`)
        pc.addTrack(track, stream)
      })

      // Set remote description first, then create answer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socketService.sendAnswer(answer)
      console.log('📡 Call answer sent successfully')
      
    } catch (error: any) {
      console.error("❌ Error accepting call:", error)
      setIsRequestingPermissions(false)
      
      const mediaError: MediaError = {
        type: 'UNKNOWN',
        message: error?.message || 'An unexpected error occurred while accepting the call',
        originalError: error
      }
      setMediaError(mediaError)
      
      if (addSystemMessage) {
        addSystemMessage(`❌ Failed to accept call: ${mediaError.message}`)
      }
      
      setCallState("idle")
      setIsCallActive(false)
      setIsIncomingCall(false)
      cleanup()
    }
  }

  const rejectCall = (): void => {
    // Send rejection signal to caller
    socketService.sendCallReject()
    
    // Log missed call when rejecting
    if (incomingCallData && connectedUser && currentUserId && addSystemMessage) {
      const callLogEntry = {
        type: "call-missed" as const,
        callType: incomingCallData.type,
        timestamp: new Date().toISOString(),
        participants: {
          caller: incomingCallData.from,
          callee: currentUserId
        }
      }
      const logMessage = createCallLogMessage(callLogEntry, currentUserId)
      addSystemMessage(logMessage.content)
    }
    
    setIsIncomingCall(false)
    setIncomingCallData(null)
    cleanup()
  }

  const endCall = (isRemoteEnd: boolean = false): void => {
    // Send call end signal only if we're ending the call (not receiving remote end)
    if (!isRemoteEnd && (callState === "connected" || callState === "connecting" || callState === "ringing")) {
      socketService.sendCallEnd()
    }
    
    // Log call end with duration if call was connected
    if ((callState === "connected" || callState === "connecting") && connectedUser && currentUserId && addSystemMessage && callType) {
      const duration = getCallDuration()
      if (duration > 0) { // Only log if call had actual duration
        const callLogEntry = {
          type: "call-end" as const,
          callType: callType,
          timestamp: new Date().toISOString(),
          duration,
          participants: {
            caller: isCaller ? currentUserId : connectedUser.id,
            callee: isCaller ? connectedUser.id : currentUserId
          }
        }
        const logMessage = createCallLogMessage(callLogEntry, currentUserId)
        addSystemMessage(logMessage.content)
      }
    }
    
    setIsCallActive(false)
    cleanup()
  }

  const handleReceiveOffer = async (data: IncomingCallData): Promise<void> => {
    setIsIncomingCall(true)
    setIncomingCallData(data)
  }

  const handleReceiveAnswer = async (data: { answer: RTCSessionDescriptionInit }): Promise<void> => {
    try {
      if (peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
        setCallState("connecting")
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer))
        console.log('Successfully set remote answer')
      } else {
        console.warn('Peer connection not in correct state for answer:', peerConnection.current?.signalingState)
      }
    } catch (error) {
      console.error("Error handling answer:", error)
    }
  }

  const handleReceiveIceCandidate = async (data: { candidate: RTCIceCandidate }): Promise<void> => {
    try {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(data.candidate)
      }
    } catch (error) {
      console.error("Error adding ICE candidate:", error)
    }
  }

  const handleReceiveCallEnd = (): void => {
    console.log('Received call end from remote user')
    
    // Log call end with duration if call was connected
    if ((callState === "connected" || callState === "connecting") && connectedUser && currentUserId && addSystemMessage && callType) {
      const duration = getCallDuration()
      if (duration > 0) { // Only log if call had actual duration
        const callLogEntry = {
          type: "call-end" as const,
          callType: callType,
          timestamp: new Date().toISOString(),
          duration,
          participants: {
            caller: isCaller ? currentUserId : connectedUser.id,
            callee: isCaller ? connectedUser.id : currentUserId
          }
        }
        const logMessage = createCallLogMessage(callLogEntry, currentUserId)
        addSystemMessage(logMessage.content)
      }
    }
    
    // End the call locally without sending signal (remote already ended)
    setIsCallActive(false)
    cleanup()
  }

  const handleReceiveCallReject = (): void => {
    console.log('Call was rejected by remote user')
    
    // Log missed call when call was rejected
    if (callType && connectedUser && currentUserId && addSystemMessage) {
      const callLogEntry = {
        type: "call-missed" as const,
        callType: callType,
        timestamp: new Date().toISOString(),
        participants: {
          caller: currentUserId,
          callee: connectedUser.id
        }
      }
      const logMessage = createCallLogMessage(callLogEntry, currentUserId)
      addSystemMessage(logMessage.content)
    }
    
    // Clean up call state
    setIsCallActive(false)
    setCallState("idle")
    cleanup()
  }

  const cleanup = (): void => {
    console.log('🧹 Cleaning up WebRTC resources...')
    
    // Stop all local stream tracks using MediaUtils
    MediaUtils.stopMediaStream(localStream)
    setLocalStream(null)

    // Stop all remote stream tracks using MediaUtils
    MediaUtils.stopMediaStream(remoteStream)
    setRemoteStream(null)

    // Close and cleanup peer connection
    if (peerConnection.current) {
      console.log('Closing peer connection')
      
      // Remove event listeners to prevent callbacks during cleanup
      peerConnection.current.onicecandidate = null
      peerConnection.current.ontrack = null
      peerConnection.current.onconnectionstatechange = null
      
      // Close the connection
      if (peerConnection.current.connectionState !== 'closed') {
        peerConnection.current.close()
      }
      peerConnection.current = null
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }

    // Reset all state
    setRemoteStream(null)
    setIsCallActive(false)
    setIsIncomingCall(false)
    setIncomingCallData(null)
    setCallType(null)
    setCallState("idle")
    setIsCaller(false)
    resetCallTimer()
    
    console.log('WebRTC cleanup completed')
  }

  return {
    localStream,
    remoteStream,
    isCallActive,
    isIncomingCall,
    callType,
    callState,
    isCaller,
    incomingCallData,
    localVideoRef,
    remoteVideoRef,
    mediaError,
    isRequestingPermissions,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  }
}

export default useWebRTC
