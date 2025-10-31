"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shuffle, User, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useGuestSession } from "@/contexts/GuestSessionContext";
import { guestAPI } from "@/lib/api";

interface GuestUsernameModalProps {
  isOpen: boolean;
  onComplete: (username: string) => Promise<void>;
}

export default function GuestUsernameModal({
  isOpen,
  onComplete,
}: GuestUsernameModalProps) {
  const { generateGuestUsername } = useGuestSession();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !username) {
      // Generate initial username when modal opens
      handleGenerateNew();
    }
  }, [isOpen, username]);

  useEffect(() => {
    // Generate username on first load if modal opens without username
    if (isOpen && !username) {
      const generateInitialUsername = async () => {
        try {
          const response = await guestAPI.generateUsername();
          if (response.data.success) {
            setUsername(response.data.data.username);
            return;
          }
          // Fallback to client-side generation
          setUsername(generateGuestUsername());
        } catch (error) {
          console.error("Failed to generate username from API:", error);
          // Fallback to client-side generation
          setUsername(generateGuestUsername());
        }
      };
      generateInitialUsername();
    }
  }, [isOpen, generateGuestUsername]);

  const handleGenerateNew = async () => {
    setIsLoading(true);
    try {
      // Call backend API to generate random username
      const response = await guestAPI.generateUsername();
      if (response.data.success) {
        setUsername(response.data.data.username);
      } else {
        // Fallback to client-side generation
        setUsername(generateGuestUsername());
      }
    } catch (error) {
      console.error("Failed to generate username from server:", error);
      // Fallback to client-side generation
      setUsername(generateGuestUsername());
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!username.trim()) return;

    setIsLoading(true);

    try {
      await onComplete(username.trim());
    } catch (error) {
      console.error("Failed to complete guest session setup:", error);
      // Keep the modal open on error so user can retry
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Limit username length and allow only alphanumeric characters and underscores
    if (value.length <= 20 && /^[a-zA-Z0-9_]*$/.test(value)) {
      setUsername(value);
    }
  };

  const isValidUsername = username.trim().length >= 3;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent
        className=" sm:rounded-xl [&>button]:hidden w-[90vw] sm:w-full sm:max-w-md left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
            <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold">
            Welcome to Chat!
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            Choose your username to start chatting with people around the world
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6 pt-4"
        >
          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="text-xs sm:text-sm font-medium"
            >
              Your Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                id="username"
                value={username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                className="pl-10 text-center text-base sm:text-lg font-medium h-10 sm:h-11"
                maxLength={20}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 gap-2">
              <span>3-20 characters, letters and numbers only</span>
              <span className="flex-shrink-0">{username.length}/20</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGenerateNew}
            className="w-full text-sm sm:text-base h-10 sm:h-11"
            disabled={isLoading}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Generate New Name</span>
            <span className="sm:hidden">Generate</span>
          </Button>

          <Button
            onClick={handleContinue}
            className="w-full text-sm sm:text-base h-10 sm:h-11"
            disabled={!isValidUsername || isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                <span className="hidden sm:inline">Getting Ready...</span>
                <span className="sm:hidden">Ready...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Continue as {username}</span>
                <span className="sm:hidden">Continue</span>
              </>
            )}
          </Button>

          <div className="text-center text-xs text-gray-500 space-y-1">
            <p className="text-[11px] sm:text-xs">
              🔒 Your session is temporary and private
            </p>
            <p className="text-[11px] sm:text-xs">
              💬 All data is lost when you close the tab
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
