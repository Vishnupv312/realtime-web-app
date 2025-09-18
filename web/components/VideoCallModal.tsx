"use client"

import { useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react"
import { motion } from "framer-motion"
import useWebRTC from "@/hooks/useWebRTC"
import { useState } from "react"

interface VideoCallModalProps {
  isOpen: boolean
  onClose: () => void
  connectedUser: {
    id: string
    username: string
  } | null
}

export default function VideoCallModal({ isOpen, onClose, connectedUser }: VideoCallModalProps) {
  const { localStream, remoteStream, isCallActive, callType, localVideoRef, remoteVideoRef, endCall } = useWebRTC()

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, localVideoRef])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream, remoteVideoRef])

  const handleEndCall = () => {
    endCall()
    onClose()
  }

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
      }
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (!isCallActive) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isFullscreen ? "max-w-full h-full" : "max-w-4xl"} p-0 bg-black`}>
        <div className="relative h-full min-h-[600px] bg-black rounded-lg overflow-hidden">
          {/* Remote Video */}
          <div className="absolute inset-0">
            {remoteStream && callType === "video" ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    <AvatarFallback className="bg-blue-600 text-white text-2xl">
                      {connectedUser ? getInitials(connectedUser.username) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-white text-xl font-semibold">{connectedUser?.username}</h3>
                  <p className="text-gray-400">{callType === "audio" ? "Audio call" : "Camera is off"}</p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video */}
          {callType === "video" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20"
            >
              {localStream && !isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </motion.div>
          )}

          {/* Call Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2"
          >
            <div className="flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-4">
              {/* Mute Button */}
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                className="rounded-full w-12 h-12 p-0"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              {/* Video Toggle (only for video calls) */}
              {callType === "video" && (
                <Button
                  variant={isVideoOff ? "destructive" : "secondary"}
                  size="lg"
                  className="rounded-full w-12 h-12 p-0"
                  onClick={toggleVideo}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>
              )}

              {/* Fullscreen Toggle */}
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-12 h-12 p-0"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>

              {/* End Call Button */}
              <Button
                variant="destructive"
                size="lg"
                className="rounded-full w-12 h-12 p-0 bg-red-600 hover:bg-red-700"
                onClick={handleEndCall}
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>

          {/* Call Info */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute top-6 left-6">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-white text-sm font-medium">
                  {callType === "video" ? "Video Call" : "Audio Call"}
                </span>
              </div>
              <p className="text-gray-300 text-xs">{connectedUser?.username}</p>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
