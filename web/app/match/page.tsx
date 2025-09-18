"use client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"
import MatchingInterface from "@/components/MatchingInterface"

export default function MatchPage() {
  const router = useRouter()

  const handleMatchFound = () => {
    router.push("/chat")
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <MatchingInterface onMatchFound={handleMatchFound} />
        </div>
      </div>
    </ProtectedRoute>
  )
}
