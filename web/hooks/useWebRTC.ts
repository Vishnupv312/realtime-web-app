"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  console.log("🎯 useWebRTC hook initialized", { 
    hasProps: !!props, 
    connectedUser: props?.connectedUser?.username,
    currentUserId: props?.currentUserId 
  });
  
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
  const [callDuration, setCallDuration] = useState<number>(0);
  
  // Refs to hold latest state for event handlers (prevents stale closures)
  const callStateRef = useRef<CallState>(callState);
  const isCallActiveRef = useRef<boolean>(isCallActive);
  
  // Keep refs in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // WebRTC state refs - these persist across re-renders but reset on unmount
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const CALL_TIMEOUT_DURATION = callTimeoutDuration || 30000; // Default 30 seconds, configurable
  
  // CRITICAL: Track if WebRTC socket listeners have been set up
  // This ref helps prevent duplicate listener registration when component re-renders
  // However, due to React's lifecycle, refs reset when components fully unmount/remount
  const listenersSetupRef = useRef(false);

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

  const handleReceiveOffer = useCallback(async (data: IncomingCallData): Promise<void> => {
    const timestamp = new Date().toISOString();
    console.log("📞 ===========================================");
    console.log("📞 RECEIVED WEBRTC OFFER!");
    console.log("📞 ===========================================");
    console.log(`📞 [${timestamp}] Offer data:`, data);
    console.log(`   From: ${data.fromUsername} (${data.from})`);
    console.log(`   Type: ${data.type}`);
    console.log(`   Current call state (from ref): ${callStateRef.current}`);
    console.log(`   isCallActive (from ref): ${isCallActiveRef.current}`);
    console.log(`   Listeners setup ref: ${listenersSetupRef.current}`);
    console.log("📞 ===========================================");
    
    // If we're already in a call, ignore the new offer
    // CRITICAL: Use refs to get the latest state, avoiding stale closures
    if (isCallActiveRef.current || callStateRef.current !== "idle") {
      console.warn("⚠️ Ignoring incoming call - already in a call");
      return;
    }
    
    // Clean up any previous state before accepting new call
    if (peerConnection.current) {
      console.log("🧹 Cleaning up previous peer connection before new call");
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    setIsIncomingCall(true);
    setIncomingCallData(data);
    console.log("✅ Incoming call state set, waiting for user to accept/reject");
  }, []); // Empty deps - uses refs for latest state

  const handleReceiveAnswer = useCallback(async (data: {
    answer: RTCSessionDescriptionInit;
  }): Promise<void> => {
    try {
      const timestamp = new Date().toISOString();
      console.log("📞 ===========================================");
      console.log("📞 RECEIVED WEBRTC ANSWER!");
      console.log("📞 ===========================================");
      console.log(`📞 [${timestamp}] Answer data:`, data);
      console.log(
        `   Peer connection state: ${peerConnection.current?.signalingState}`
      );
      console.log(`   Peer connection exists: ${!!peerConnection.current}`);
      console.log(`   Listeners setup ref: ${listenersSetupRef.current}`);
      console.log("📞 ===========================================");

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
  }, []); // Empty deps - uses refs

  const handleReceiveIceCandidate = useCallback(async (data: {
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
  }, []); // Empty deps - uses refs

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

  const handleReceiveCallEnd = useCallback((): void => {
    console.log("Received call end from remote user");

    // Clear any pending timeouts
    clearCallTimeout();

    // Log call end with duration if call was connected
    if (
      (callStateRef.current === "connected" || callStateRef.current === "connecting") &&
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
  }, [connectedUser, currentUserId, addSystemMessage, callType, isCaller, getCallDuration]);

  const handleReceiveCallReject = useCallback((): void => {
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
  }, [callType, connectedUser, currentUserId, addSystemMessage]);

  const handleReceiveCallTimeout = useCallback((): void => {
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
  }, [incomingCallData, connectedUser, currentUserId, addSystemMessage]);

  const cleanup = (): void => {
    console.log("🧹 Cleaning up WebRTC resources...");

    // Stop all local stream tracks
    if (localStream) {
      console.log("🛑 Stopping local stream tracks...");
      localStream.getTracks().forEach(track => {
        console.log(`   Stopping ${track.kind} track (readyState: ${track.readyState})`);
        track.stop();
        console.log(`   ✅ ${track.kind} track stopped (readyState: ${track.readyState})`);
      });
    }
    setLocalStream(null);

    // Stop all remote stream tracks
    if (remoteStream) {
      console.log("🛑 Stopping remote stream tracks...");
      remoteStream.getTracks().forEach(track => {
        console.log(`   Stopping ${track.kind} track`);
        track.stop();
      });
    }
    setRemoteStream(null);

    // Close and cleanup peer connection
    if (peerConnection.current) {
      console.log("Closing peer connection");

      // Remove all event listeners to prevent callbacks during cleanup
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.onicegatheringstatechange = null;
      peerConnection.current.onsignalingstatechange = null;

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
    setMediaError(null);
    setIsRequestingPermissions(false);
    resetCallTimer();

    console.log("✅ WebRTC cleanup completed - all tracks stopped");
  };

  /**
   * Sets up all WebRTC socket event listeners
   * 
   * This function is called ONCE when the useWebRTC hook first mounts.
   * The listeners registered here will persist for the entire socket connection.
   * 
   * IMPORTANT: This must be defined AFTER all handler functions (handleReceiveOffer, etc.)
   * so that the handlers are not undefined when registered.
   * 
   * Events handled:
   * - webrtc:offer: Incoming call from another user
   * - webrtc:answer: Response to our call offer
   * - webrtc:ice-candidate: ICE candidates for NAT traversal
   * - webrtc:call-end: Remote user ended the call
   * - webrtc:call-reject: Remote user rejected our call
   * - webrtc:call-timeout: Call timed out (no answer)
   */
  const setupSocketListeners = useCallback((): void => {
    const timestamp = new Date().toISOString();
    console.log(`🔌 [${timestamp}] Removing any existing WebRTC listeners...`);
    
    // Remove any existing listeners first to prevent duplicates
    // This is a safety measure in case listeners were set up before
    socketService.off("webrtc:offer");
    socketService.off("webrtc:answer");
    socketService.off("webrtc:ice-candidate");
    socketService.off("webrtc:call-end");
    socketService.off("webrtc:call-reject");
    socketService.off("webrtc:call-timeout");
    
    console.log(`🔌 [${timestamp}] Registering WebRTC socket event handlers...`);
    console.log(`   handleReceiveOffer type: ${typeof handleReceiveOffer}`);
    console.log(`   handleReceiveAnswer type: ${typeof handleReceiveAnswer}`);
    
    // Register fresh listeners
    // IMPORTANT: These listeners will NOT be removed until:
    // 1. The page is refreshed/closed
    // 2. The socket disconnects
    // 3. The user navigates away
    socketService.on("webrtc:offer", handleReceiveOffer);
    socketService.on("webrtc:answer", handleReceiveAnswer);
    socketService.on("webrtc:ice-candidate", handleReceiveIceCandidate);
    socketService.on("webrtc:call-end", handleReceiveCallEnd);
    socketService.on("webrtc:call-reject", handleReceiveCallReject);
    socketService.on("webrtc:call-timeout", handleReceiveCallTimeout);
    
    console.log(`✅ [${timestamp}] WebRTC socket listeners registered successfully`);
    console.log(`ℹ️  Listeners will persist for entire socket connection (no cleanup on component unmount)`);
  }, [handleReceiveOffer, handleReceiveAnswer, handleReceiveIceCandidate, handleReceiveCallEnd, handleReceiveCallReject, handleReceiveCallTimeout]);

  // CRITICAL SECTION: WebRTC Socket Listener Setup
  // ================================================
  // This effect registers the WebRTC listener setup function with socketService.
  // The socketService will call this function whenever the socket connects or reconnects.
  // 
  // WHY THIS APPROACH?
  // ------------------
  // The socket instance gets recreated when users connect/reconnect. If we register
  // listeners only once, they'll be attached to a stale socket instance.
  // By registering the setup function with socketService, listeners are automatically
  // re-registered on every socket connection, ensuring they're always on the active socket.
  useEffect(() => {
    console.log("🔌 Registering WebRTC listener setup with socketService...");
    
    // Register the setup function to be called on every socket connection
    socketService.setWebRTCListenersSetup(setupSocketListeners);
    
    // No cleanup needed - socketService manages the lifecycle
    return undefined;
  }, [setupSocketListeners]); // Only re-register if setupSocketListeners changes (which it won't due to useCallback)

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
