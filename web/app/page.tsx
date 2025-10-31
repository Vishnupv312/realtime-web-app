"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Users, Video, Zap } from "lucide-react"
import { motion } from "framer-motion"

export default function HomePage() {
  const router = useRouter()

  const features = [
    {
      icon: MessageCircle,
      title: "Real-time Chat",
      description: "Instant messaging with typing indicators and file sharing",
    },
    {
      icon: Users,
      title: "Random Matching",
      description: "Connect with random users from around the world",
    },
    {
      icon: Video,
      title: "Video & Audio Calls",
      description: "High-quality WebRTC video and audio calling",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Built with Next.js 15 and Socket.IO for optimal performance",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-16"
        >
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 text-balance">
            Connect & Chat
            <span className="text-blue-600 dark:text-blue-400"> Instantly</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto text-pretty">
            Experience seamless real-time communication with random users worldwide. No signup required - start chatting instantly!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button size="lg" onClick={() => router.push("/chat")} className="text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3">
              Start Chatting Now
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/match")} className="text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3">
              Find Random Match
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-16"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="text-center p-3 sm:p-4 lg:p-6">
                  <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-base sm:text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 lg:p-6">
                  <CardDescription className="text-center text-sm sm:text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-xl sm:text-2xl">Ready to Connect?</CardTitle>
              <CardDescription className="text-base sm:text-lg">
                Join thousands of users already chatting and making connections
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => router.push("/chat")}
                  className="text-base sm:text-lg px-6 sm:px-12 py-2.5 sm:py-3"
                >
                  Start Chatting
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/match")}
                  className="text-base sm:text-lg px-6 sm:px-12 py-2.5 sm:py-3"
                >
                  Find a Match
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
