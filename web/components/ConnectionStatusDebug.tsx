"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import socketService from "@/lib/socket";
import { useGuestSession } from "@/contexts/GuestSessionContext";

export default function ConnectionStatusDebug() {
  const { guestUser, isGuestSession } = useGuestSession();
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribe = socketService.onConnectionChange((connected) => {
      setSocketConnected(connected);
      const timestamp = new Date().toLocaleTimeString();
      const message = `${timestamp}: ${connected ? "Connected" : "Disconnected"}`;
      setConnectionHistory(prev => [...prev.slice(-9), message]); // Keep last 10 entries
      setLastUpdate(new Date());
    });

    // Initial status check
    setSocketConnected(socketService.getConnectionStatus());

    return unsubscribe;
  }, []);

  const handleReconnect = () => {
    try {
      socketService.disconnect();
      setTimeout(() => {
        socketService.connect();
      }, 1000);
    } catch (error) {
      console.error("Reconnection failed:", error);
    }
  };

  const addToHistory = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionHistory(prev => [...prev.slice(-9), `${timestamp}: ${message}`]);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Connection Status Debug</span>
          <Badge variant={socketConnected ? "default" : "secondary"}>
            {socketConnected ? (
              <>
                <Wifi className="w-3 h-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium">Guest Session:</span>
            <Badge variant={isGuestSession ? "default" : "secondary"} className="ml-1">
              {isGuestSession ? "✅" : "❌"}
            </Badge>
          </div>
          <div>
            <span className="font-medium">User:</span>
            <span className="ml-1">{guestUser?.username || "None"}</span>
          </div>
        </div>

        <div className="text-xs">
          <span className="font-medium">Socket ID:</span>
          <span className="ml-1 font-mono">
            {socketId || "Not connected"}
          </span>
        </div>

        <div className="text-xs">
          <span className="font-medium">Last Update:</span>
          <span className="ml-1">{lastUpdate.toLocaleTimeString()}</span>
        </div>

        <div className="space-y-1">
          <span className="font-medium text-xs">Connection History:</span>
          <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 max-h-32 overflow-y-auto">
            {connectionHistory.length === 0 ? (
              <div className="text-xs text-gray-500">No events yet...</div>
            ) : (
              connectionHistory.map((event, index) => (
                <div key={index} className="text-xs font-mono">
                  {event}
                </div>
              ))
            )}
          </div>
        </div>

        <Button
          onClick={handleReconnect}
          size="sm"
          variant="outline"
          className="w-full"
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Reconnect
        </Button>
      </CardContent>
    </Card>
  );
}