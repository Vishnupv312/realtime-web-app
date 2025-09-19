"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Camera, Mic, Settings, Smartphone } from "lucide-react"
import { MediaError } from "@/lib/mediaUtils"

interface MediaErrorAlertProps {
  error: MediaError
  onRetry?: () => void
  onDismiss?: () => void
}

export default function MediaErrorAlert({ error, onRetry, onDismiss }: MediaErrorAlertProps) {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'PERMISSION_DENIED':
        return <Camera className="h-4 w-4" />
      case 'NOT_FOUND':
        return <Mic className="h-4 w-4" />
      case 'NOT_SUPPORTED':
        return <Smartphone className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getErrorTitle = () => {
    switch (error.type) {
      case 'PERMISSION_DENIED':
        return "Permission Required"
      case 'NOT_FOUND':
        return "Device Not Found"
      case 'NOT_SUPPORTED':
        return "Not Supported"
      case 'CONSTRAINT_ERROR':
        return "Settings Issue"
      default:
        return "Media Access Error"
    }
  }

  const getHelpText = () => {
    switch (error.type) {
      case 'PERMISSION_DENIED':
        return (
          <div className="mt-2 space-y-2 text-sm">
            <p><strong>To fix this:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Click the camera/microphone icon in your browser's address bar</li>
              <li>Select "Allow" for camera and microphone permissions</li>
              <li>If using mobile: Check your browser settings and device permissions</li>
              <li>Try refreshing the page and allowing permissions</li>
            </ul>
          </div>
        )
      case 'NOT_FOUND':
        return (
          <div className="mt-2 space-y-2 text-sm">
            <p><strong>Try these solutions:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Make sure your camera and microphone are connected</li>
              <li>Close other apps that might be using your camera</li>
              <li>Check that your devices are not muted or disabled</li>
              <li>Try restarting your browser</li>
            </ul>
          </div>
        )
      case 'NOT_SUPPORTED':
        return (
          <div className="mt-2 space-y-2 text-sm">
            <p><strong>Browser compatibility issue:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use a modern browser (Chrome, Safari, Firefox, Edge)</li>
              <li>Make sure you're using HTTPS (secure connection)</li>
              <li>Update your browser to the latest version</li>
              <li>On iOS: Use Safari instead of Chrome for better compatibility</li>
            </ul>
          </div>
        )
      default:
        return (
          <div className="mt-2 text-sm">
            <p>Please check your camera and microphone settings, then try again.</p>
          </div>
        )
    }
  }

  const shouldShowRetry = error.type !== 'NOT_SUPPORTED'

  return (
    <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
      <div className="flex">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="ml-3 flex-1">
          <AlertTitle className="text-red-800 dark:text-red-200">
            {getErrorTitle()}
          </AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            <p className="mb-2">{error.message}</p>
            {getHelpText()}
          </AlertDescription>
          
          <div className="flex gap-2 mt-4">
            {shouldShowRetry && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300"
              >
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://support.google.com/chrome/answer/2693767')}
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300"
            >
              <Settings className="w-4 h-4 mr-1" />
              Help
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="text-red-600 hover:bg-red-100 dark:text-red-400"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </Alert>
  )
}