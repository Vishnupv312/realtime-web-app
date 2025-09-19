"use client"

import { useRef } from "react"

export interface CallLogEntry {
  type: "call-start" | "call-end" | "call-missed"
  callType: "video" | "audio"
  timestamp: string
  duration?: number // in seconds, only for call-end
  participants: {
    caller: string
    callee: string
  }
}

const useCallLogs = () => {
  const callStartTime = useRef<number | null>(null)

  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) {
      return `${secs}s`
    }
    return `${mins}m ${secs}s`
  }

  const createCallLogMessage = (
    logEntry: CallLogEntry,
    currentUserId: string
  ): {
    id: string
    senderId: string
    senderUsername: string
    type: "system"
    content: string
    timestamp: string
    isSystemMessage: true
  } => {
    const isIncoming = logEntry.participants.caller !== currentUserId
    const emoji = logEntry.type === "call-start" ? "📞" : 
                 logEntry.type === "call-end" ? "✅" : "❌"
    
    let content = ""
    const callTypeText = logEntry.callType === "video" ? "Video call" : "Voice call"
    const time = new Date(logEntry.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    switch (logEntry.type) {
      case "call-start":
        content = `${emoji} ${callTypeText} started – ${time}`
        break
      case "call-end":
        const duration = logEntry.duration ? formatCallDuration(logEntry.duration) : "0s"
        content = `${emoji} ${callTypeText} ended – ${duration}`
        break
      case "call-missed":
        content = `${emoji} Missed ${callTypeText.toLowerCase()} – ${time}`
        break
    }

    return {
      id: `call-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: "system",
      senderUsername: "System",
      type: "system" as const,
      content,
      timestamp: logEntry.timestamp,
      isSystemMessage: true
    }
  }

  const startCallTimer = () => {
    callStartTime.current = Date.now()
  }

  const getCallDuration = (): number => {
    if (callStartTime.current === null) return 0
    return Math.floor((Date.now() - callStartTime.current) / 1000)
  }

  const resetCallTimer = () => {
    callStartTime.current = null
  }

  return {
    createCallLogMessage,
    startCallTimer,
    getCallDuration,
    resetCallTimer
  }
}

export default useCallLogs