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
import { useGuestSession } from "@/contexts/GuestSessionContext";

interface MatchingInterfaceProps {
  onMatchFound: () => void;
}

export default function MatchingInterface({
  onMatchFound,
}: MatchingInterfaceProps) {
  const { guestUser } = useGuestSession();
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
      <div className="max-w-2xl mx-auto px-2 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-8"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Find Your Next Chat Partner
          </h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-pretty">
            Connect with interesting people from around the world. Start a
            conversation, make new friends, or just have fun chatting!
          </p>
        </motion.div>

        {/* Matching Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8"
        >
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Shuffle className="w-5 h-5 text-blue-600" />
                Random Match
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Connect with a random person instantly
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <Button
                onClick={handleStartMatching}
                disabled={isMatching}
                className="w-full text-sm sm:text-base"
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
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Globe className="w-5 h-5 text-green-600" />
                Global Chat
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Join conversations from around the world
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <Button
                variant="outline"
                className="w-full bg-transparent text-sm sm:text-base"
                size="lg"
                disabled
              >
                <Globe className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Guest User Profile */}
        {guestUser && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card>
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Users className="w-5 h-5" />
                  Your Profile
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  This is how others will see you
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
                    <AvatarFallback className="bg-blue-600 text-white text-base sm:text-lg">
                      {getInitials(guestUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {guestUser.username}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="default" className="text-xs">
                        Guest User
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Online
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        Session started{" "}
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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
      <AnimatePresence>
        {showMatchDialog && (
          <Dialog
            open={showMatchDialog}
            onOpenChange={(open) => {
              if (!open && matchingStage === "searching") {
                // User clicked close button while searching - cancel the match
                handleCancelMatching();
              } else if (!open) {
                // Allow closing for other stages
                setShowMatchDialog(false);
                if (matchingStage !== "found") {
                  setMatchingStage("idle");
                }
              }
            }}
          >
            <DialogContent className="sm:max-w-md overflow-hidden p-4 sm:p-6 w-[90vw] sm:w-full !rounded-xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <DialogHeader className="space-y-2">
                  <DialogTitle className="flex items-center justify-between text-base sm:text-lg gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {matchingStage === "searching" && (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              repeat: Infinity,
                              duration: 1.2,
                              ease: "linear",
                            }}
                            className="flex items-center justify-center"
                          >
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                          </motion.div>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="font-medium text-blue-600"
                          >
                            Looking for your perfect match...
                          </motion.span>
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
                    </div>
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
                            animate={{
                              scale: [1, 1.4, 1],
                              opacity: [0.6, 0, 0.6],
                            }}
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
                            animate={{
                              scale: [1, 1.8, 1],
                              opacity: [0.4, 0, 0.4],
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 0.5,
                            }}
                            className="absolute inset-0 rounded-full border border-blue-300"
                          />
                        </div>

                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="text-sm text-gray-600 dark:text-gray-400 mb-2"
                        >
                          Searching for available users...
                        </motion.p>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 }}
                          className="text-xs text-gray-500 mb-4"
                        >
                          Duration: {formatDuration(searchDuration)}
                        </motion.p>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.8 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelMatching}
                            className="bg-transparent hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel Search
                          </Button>
                        </motion.div>
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
                        {/* Success Animation */}
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            delay: 0.2,
                            type: "spring",
                            stiffness: 200,
                          }}
                          className="relative mb-6"
                        >
                          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center relative z-10">
                            <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                          </div>
                          {/* Success ripple effect */}
                          <motion.div
                            initial={{ scale: 0, opacity: 0.8 }}
                            animate={{
                              scale: [1, 2, 3],
                              opacity: [0.8, 0.4, 0],
                            }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="absolute inset-0 bg-green-400 rounded-full"
                          />
                        </motion.div>

                        {/* User Avatar with entrance animation */}
                        <motion.div
                          initial={{ scale: 0, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{
                            delay: 0.5,
                            type: "spring",
                            stiffness: 150,
                          }}
                        >
                          <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-green-200 dark:ring-green-800">
                            <AvatarFallback className="bg-blue-600 text-white text-lg">
                              {getInitials(connectedUser.username)}
                            </AvatarFallback>
                          </Avatar>
                        </motion.div>

                        {/* User details with staggered animation */}
                        <motion.h3
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 }}
                          className="font-semibold text-lg text-gray-900 dark:text-white mb-1"
                        >
                          {connectedUser.username}
                        </motion.h3>

                        {connectedUser.location && (
                          <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                            className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1 mb-4"
                          >
                            <MapPin className="w-3 h-3" />
                            {connectedUser.location.city},{" "}
                            {connectedUser.location.country}
                          </motion.p>
                        )}

                        {/* Loading progress bar */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.1 }}
                          className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
                        >
                          <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.8, ease: "easeInOut" }}
                            className="h-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                          />
                        </motion.div>

                        {/* Connection message */}
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.3 }}
                          className="text-xs text-gray-500 mt-2"
                        >
                          Connecting you to the chat...
                        </motion.p>
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
                        {/* Failed animation */}
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.2, 1] }}
                          transition={{
                            delay: 0.2,
                            duration: 0.6,
                            ease: "easeOut",
                          }}
                          className="relative mb-6"
                        >
                          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center relative z-10">
                            <motion.div
                              initial={{ scale: 0, rotate: 0 }}
                              animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
                              transition={{ delay: 0.5, duration: 0.5 }}
                            >
                              <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </motion.div>
                          </div>
                          {/* Error ripple effect */}
                          <motion.div
                            initial={{ scale: 0, opacity: 0.6 }}
                            animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                            transition={{
                              delay: 0.3,
                              duration: 1.2,
                              ease: "easeOut",
                            }}
                            className="absolute inset-0 bg-red-400 rounded-full"
                          />
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                          className="space-y-4"
                        >
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            No Match Found
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            No users are available for matching right now. Don't
                            worry, try again in a moment!
                          </p>

                          <div className="flex flex-col gap-2">
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 1.0 }}
                            >
                              <Button
                                onClick={handleStartMatching}
                                size="sm"
                                className="w-full"
                              >
                                <Shuffle className="w-4 h-4 mr-2" />
                                Try Again
                              </Button>
                            </motion.div>

                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 1.2 }}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowMatchDialog(false);
                                  setMatchingStage("idle");
                                }}
                                className="w-full bg-transparent"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Close
                              </Button>
                            </motion.div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
