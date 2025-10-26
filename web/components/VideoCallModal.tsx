"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2, Phone } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import MediaErrorAlert from "@/components/MediaErrorAlert"
import { MediaError } from "@/lib/mediaUtils"

interface VideoCallModalProps {
  isOpen: boolean
  onClose: () => void
  connectedUser: {
    id: string
    username: string
  } | null
  currentUserId?: string
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  callType: "video" | "audio" | null
  callState: "idle" | "calling" | "ringing" | "connecting" | "connected"
  isCaller: boolean
  localVideoRef: React.RefObject<HTMLVideoElement>
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  mediaError: MediaError | null
  isRequestingPermissions: boolean
  endCall: () => void
}

export default function VideoCallModal({ 
  isOpen, 
  onClose, 
  connectedUser,
  currentUserId, 
  localStream, 
  remoteStream, 
  callType, 
  callState, 
  isCaller,
  localVideoRef, 
  remoteVideoRef,
  mediaError,
  isRequestingPermissions,
  endCall 
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(true)

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (callState === "connected") {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      setCallDuration(0)
    }
    return () => clearInterval(interval)
  }, [callState])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      // Ensure video plays when stream is attached
      localVideoRef.current.play().catch(e => console.log('Local video play error:', e))
    }
  }, [localStream, localVideoRef])

  // Update local video preview when video is toggled on/off
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        // When video is turned back on, ensure the video element is playing
        if (!isVideoOff && videoTrack.enabled) {
          localVideoRef.current.play().catch(e => console.log('Local video play error:', e))
        }
      }
    }
  }, [isVideoOff, localStream, localVideoRef])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('📺 VideoCallModal: Attaching remote stream to video element')
      console.log('📺 Remote stream tracks:', remoteStream.getTracks().map(t => ({kind: t.kind, enabled: t.enabled, readyState: t.readyState})))
      
      remoteVideoRef.current.srcObject = remoteStream
      
      // Monitor remote video track state
      const videoTrack = remoteStream.getVideoTracks()[0]
      if (videoTrack) {
        // Set initial state based on enabled property (not muted)
        setIsRemoteVideoEnabled(videoTrack.enabled)
        console.log(`📺 Initial remote video state: enabled=${videoTrack.enabled}, muted=${videoTrack.muted}, readyState=${videoTrack.readyState}`)
        
        // Poll for enabled state changes
        // Note: We use enabled property, NOT muted property
        // - enabled: user intentionally toggled video on/off
        // - muted: temporary state when track isn't receiving data yet
        const pollInterval = setInterval(() => {
          const currentEnabled = videoTrack.enabled
          if (currentEnabled !== isRemoteVideoEnabled) {
            console.log(`📺 Remote video enabled state changed: ${isRemoteVideoEnabled} -> ${currentEnabled}`)
            setIsRemoteVideoEnabled(currentEnabled)
          }
        }, 500)
        
        return () => {
          clearInterval(pollInterval)
        }
      }
      
      // Ensure video plays (important for mobile)
      remoteVideoRef.current.play().catch(error => {
        console.log('📺 Remote video play error (might be expected on mobile):', error)
      })
    } else if (!remoteStream) {
      console.log('📺 VideoCallModal: No remote stream available yet')
      setIsRemoteVideoEnabled(true) // Reset to default
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
        // Just toggle enabled state - keeps camera active but stops sending frames
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOff(!videoTrack.enabled)
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`)
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getCallStateText = () => {
    switch (callState) {
      case "calling":
        return "Calling..."
      case "ringing":
        return "Ringing..."
      case "connecting":
        return "Connecting..."
      case "connected":
        return formatDuration(callDuration)
      default:
        return ""
    }
  }
  
  const getCallStateColor = () => {
    switch (callState) {
      case "calling":
      case "ringing":
        return "text-yellow-400"
      case "connecting":
        return "text-blue-400"
      case "connected":
        return "text-green-400"
      default:
        return "text-gray-400"
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-screen w-full p-0 m-0 rounded-none border-none bg-black">
        <DialogTitle className="sr-only">
          {callType === "video" ? "Video" : "Audio"} call with {connectedUser?.username || "User"}
        </DialogTitle>
        <div className="relative h-full w-full overflow-hidden">
          
          {/* Remote Video - Full Screen Background */}
          <div className="absolute inset-0">
            {remoteStream && callType === "video" && isRemoteVideoEnabled ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full"
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false} /* Remote video should NOT be muted */
                  className="w-full h-full object-cover"
                  onLoadedMetadata={() => console.log('📺 Remote video metadata loaded')}
                  onPlaying={() => console.log('📺 Remote video is now playing!')}
                  onError={(e) => console.error('❌ Remote video error:', e)}
                />
              </motion.div>
            ) : callType === "video" && remoteStream && !isRemoteVideoEnabled ? (
              /* Show placeholder when remote user turned off video */
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <Avatar className="h-24 w-24 sm:h-32 sm:w-32 mb-6 ring-4 ring-white/20">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-2xl sm:text-4xl">
                      {connectedUser ? getInitials(connectedUser.username) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-white text-xl sm:text-3xl font-light mb-2">{connectedUser?.username}</h2>
                  <div className="flex items-center gap-2 text-gray-400 mt-4">
                    <VideoOff className="w-5 h-5" />
                    <p className="text-sm sm:text-base">Camera is off</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Gradient background when no remote video */
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  {/* Media Error Display */}
                  {mediaError && (
                    <div className="w-full max-w-md mb-6">
                      <MediaErrorAlert 
                        error={mediaError}
                        onDismiss={() => {
                          endCall()
                          onClose()
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Permission Request Display */}
                  {isRequestingPermissions && (
                    <div className="mb-6 p-4 bg-blue-900/50 rounded-lg border border-blue-400/30">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                        <p className="text-blue-200 font-medium">Requesting Permissions</p>
                      </div>
                      <p className="text-blue-300 text-sm">
                        Please allow access to your camera and microphone when prompted by your browser.
                      </p>
                    </div>
                  )}
                  
                  <Avatar className="h-24 w-24 sm:h-32 sm:w-32 mb-6 ring-4 ring-white/20">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-2xl sm:text-4xl">
                      {connectedUser ? getInitials(connectedUser.username) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-white text-xl sm:text-3xl font-light mb-2">{connectedUser?.username}</h2>
                  <p className={`text-sm sm:text-lg mb-4 ${getCallStateColor()}`}>{getCallStateText()}</p>
                  {callState === "ringing" && (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="inline-flex items-center gap-2 text-blue-400"
                    >
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm">{callType === "video" ? "Video calling" : "Voice calling"}</span>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Local Video - Small Overlay (WhatsApp Style) */}
          {callType === "video" && localStream && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-4 right-4 w-20 h-28 xs:w-24 xs:h-32 sm:w-28 sm:h-36 md:w-32 md:h-44 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-white/30 z-10"
            >
              {!isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                  onLoadedMetadata={() => console.log('📹 Local video metadata loaded')}
                  onPlaying={() => console.log('📹 Local video is now playing!')}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 mb-1">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-xs">
                      {currentUserId ? getInitials(currentUserId) : "You"}
                    </AvatarFallback>
                  </Avatar>
                  <VideoOff className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 mt-1" />
                </div>
              )}
            </motion.div>
          )}

          {/* Top Status Bar */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="absolute top-0 left-0 right-0 z-20"
          >
            <div className="bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-white/30">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-xs sm:text-sm">
                      {connectedUser ? getInitials(connectedUser.username) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-white font-medium text-sm sm:text-base">{connectedUser?.username}</h3>
                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        callState === "connected" 
                          ? "bg-green-400" 
                          : callState === "connecting" 
                            ? "bg-blue-400" 
                            : "bg-yellow-400"
                      } animate-pulse`}></div>
                      <span className={getCallStateColor()}>{getCallStateText()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom Control Bar */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <div className="bg-gradient-to-t from-black/90 to-transparent p-4 sm:p-6 pb-6 sm:pb-8">
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                
                {/* Mute/Unmute */}
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 p-0 shadow-lg ${
                      isMuted 
                        ? "bg-red-600 hover:bg-red-700 text-white" 
                        : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
                    }`}
                    onClick={toggleMute}
                  >
                    {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </Button>
                </motion.div>

                {/* Video Toggle */}
                {callType === "video" && (
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      variant={isVideoOff ? "destructive" : "secondary"}
                      className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 p-0 shadow-lg ${
                        isVideoOff 
                          ? "bg-red-600 hover:bg-red-700 text-white" 
                          : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
                      }`}
                      onClick={toggleVideo}
                    >
                      {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </Button>
                  </motion.div>
                )}

                {/* End Call */}
                <motion.div 
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <Button
                    variant="destructive"
                    className="rounded-full w-14 h-14 sm:w-16 sm:h-16 p-0 bg-red-600 hover:bg-red-700 shadow-lg"
                    onClick={handleEndCall}
                  >
                    <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
