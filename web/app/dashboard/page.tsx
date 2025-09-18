"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useRouter } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  MessageCircle,
  Video,
  Phone,
  Globe,
  MapPin,
  Clock,
  Settings,
  LogOut,
  UserPlus,
  Activity,
  Wifi,
  WifiOff,
  Shuffle,
} from "lucide-react";
import { motion } from "framer-motion";
import { userAPI } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

interface UserStats {
  totalUsers: number;
  onlineUsers: number;
  availableUsers: number;
  connectedUsers: number;
}

interface OnlineUser {
  id: string;
  username: string;
  email: string;
  isOnline: boolean;
  lastSeen: string;
  deviceId: string;
  location?: {
    country: string;
    city: string;
  };
  connectedUser: any;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { isConnected, requestMatch, isMatching } = useChat();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, usersResponse] = await Promise.all([
        userAPI.getStats(),
        userAPI.getOnlineUsers(),
      ]);

      setStats(statsResponse.data.data.statistics);
      setOnlineUsers(usersResponse.data.data.onlineUsers);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    requestMatch();
    router.push("/chat");
  };

  const handleFindMatch = () => {
    router.push("/match");
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading dashboard...
            </p>
          </motion.div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header */}
        <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {isConnected ? (
                      <>
                        <Wifi className="w-3 h-3 text-green-500" />
                        Connected
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-red-500" />
                        Disconnected
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={handleStartChat}
                  disabled={isMatching}
                  className="hidden sm:flex"
                >
                  {isMatching ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Finding Match...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Start Chat
                    </>
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-600 text-white">
                          {user ? getInitials(user.username) : "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user?.username}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/chat")}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      <span>Chat</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/match")}>
                      <Shuffle className="mr-2 h-4 w-4" />
                      <span>Find Match</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome back, {user?.username}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Ready to connect with people around the world?
            </p>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Start connecting with others instantly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Button
                    onClick={handleStartChat}
                    disabled={isMatching}
                    className="h-16 flex-col gap-2"
                  >
                    {isMatching ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span className="text-sm">Finding Match...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">Quick Chat</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-2 bg-transparent"
                    onClick={handleFindMatch}
                  >
                    <Shuffle className="w-5 h-5" />
                    <span className="text-sm">Find Match</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-2 bg-transparent"
                    onClick={() => router.push("/chat")}
                  >
                    <Video className="w-5 h-5" />
                    <span className="text-sm">Video Call</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-2 bg-transparent"
                    onClick={() => router.push("/chat")}
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-sm">Voice Call</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Statistics */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Platform Statistics
                  </CardTitle>
                  <CardDescription>
                    Real-time user activity across the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {stats.totalUsers}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Total Users
                        </div>
                      </div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {stats.onlineUsers}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Online Now
                        </div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {stats.availableUsers}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Available
                        </div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {stats.connectedUsers}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          In Chat
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Profile */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Your Profile
                  </CardTitle>
                  <CardDescription>
                    Your account information and status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {user && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarFallback className="bg-blue-600 text-white text-lg">
                            {getInitials(user.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">
                            {user.username}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {user.email}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={user.isOnline ? "default" : "secondary"}
                            >
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
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">
                            Joined{" "}
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">
                            Last seen {formatLastSeen(user.lastSeen)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Online Users */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Online Users
                    <Badge variant="secondary">{onlineUsers.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Users currently active on the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {onlineUsers.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">
                        No users online right now
                      </p>
                    ) : (
                      onlineUsers.map((onlineUser, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gray-600 text-white text-xs">
                              {getInitials(onlineUser.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {onlineUser.username}
                              </p>
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            </div>
                            {onlineUser.location && (
                              <p className="text-xs text-gray-500 truncate">
                                {onlineUser.location.city},{" "}
                                {onlineUser.location.country}
                              </p>
                            )}
                          </div>
                          {onlineUser.connectedUser && (
                            <Badge variant="outline" className="text-xs">
                              In Chat
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
