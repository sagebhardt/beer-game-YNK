"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Beer, Copy, Check, Users, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";

interface LobbyPlayer {
  id: string;
  name: string;
  role: string;
  isConnected: boolean;
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const { socket, isConnected } = useSocket(code, sessionId);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}`);
      const data = await res.json();
      if (!res.ok) return;

      if (data.game?.status === "ACTIVE") {
        router.push(`/juego/${code}/jugar`);
        return;
      }

      setPlayers(data.players || []);
      setIsHost(data.isHost || false);
      setCurrentPlayerId(data.currentPlayer?.id || null);
    } catch {
      // ignore
    }
  }, [code, router]);

  // Get session ID from server and load initial state
  useEffect(() => {
    Promise.all([
      fetch("/api/session").then((r) => r.json()),
      fetch(`/api/games/${code}`).then((r) => r.json()),
    ]).then(([sessionData, gameData]) => {
      if (sessionData.sessionId) setSessionId(sessionData.sessionId);

      if (gameData.game?.status === "ACTIVE") {
        router.push(`/juego/${code}/jugar`);
        return;
      }
      setPlayers(gameData.players || []);
      setIsHost(gameData.isHost || false);
      setCurrentPlayerId(gameData.currentPlayer?.id || null);
    });
  }, [code, router]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on(S2C.LOBBY_STATE, ({ players: p }: { players: LobbyPlayer[] }) => {
      setPlayers(p);
    });

    socket.on(S2C.PLAYER_JOINED, (player: LobbyPlayer) => {
      setPlayers((prev) => {
        if (prev.find((p) => p.id === player.id)) return prev;
        return [...prev, player];
      });
    });

    socket.on(S2C.PLAYER_LEFT, ({ playerId }: { playerId: string }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, isConnected: false } : p
        )
      );
    });

    socket.on(
      S2C.ROLE_SELECTED,
      ({ playerId, role }: { playerId: string; playerName: string; role: string }) => {
        setPlayers((prev) =>
          prev.map((p) => {
            // Clear role from any player who had it
            if (p.role === role && p.id !== playerId) return { ...p, role: "" };
            if (p.id === playerId) return { ...p, role };
            return p;
          })
        );
      }
    );

    socket.on(S2C.GAME_STARTED, () => {
      router.push(`/juego/${code}/jugar`);
    });

    socket.on(S2C.ERROR, ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(""), 3000);
    });

    return () => {
      socket.off(S2C.LOBBY_STATE);
      socket.off(S2C.PLAYER_JOINED);
      socket.off(S2C.PLAYER_LEFT);
      socket.off(S2C.ROLE_SELECTED);
      socket.off(S2C.GAME_STARTED);
      socket.off(S2C.ERROR);
    };
  }, [socket, code, router]);

  function handleSelectRole(role: Role) {
    if (!socket) return;
    socket.emit("select-role", { gameCode: code, role });
  }

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`/api/games/${code}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setStarting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allRolesAssigned = ROLES.every((role) =>
    players.some((p) => p.role === role)
  );

  const currentPlayerRole = players.find(
    (p) => p.id === currentPlayerId
  )?.role;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Beer className="w-6 h-6 text-[#2c02c6]" />
            <h1 className="text-xl font-bold">Sala de Espera</h1>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            {isHost && <Badge>Anfitrión</Badge>}
          </div>
        </div>

        {/* Access Code */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Código de acceso
                </p>
                <p className="text-2xl font-mono font-bold tracking-wider text-[#2c02c6]">
                  {code}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Role Selection */}
        <h2 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Selecciona tu rol
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {ROLES.map((role) => {
            const assignedPlayer = players.find((p) => p.role === role);
            const isMe = assignedPlayer?.id === currentPlayerId;
            const isTaken = !!assignedPlayer && !isMe;

            return (
              <Card
                key={role}
                className={`transition-all ${
                  isMe
                    ? "border-[#2c02c6] ring-2 ring-[#2c02c6]/20"
                    : isTaken
                    ? "opacity-60"
                    : "hover:border-[#2c02c6]/40 cursor-pointer"
                }`}
                onClick={() => !isTaken && handleSelectRole(role)}
              >
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {ROLE_LABELS[role]}
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-0.5">{role}</p>
                    </div>
                    {assignedPlayer ? (
                      <Badge variant={isMe ? "default" : "secondary"}>
                        {assignedPlayer.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Disponible</Badge>
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Chain visualization */}
        <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-6">
          <span>Consumidor</span>
          <span>→</span>
          <span className={currentPlayerRole === "RETAILER" ? "text-[#2c02c6] font-bold" : ""}>
            Minorista
          </span>
          <span>→</span>
          <span className={currentPlayerRole === "WHOLESALER" ? "text-[#2c02c6] font-bold" : ""}>
            Mayorista
          </span>
          <span>→</span>
          <span className={currentPlayerRole === "DISTRIBUTOR" ? "text-[#2c02c6] font-bold" : ""}>
            Distribuidor
          </span>
          <span>→</span>
          <span className={currentPlayerRole === "FACTORY" ? "text-[#2c02c6] font-bold" : ""}>
            Fábrica
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        {/* Start button */}
        {isHost && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={!allRolesAssigned || starting}
          >
            {starting
              ? "Iniciando..."
              : allRolesAssigned
              ? "Iniciar Juego"
              : "Esperando jugadores..."}
          </Button>
        )}

        {!isHost && (
          <p className="text-center text-sm text-gray-500">
            Esperando que el anfitrión inicie el juego...
          </p>
        )}
      </div>
    </div>
  );
}
