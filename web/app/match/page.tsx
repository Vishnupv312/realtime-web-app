"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useGuestSession } from "@/contexts/GuestSessionContext"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import MatchingInterface from "@/components/MatchingInterface"
import GuestUsernameModal from "@/components/GuestUsernameModal"

export default function MatchPage() {
  const router = useRouter()
  const { guestUser, initializeGuestSession } = useGuestSession()
  const [showUsernameModal, setShowUsernameModal] = useState(false)

  useEffect(() => {
    if (!guestUser) {
      setShowUsernameModal(true)
    }
  }, [guestUser])

  const handleUsernameComplete = async (username: string) => {
    try {
      await initializeGuestSession(username)
      setShowUsernameModal(false)
    } catch (error) {
      console.error('Failed to initialize guest session:', error)
      // Keep modal open on error so user can retry
    }
  }

  const handleMatchFound = () => {
    router.push("/chat")
  }

  // Show loading state while guest session is being initialized
  if (!guestUser && !showUsernameModal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Preparing your session...
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-sm sm:text-base">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Back to Home</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-12">
          <MatchingInterface onMatchFound={handleMatchFound} />
        </div>
      </div>
      
      {/* Username Modal */}
      <GuestUsernameModal
        isOpen={showUsernameModal}
        onComplete={handleUsernameComplete}
      />
    </>
  )
}
