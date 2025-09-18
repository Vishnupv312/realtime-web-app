"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Users,
  Globe,
  MapPin,
  Clock,
  Shuffle,
  X,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";

interface MatchingInterfaceProps {
  onMatchFound: () => void;
}

export default function MatchingInterface({
  onMatchFound,
}: MatchingInterfaceProps) {
  const { user } = useAuth();
  const { isMatching, connectedUser, requestMatch, cancelMatch } = useChat();
  const [matchingStage, setMatchingStage] = useState<
    "idle" | "searching" | "found" | "failed"
  >("idle");
  const [searchDuration, setSearchDuration] = useState(0);
  const [showMatchDialog, setShowMatchDialog] = useState(false);

  useEffect(() => {
    if (isMatching) {
      setMatchingStage("searching");
      setShowMatchDialog(true);
      setSearchDuration(0);
    } else if (connectedUser) {
      setMatchingStage("found");
      setTimeout(() => {
        setShowMatchDialog(false);
        onMatchFound();
      }, 2000);
    } else if (matchingStage === "searching") {
      setMatchingStage("failed");
      setTimeout(() => {
        setShowMatchDialog(false);
        setMatchingStage("idle");
      }, 3000);
    }
  }, [isMatching, connectedUser, matchingStage, onMatchFound]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (matchingStage === "searching") {
      interval = setInterval(() => {
        setSearchDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [matchingStage]);

  const handleStartMatching = () => {
    requestMatch();
  };

  const handleCancelMatching = () => {
    cancelMatch();
    setMatchingStage("idle");
    setShowMatchDialog(false);
    setSearchDuration(0);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Main Matching Interface */}
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Find Your Next Chat Partner
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 text-pretty">
            Connect with interesting people from around the world. Start a
            conversation, make new friends, or just have fun chatting!
          </p>
        </motion.div>

        {/* Matching Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        >
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-blue-600" />
                Random Match
              </CardTitle>
              <CardDescription>
                Connect with a random person instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleStartMatching}
                disabled={isMatching}
                className="w-full"
                size="lg"
              >
                {isMatching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Start Random Chat
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-600" />
                Global Chat
              </CardTitle>
              <CardDescription>
                Join conversations from around the world
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                size="lg"
                disabled
              >
                <Globe className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* User Stats */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Your Profile
                </CardTitle>
                <CardDescription>
                  This is how others will see you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-blue-600 text-white text-lg">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {user.username}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={user.isOnline ? "default" : "secondary"}>
                        {user.isOnline ? "Online" : "Offline"}
                      </Badge>
                      {user.location && (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" />
                          {user.location.city}, {user.location.country}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Matching Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {matchingStage === "searching" && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.2,
                      ease: "easeInOut",
                    }}
                    className="flex items-center justify-center"
                  >
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mr-2" />
                  </motion.div>
                  <span className="font-medium text-blue-600">
                    Looking for your perfect match...
                  </span>
                </>
              )}

              {matchingStage === "found" && (
                <>
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  Match Found!
                </>
              )}
              {matchingStage === "failed" && (
                <>
                  <X className="w-5 h-5 text-red-600" />
                  No Match Found
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {matchingStage === "searching" &&
                "We're searching for the perfect chat partner for you. This might take a moment..."}
              {matchingStage === "found" &&
                "Great! We found someone for you to chat with. Starting conversation..."}
              {matchingStage === "failed" &&
                "Sorry, no users are available right now. Please try again in a few moments."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-6">
            <AnimatePresence mode="wait">
              {matchingStage === "searching" && (
                <motion.div
                  key="searching"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <div className="relative mb-6">
                    {/* User Icon */}
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center relative z-10">
                      <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>

                    {/* Outer pulsing ring */}
                    <motion.div
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute inset-0 rounded-full border-2 border-blue-400"
                    />

                    {/* Second ripple for depth */}
                    <motion.div
                      initial={{ scale: 1, opacity: 0.4 }}
                      animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5,
                      }}
                      className="absolute inset-0 rounded-full border border-blue-300"
                    />
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Searching for available users...
                  </p>
                  <p className="text-xs text-gray-500">
                    Duration: {formatDuration(searchDuration)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelMatching}
                    className="mt-4 bg-transparent"
                  >
                    Cancel Search
                  </Button>
                </motion.div>
              )}

              {matchingStage === "found" && connectedUser && (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4"
                  >
                    <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </motion.div>
                  <Avatar className="h-12 w-12 mx-auto mb-3">
                    <AvatarFallback className="bg-blue-600 text-white">
                      {getInitials(connectedUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {connectedUser.username}
                  </h3>
                  {connectedUser.location && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {connectedUser.location.city},{" "}
                      {connectedUser.location.country}
                    </p>
                  )}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2 }}
                    className="h-1 bg-green-500 rounded-full mt-4"
                  />
                </motion.div>
              )}

              {matchingStage === "failed" && (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    No users are available for matching right now.
                  </p>
                  <Button onClick={handleStartMatching} size="sm">
                    Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
