"use client"

import { Button } from "./ui/button"

export default function SessionTestButton() {
  const simulateExpiredSession = () => {
    // Clear the session to simulate expiration
    sessionStorage.removeItem("guestAuthToken")
    console.log("🧪 Simulated session expiration - next API call will trigger regeneration")
  }

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <Button 
      onClick={simulateExpiredSession}
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 bg-red-100 hover:bg-red-200 text-red-700 text-xs"
    >
      🧪 Test Session Expiry
    </Button>
  )
}