"use client"

import { useState, useEffect, useRef } from "react"
import socketService from "@/lib/socket"

interface IncomingCallData {
  offer: RTCSessionDescriptionInit
  type: "video" | "audio"
  from: string
  fromUsername: string
}

const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [callType, setCallType] = useState<"video" | "audio" | null>(null)
  const [incomingCallData, setIncomingCallData] = useState<IncomingCallData | null>(null)

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const servers: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
  }

  useEffect(() => {
    setupSocketListeners()
    return () => {
      cleanup()
    }
  }, [])

  const setupSocketListeners = (): void => {
    socketService.on("webrtc:offer", handleReceiveOffer)
    socketService.on("webrtc:answer", handleReceiveAnswer)
    socketService.on("webrtc:ice-candidate", handleReceiveIceCandidate)
  }

  const createPeerConnection = (): RTCPeerConnection => {
    peerConnection.current = new RTCPeerConnection(servers)

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(event.candidate)
      }
    }

    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0])
    }

    return peerConnection.current
  }

  const startCall = async (type: "video" | "audio" = "video"): Promise<void> => {
    try {
      setCallType(type)
      const constraints: MediaStreamConstraints = {
        video: type === "video",
        audio: true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      socketService.sendOffer(offer, type)
      setIsCallActive(true)
    } catch (error) {
      console.error("Error starting call:", error)
    }
  }

  const acceptCall = async (): Promise<void> => {
    if (!incomingCallData) return

    try {
      const constraints: MediaStreamConstraints = {
        video: incomingCallData.type === "video",
        audio: true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      await pc.setRemoteDescription(incomingCallData.offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socketService.sendAnswer(answer)

      setIsCallActive(true)
      setIsIncomingCall(false)
      setCallType(incomingCallData.type)
    } catch (error) {
      console.error("Error accepting call:", error)
    }
  }

  const rejectCall = (): void => {
    setIsIncomingCall(false)
    setIncomingCallData(null)
    cleanup()
  }

  const endCall = (): void => {
    setIsCallActive(false)
    cleanup()
  }

  const handleReceiveOffer = async (data: IncomingCallData): Promise<void> => {
    setIsIncomingCall(true)
    setIncomingCallData(data)
  }

  const handleReceiveAnswer = async (data: { answer: RTCSessionDescriptionInit }): Promise<void> => {
    try {
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(data.answer)
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

  const cleanup = (): void => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
    }

    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }

    setRemoteStream(null)
    setIsCallActive(false)
    setIsIncomingCall(false)
    setIncomingCallData(null)
    setCallType(null)
  }

  return {
    localStream,
    remoteStream,
    isCallActive,
    isIncomingCall,
    callType,
    incomingCallData,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  }
}

export default useWebRTC
