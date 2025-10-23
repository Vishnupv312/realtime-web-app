"use client";

import { useState, useEffect, useRef } from "react";
import socketService from "@/lib/socket";
import useCallLogs from "@/hooks/useCallLogs";
import MediaUtils, { type MediaError } from "@/lib/mediaUtils";

interface IncomingCallData {
  offer: RTCSessionDescriptionInit;
  type: "video" | "audio";
  from: string;
  fromUsername: string;
}

type CallState = "idle" | "calling" | "ringing" | "connecting" | "connected";

interface UseWebRTCProps {
  connectedUser?: { id: string; username: string } | null;
  currentUserId?: string;
  addSystemMessage?: (content: string) => void;
  callTimeoutDuration?: number; // Optional timeout duration in milliseconds
}

const useWebRTC = (props?: UseWebRTCProps) => {
  const {
    connectedUser,
    currentUserId,
    addSystemMessage,
    callTimeoutDuration,
  } = props || {};
  const {
    createCallLogMessage,
    startCallTimer,
    getCallDuration,
    resetCallTimer,
  } = useCallLogs();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callType, setCallType] = useState<"video" | "audio" | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [incomingCallData, setIncomingCallData] =
    useState<IncomingCallData | null>(null);
  const [isCaller, setIsCaller] = useState(false);
  const [mediaError, setMediaError] = useState<MediaError | null>(null);
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const CALL_TIMEOUT_DURATION = callTimeoutDuration || 30000; // Default 30 seconds, configurable

  const servers: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    setupSocketListeners();
    return () => {
      // Remove socket listeners to prevent memory leaks
      socketService.off("webrtc:offer", handleReceiveOffer);
      socketService.off("webrtc:answer", handleReceiveAnswer);
      socketService.off("webrtc:ice-candidate", handleReceiveIceCandidate);
      socketService.off("webrtc:call-end", handleReceiveCallEnd);
      socketService.off("webrtc:call-reject", handleReceiveCallReject);
      socketService.off("webrtc:call-timeout", handleReceiveCallTimeout);
      cleanup();
    };
  }, []);

  const setupSocketListeners = (): void => {
    socketService.on("webrtc:offer", handleReceiveOffer);
    socketService.on("webrtc:answer", handleReceiveAnswer);
    socketService.on("webrtc:ice-candidate", handleReceiveIceCandidate);
    socketService.on("webrtc:call-end", handleReceiveCallEnd);
    socketService.on("webrtc:call-reject", handleReceiveCallReject);
    socketService.on("webrtc:call-timeout", handleReceiveCallTimeout);
  };

  const createPeerConnection = (): RTCPeerConnection => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    peerConnection.current = new RTCPeerConnection(servers);

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🧊 Sending ICE candidate:", event.candidate.type);
        socketService.sendIceCandidate(event.candidate);
      } else {
        console.log("🧊 All ICE candidates sent");
      }
    };

    peerConnection.current.ontrack = (event) => {
      console.log("📺 ONTRACK EVENT FIRED!");
      console.log("📺 Track received:", {
        kind: event.track.kind,
        id: event.track.id,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted
      });
      console.log("📺 Remote stream received:", event.streams[0]);
      console.log(
        "📺 Stream tracks:",
        event.streams[0]
          .getTracks()
          .map((t) => ({
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          }))
      );

      const remoteStream = event.streams[0];
      setRemoteStream(remoteStream);
      
      // Log total receivers
      console.log(`🔍 Total receivers: ${peerConnection.current?.getReceivers().length}`);
      peerConnection.current?.getReceivers().forEach((receiver, index) => {
        console.log(`   Receiver ${index}: ${receiver.track?.kind} track`);
      });

      // Immediately attach to video element if it exists
      setTimeout(() => {
        if (remoteVideoRef.current && remoteStream) {
          console.log("📺 Attaching remote stream to video element");
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current
            .play()
            .catch((e) =>
              console.log("Remote video play error (expected on mobile):", e)
            );
        }
      }, 100);

      setCallState("connected");
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      if (peerConnection.current) {
        const state = peerConnection.current.iceConnectionState;
        console.log("🧊 ICE connection state changed:", state);

        switch (state) {
          case "checking":
            console.log("🔍 ICE checking connectivity...");
            break;
          case "connected":
            console.log("✅ ICE connected!");
            setCallState("connected");
            break;
          case "completed":
            console.log("✅ ICE completed!");
            setCallState("connected");
            break;
          case "failed":
            console.log("❌ ICE connection failed - may need TURN server");
            if (addSystemMessage) {
              addSystemMessage(
                "❌ Call failed: Network connection could not be established"
              );
            }
            endCall(true);
            break;
          case "disconnected":
            console.warn("⚠️ ICE disconnected - waiting before ending call");
            // Give it 3 seconds to reconnect
            setTimeout(() => {
              if (
                peerConnection.current?.iceConnectionState === "disconnected"
              ) {
                console.log("❌ ICE remained disconnected - ending call");
                endCall(true);
              }
            }, 3000);
            break;
          case "closed":
            console.log("🔒 ICE connection closed");
            break;
        }
      }
    };

    peerConnection.current.onicegatheringstatechange = () => {
      if (peerConnection.current) {
        console.log(
          "🧊 ICE gathering state:",
          peerConnection.current.iceGatheringState
        );
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current) {
        console.log(
          "🔗 Connection state changed:",
          peerConnection.current.connectionState
        );

        switch (peerConnection.current.connectionState) {
          case "connected":
            console.log("✅ WebRTC connection established successfully!");
            setCallState("connected");
            break;
          case "connecting":
            console.log("🔗 WebRTC connection in progress...");
            setCallState("connecting");
            break;
          case "failed":
            console.log("❌ WebRTC connection failed - ending call");
            endCall(true);
            break;
          case "disconnected":
            console.log(
              "⚠️ WebRTC connection disconnected - waiting before ending call"
            );
            // Give it a moment to reconnect before ending the call
            setTimeout(() => {
              if (peerConnection.current?.connectionState === "disconnected") {
                console.log(
                  "❌ Connection remained disconnected - ending call"
                );
                endCall(true);
              }
            }, 3000); // Wait 3 seconds
            break;
          case "closed":
            console.log("🔗 WebRTC connection closed");
            break;
          default:
            console.log(
              "🔗 WebRTC connection state:",
              peerConnection.current.connectionState
            );
        }
      }
    };

    return peerConnection.current;
  };

  const startCall = async (
    type: "video" | "audio" = "video"
  ): Promise<void> => {
    try {
      console.log(`🚀 Starting ${type} call...`);
      console.log("📱 Device info:", MediaUtils.getDeviceInfo());

      setCallType(type);
      setCallState("calling");
      setIsCaller(true);
      setIsCallActive(true); // Show the modal immediately
      setMediaError(null); // Clear any previous errors
      setIsRequestingPermissions(true);

      // Log call start
      if (connectedUser && currentUserId && addSystemMessage) {
        const callLogEntry = {
          type: "call-start" as const,
          callType: type,
          timestamp: new Date().toISOString(),
          participants: {
            caller: currentUserId,
            callee: connectedUser.id,
          },
        };
        const logMessage = createCallLogMessage(callLogEntry, currentUserId);
        addSystemMessage(logMessage.content);
        startCallTimer();
      }

      // Get local stream using mobile-compatible MediaUtils
      const mediaResult = await MediaUtils.getUserMedia(type === "video", true);
      setIsRequestingPermissions(false);

      if (!mediaResult.success || !mediaResult.stream) {
        console.log("❌ Failed to get media stream:", mediaResult.error);
        setMediaError(
          mediaResult.error || {
            type: "UNKNOWN",
            message: "Failed to access camera and microphone",
          }
        );

        // Show error message to user
        if (addSystemMessage) {
          addSystemMessage(
            `❌ Call failed: ${
              mediaResult.error?.message ||
              "Unable to access camera and microphone"
            }`
          );
        }

        setCallState("idle");
        setIsCallActive(false);
        cleanup();
        return;
      }

      const stream = mediaResult.stream;
      setLocalStream(stream);
      console.log("✅ Local stream obtained successfully");

      // Set up video element right away for immediate preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("📹 Local video element configured");
      }

      // Create peer connection and add tracks
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        console.log(
          `➕ Adding ${track.kind} track to peer connection (caller)`
        );
        console.log(
          `   Track details: enabled=${track.enabled}, readyState=${track.readyState}`
        );
        const sender = pc.addTrack(track, stream);
        console.log(`   Sender added:`, sender);
      });

      // Verify senders
      console.log(`🔍 Total senders on peer connection: ${pc.getSenders().length}`);
      pc.getSenders().forEach((sender, index) => {
        console.log(`   Sender ${index}: ${sender.track?.kind} track`);
      });

      // Log current peer connection state
      console.log(
        "🔗 Peer connection created for caller, current state:",
        pc.connectionState
      );

      // Create and send offer
      console.log("📡 Creating WebRTC offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("📡 Local description set:", offer);
      
      // Check if SDP contains media tracks
      const sdpHasAudio = offer.sdp?.includes('m=audio');
      const sdpHasVideo = offer.sdp?.includes('m=video');
      console.log(`🔍 SDP analysis: audio=${sdpHasAudio}, video=${sdpHasVideo}`);
      if (!sdpHasAudio && !sdpHasVideo) {
        console.error('❌ SDP does not contain any media tracks!');
      }

      socketService.sendOffer(offer, type);
      setCallState("ringing");
      console.log("📞 Call offer sent, waiting for response...");

      // Set call timeout for automatic disconnect
      callTimeoutRef.current = setTimeout(() => {
        console.log("⏰ Call timeout - no answer received");
        handleCallTimeout();
      }, CALL_TIMEOUT_DURATION);
    } catch (error: any) {
      console.log("❌ Error starting call:", error);
      setIsRequestingPermissions(false);

      const mediaError: MediaError = {
        type: "UNKNOWN",
        message:
          error?.message ||
          "An unexpected error occurred while starting the call",
        originalError: error,
      };
      setMediaError(mediaError);

      if (addSystemMessage) {
        addSystemMessage(`❌ Call failed: ${mediaError.message}`);
      }

      setCallState("idle");
      setIsCallActive(false);
      cleanup();
    }
  };

  const acceptCall = async (): Promise<void> => {
    if (!incomingCallData) return;

    try {
      console.log(
        `📞 Accepting ${incomingCallData.type} call from ${incomingCallData.fromUsername}...`
      );
      console.log("📱 Device info:", MediaUtils.getDeviceInfo());

      setCallState("connecting");
      setIsCaller(false);
      setIsCallActive(true);
      setIsIncomingCall(false);
      setCallType(incomingCallData.type);
      setMediaError(null); // Clear any previous errors
      setIsRequestingPermissions(true);

      // Log call start when accepting (callee side)
      if (connectedUser && currentUserId && addSystemMessage) {
        const callLogEntry = {
          type: "call-start" as const,
          callType: incomingCallData.type,
          timestamp: new Date().toISOString(),
          participants: {
            caller: incomingCallData.from,
            callee: currentUserId,
          },
        };
        const logMessage = createCallLogMessage(callLogEntry, currentUserId);
        addSystemMessage(logMessage.content);
        startCallTimer();
      }

      // Get local stream using mobile-compatible MediaUtils
      const mediaResult = await MediaUtils.getUserMedia(
        incomingCallData.type === "video",
        true
      );
      setIsRequestingPermissions(false);

      if (!mediaResult.success || !mediaResult.stream) {
        console.log(
          "❌ Failed to get media stream while accepting call:",
          mediaResult.error
        );
        setMediaError(
          mediaResult.error || {
            type: "UNKNOWN",
            message: "Failed to access camera and microphone",
          }
        );

        // Show error message to user
        if (addSystemMessage) {
          addSystemMessage(
            `❌ Failed to accept call: ${
              mediaResult.error?.message ||
              "Unable to access camera and microphone"
            }`
          );
        }

        setCallState("idle");
        setIsCallActive(false);
        setIsIncomingCall(false);
        cleanup();
        return;
      }

      const stream = mediaResult.stream;
      setLocalStream(stream);
      console.log("✅ Local stream obtained for call acceptance");

      // Set up video element for immediate preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("📹 Local video element configured for callee");
      }

      // Create peer connection and add tracks
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => {
        console.log(
          `➕ Adding ${track.kind} track to peer connection (callee)`
        );
        console.log(
          `   Track details: enabled=${track.enabled}, readyState=${track.readyState}`
        );
        const sender = pc.addTrack(track, stream);
        console.log(`   Sender added:`, sender);
      });

      // Verify senders
      console.log(`🔍 Total senders on peer connection: ${pc.getSenders().length}`);
      pc.getSenders().forEach((sender, index) => {
        console.log(`   Sender ${index}: ${sender.track?.kind} track`);
      });

      // Log current peer connection state
      console.log(
        "🔗 Peer connection created for callee, current state:",
        pc.connectionState
      );

      // Set remote description first, then create answer
      console.log("📡 Setting remote description from offer...");
      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCallData.offer)
      );
      console.log("✅ Remote description set successfully");

      // Process any queued ICE candidates now that remote description is set
      console.log(
        "🧊 Processing any queued ICE candidates after setting remote description..."
      );
      await processQueuedIceCandidates();

      console.log("📡 Creating WebRTC answer...");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("📡 Local description set:", answer);
      
      // Check if SDP contains media tracks
      const sdpHasAudio = answer.sdp?.includes('m=audio');
      const sdpHasVideo = answer.sdp?.includes('m=video');
      console.log(`🔍 SDP analysis: audio=${sdpHasAudio}, video=${sdpHasVideo}`);
      if (!sdpHasAudio && !sdpHasVideo) {
        console.error('❌ SDP does not contain any media tracks!');
      }

      socketService.sendAnswer(answer);
      console.log("📡 Call answer sent successfully");

      // Clear any existing call timeout since call was accepted
      clearCallTimeout();
    } catch (error: any) {
      console.log("❌ Error accepting call:", error);
      setIsRequestingPermissions(false);

      const mediaError: MediaError = {
        type: "UNKNOWN",
        message:
          error?.message ||
          "An unexpected error occurred while accepting the call",
        originalError: error,
      };
      setMediaError(mediaError);

      if (addSystemMessage) {
        addSystemMessage(`❌ Failed to accept call: ${mediaError.message}`);
      }

      setCallState("idle");
      setIsCallActive(false);
      setIsIncomingCall(false);
      cleanup();
    }
  };

  const rejectCall = (): void => {
    // Send rejection signal to caller
    socketService.sendCallReject();

    // Log missed call when rejecting
    if (
      incomingCallData &&
      connectedUser &&
      currentUserId &&
      addSystemMessage
    ) {
      const callLogEntry = {
        type: "call-missed" as const,
        callType: incomingCallData.type,
        timestamp: new Date().toISOString(),
        participants: {
          caller: incomingCallData.from,
          callee: currentUserId,
        },
      };
      const logMessage = createCallLogMessage(callLogEntry, currentUserId);
      addSystemMessage(logMessage.content);
    }

    setIsIncomingCall(false);
    setIncomingCallData(null);
    cleanup();
  };

  const endCall = (isRemoteEnd: boolean = false): void => {
    console.log(
      `📞 Ending call - isRemoteEnd: ${isRemoteEnd}, callState: ${callState}`
    );

    // Clear any pending timeouts
    clearCallTimeout();

    // Send call end signal only if we're ending the call (not receiving remote end)
    if (
      !isRemoteEnd &&
      (callState === "connected" ||
        callState === "connecting" ||
        callState === "ringing")
    ) {
      console.log("📡 Sending call end signal to remote user");
      socketService.sendCallEnd();
    }

    // Log call end with duration if call was connected
    if (
      (callState === "connected" || callState === "connecting") &&
      connectedUser &&
      currentUserId &&
      addSystemMessage &&
      callType
    ) {
      const duration = getCallDuration();
      console.log(`🕓 Call duration: ${duration} seconds`);

      if (duration > 0) {
        // Only log if call had actual duration
        const callLogEntry = {
          type: "call-end" as const,
          callType: callType,
          timestamp: new Date().toISOString(),
          duration,
          participants: {
            caller: isCaller ? currentUserId : connectedUser.id,
            callee: isCaller ? connectedUser.id : currentUserId,
          },
        };
        const logMessage = createCallLogMessage(callLogEntry, currentUserId);
        addSystemMessage(logMessage.content);
        console.log("📝 Added call end system message");
      }
    }

    setIsCallActive(false);
    cleanup();
  };

  const handleReceiveOffer = async (data: IncomingCallData): Promise<void> => {
    console.log("📞 Received WebRTC offer:", data);
    setIsIncomingCall(true);
    setIncomingCallData(data);
  };

  const handleReceiveAnswer = async (data: {
    answer: RTCSessionDescriptionInit;
  }): Promise<void> => {
    try {
      console.log("📞 Received WebRTC answer:", data);
      console.log(
        "📞 Peer connection state:",
        peerConnection.current?.signalingState
      );

      if (peerConnection.current) {
        if (peerConnection.current.signalingState === "have-local-offer") {
          setCallState("connecting");
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          console.log(
            "✅ Successfully set remote answer - WebRTC connection should be establishing..."
          );

          // Clear call timeout since call was answered
          clearCallTimeout();

          // Process any queued ICE candidates now that remote description is set
          console.log(
            "🧊 Processing any queued ICE candidates after setting remote answer..."
          );
          await processQueuedIceCandidates();
        } else {
          console.warn(
            "⚠️ Peer connection not in correct state for answer:",
            peerConnection.current.signalingState
          );
        }
      } else {
        console.log("❌ No peer connection available when receiving answer");
      }
    } catch (error) {
      console.log("❌ Error handling answer:", error);
    }
  };

  const handleReceiveIceCandidate = async (data: {
    candidate: RTCIceCandidate;
  }): Promise<void> => {
    try {
      console.log(
        "🧊 Received ICE candidate:",
        data.candidate.type,
        data.candidate.candidate
      );

      // Always add to queue first to prevent race conditions
      iceCandidateQueue.current.push(data.candidate);

      // If remote description is set, process the queue immediately
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        console.log(
          "🧊 Remote description exists, processing ICE candidate queue..."
        );
        await processQueuedIceCandidates();
      } else {
        console.log("🧊 ICE candidate queued - waiting for remote description");
      }
    } catch (error) {
      console.log("❌ Error handling ICE candidate:", error);
    }
  };

  const processQueuedIceCandidates = async (): Promise<void> => {
    if (!peerConnection.current || !peerConnection.current.remoteDescription) {
      console.log(
        "⏸️ Cannot process ICE candidates - no remote description yet"
      );
      return;
    }

    const queueLength = iceCandidateQueue.current.length;

    if (queueLength === 0) {
      console.log("✅ No ICE candidates in queue to process");
      return;
    }

    console.log(`🧊 Processing ${queueLength} queued ICE candidates`);

    // Process all candidates in the queue
    const candidatesToProcess = [...iceCandidateQueue.current];
    iceCandidateQueue.current = []; // Clear queue immediately to prevent duplicates

    for (const candidate of candidatesToProcess) {
      try {
        if (
          peerConnection.current &&
          peerConnection.current.remoteDescription
        ) {
          await peerConnection.current.addIceCandidate(candidate);
          console.log("✅ Queued ICE candidate added successfully");
        }
      } catch (error) {
        console.log("❌ Error adding queued ICE candidate:", error);
        // Don't stop processing on error, continue with next candidate
      }
    }

    console.log(
      `✅ Finished processing ${candidatesToProcess.length} ICE candidates`
    );
  };

  const clearCallTimeout = (): void => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
      console.log("✅ Call timeout cleared");
    }
  };

  const handleCallTimeout = (): void => {
    console.log("⏰ Handling call timeout - marking as missed call");

    // Log missed call when timeout occurs (caller side)
    if (callType && connectedUser && currentUserId && addSystemMessage) {
      const callLogEntry = {
        type: "call-missed" as const,
        callType: callType,
        timestamp: new Date().toISOString(),
        participants: {
          caller: currentUserId,
          callee: connectedUser.id,
        },
      };
      const logMessage = createCallLogMessage(callLogEntry, currentUserId);
      addSystemMessage(logMessage.content);
    }

    // Send timeout signal to other user
    socketService.sendCallTimeout();

    // End the call locally
    setCallState("idle");
    setIsCallActive(false);
    cleanup();
  };

  const handleReceiveCallEnd = (): void => {
    console.log("Received call end from remote user");

    // Clear any pending timeouts
    clearCallTimeout();

    // Log call end with duration if call was connected
    if (
      (callState === "connected" || callState === "connecting") &&
      connectedUser &&
      currentUserId &&
      addSystemMessage &&
      callType
    ) {
      const duration = getCallDuration();
      console.log(`🕓 Remote call end - duration: ${duration} seconds`);

      if (duration > 0) {
        // Only log if call had actual duration
        const callLogEntry = {
          type: "call-end" as const,
          callType: callType,
          timestamp: new Date().toISOString(),
          duration,
          participants: {
            caller: isCaller ? currentUserId : connectedUser.id,
            callee: isCaller ? connectedUser.id : currentUserId,
          },
        };
        const logMessage = createCallLogMessage(callLogEntry, currentUserId);
        addSystemMessage(logMessage.content);
        console.log("📝 Added call end system message (from remote)");
      }
    }

    // End the call locally without sending signal (remote already ended)
    setIsCallActive(false);
    setCallState("idle");
    cleanup();
  };

  const handleReceiveCallReject = (): void => {
    console.log("Call was rejected by remote user");

    // Clear any pending timeouts
    clearCallTimeout();

    // Log missed call when call was rejected
    if (callType && connectedUser && currentUserId && addSystemMessage) {
      const callLogEntry = {
        type: "call-missed" as const,
        callType: callType,
        timestamp: new Date().toISOString(),
        participants: {
          caller: currentUserId,
          callee: connectedUser.id,
        },
      };
      const logMessage = createCallLogMessage(callLogEntry, currentUserId);
      addSystemMessage(logMessage.content);
    }

    // Clean up call state
    setIsCallActive(false);
    setCallState("idle");
    cleanup();
  };

  const handleReceiveCallTimeout = (): void => {
    console.log("Call timed out - received from remote user");

    // Log missed call when timeout is received (callee side)
    if (
      incomingCallData &&
      connectedUser &&
      currentUserId &&
      addSystemMessage
    ) {
      const callLogEntry = {
        type: "call-missed" as const,
        callType: incomingCallData.type,
        timestamp: new Date().toISOString(),
        participants: {
          caller: incomingCallData.from,
          callee: currentUserId,
        },
      };
      const logMessage = createCallLogMessage(callLogEntry, currentUserId);
      addSystemMessage(logMessage.content);
    }

    // Clean up call state
    setIsIncomingCall(false);
    setIncomingCallData(null);
    setIsCallActive(false);
    setCallState("idle");
    cleanup();
  };

  const cleanup = (): void => {
    console.log("🧹 Cleaning up WebRTC resources...");

    // Stop all local stream tracks using MediaUtils
    MediaUtils.stopMediaStream(localStream);
    setLocalStream(null);

    // Stop all remote stream tracks using MediaUtils
    MediaUtils.stopMediaStream(remoteStream);
    setRemoteStream(null);

    // Close and cleanup peer connection
    if (peerConnection.current) {
      console.log("Closing peer connection");

      // Remove event listeners to prevent callbacks during cleanup
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.onconnectionstatechange = null;

      // Close the connection
      if (peerConnection.current.connectionState !== "closed") {
        peerConnection.current.close();
      }
      peerConnection.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear call timeout and ICE candidate queue
    clearCallTimeout();
    iceCandidateQueue.current = [];

    // Reset all state
    setRemoteStream(null);
    setIsCallActive(false);
    setIsIncomingCall(false);
    setIncomingCallData(null);
    setCallType(null);
    setCallState("idle");
    setIsCaller(false);
    resetCallTimer();

    console.log("WebRTC cleanup completed");
  };

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
  };
};

export default useWebRTC;
