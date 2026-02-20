"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io as ioClient, type Socket } from "socket.io-client";

export function useSocket(gameCode: string, sessionId: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const socket = ioClient({
      path: "/api/socketio",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { gameCode, sessionId });
    });

    socket.on("disconnect", () => setIsConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [gameCode, sessionId]);

  const emit = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      socketRef.current?.emit(event, data);
    },
    []
  );

  return { socket: socketRef.current, isConnected, emit };
}
