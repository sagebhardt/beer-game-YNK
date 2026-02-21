"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Beer, Copy, Check, Eye, Users, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { SupplyChainStrip } from "@/components/game/supply-chain-strip";
import { PageShell } from "@/components/layout/page-shell";

interface LobbyPlayer {
  id: string;
  name: string;
  role: string;
  isConnected: boolean;
  isSpectator?: boolean;
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isCurrentSpectator, setIsCurrentSpectator] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const { socket, isConnected } = useSocket(code, sessionId);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}`);
      const data = await res.json();
      if (!res.ok) return;

      if (data.game?.mode === "TEST") {
        router.push(`/juego/${code}/test`);
        return;
      }

      if (data.game?.status === "ACTIVE") {
        if (data.currentPlayer?.isSpectator || data.isSpectator) {
          router.push(`/juego/${code}/spectate`);
        } else {
          router.push(`/juego/${code}/jugar`);
        }
        return;
      }

      setPlayers(data.players || []);
      setIsHost(data.isHost || false);
      setIsCurrentSpectator(data.currentPlayer?.isSpectator || false);
      setCurrentPlayerId(data.currentPlayer?.id || null);
    } catch {
      // ignore
    }
  }, [code, router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/session").then((r) => r.json()),
      fetch(`/api/games/${code}`).then((r) => r.json()),
    ]).then(([sessionData, gameData]) => {
      if (sessionData.sessionId) setSessionId(sessionData.sessionId);

      if (gameData.game?.mode === "TEST") {
        router.push(`/juego/${code}/test`);
        return;
      }

      if (gameData.game?.status === "ACTIVE") {
        if (gameData.currentPlayer?.isSpectator || gameData.isSpectator) {
          router.push(`/juego/${code}/spectate`);
        } else {
          router.push(`/juego/${code}/jugar`);
        }
        return;
      }
      setPlayers(gameData.players || []);
      setIsHost(gameData.isHost || false);
      setIsCurrentSpectator(gameData.currentPlayer?.isSpectator || false);
      setCurrentPlayerId(gameData.currentPlayer?.id || null);
    });
  }, [code, router]);

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
            if (p.role === role && p.id !== playerId) return { ...p, role: "" };
            if (p.id === playerId) return { ...p, role };
            return p;
          })
        );
      }
    );

    socket.on(S2C.GAME_STARTED, () => {
      if (isCurrentSpectator) {
        router.push(`/juego/${code}/spectate`);
      } else {
        router.push(`/juego/${code}/jugar`);
      }
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
  }, [socket, code, router, isCurrentSpectator]);

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

  const activePlayers = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

  const allRolesAssigned = ROLES.every((role) =>
    activePlayers.some((p) => p.role === role)
  );

  const currentPlayerRole = (activePlayers.find((p) => p.id === currentPlayerId)?.role as Role | undefined) ?? null;

  const chainStatuses = Object.fromEntries(
    ROLES.map((role) => {
      const assigned = activePlayers.find((p) => p.role === role);
      if (!assigned) return [role, "warn"];
      return [role, assigned.isConnected ? "ok" : "danger"];
    })
  ) as Partial<Record<Role, "ok" | "warn" | "danger" | "neutral">>;

  const chainText = Object.fromEntries(
    ROLES.map((role) => {
      const assigned = activePlayers.find((p) => p.role === role);
      if (!assigned) return [role, "Sin asignar"];
      return [role, assigned.name];
    })
  ) as Partial<Record<Role, string>>;

  return (
    <PageShell
      title="Sala de Espera"
      subtitle="Asigna roles y confirma que todos estén listos para iniciar la simulación."
      rightSlot={
        <div className="flex items-center gap-2">
          <Badge variant="outline">Código {code}</Badge>
          {isConnected ? (
            <Badge variant="success">Conectado</Badge>
          ) : (
            <Badge variant="destructive">Offline</Badge>
          )}
          {isHost ? <Badge>Anfitrión</Badge> : null}
          {isCurrentSpectator ? <Badge variant="outline"><Eye className="h-3 w-3" /> Observador</Badge> : null}
        </div>
      }
    >
      <SupplyChainStrip
        currentRole={currentPlayerRole}
        statuses={chainStatuses}
        statusText={chainText}
        className="mb-4"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Código de acceso</p>
            <p className="text-2xl font-mono font-bold text-[var(--accent)]">{code}</p>
          </div>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-[var(--ok)]" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado" : "Copiar código"}
          </Button>
        </CardContent>
      </Card>

      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-body)]">
        <Users className="w-4 h-4" />
        Selección de roles
      </h2>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => {
          const assignedPlayer = activePlayers.find((p) => p.role === role);
          const isMe = assignedPlayer?.id === currentPlayerId;
          const isTaken = !!assignedPlayer && !isMe;
          const canClick = !isCurrentSpectator && !isTaken;

          return (
            <Card
              key={role}
              className={`transition-all ${
                isMe
                  ? "border-[#adc7ff] ring-2 ring-[#cadbff]"
                  : isTaken || isCurrentSpectator
                  ? "opacity-70"
                  : "cursor-pointer hover:-translate-y-0.5"
              }`}
              onClick={() => canClick && handleSelectRole(role)}
            >
              <CardHeader className="py-4">
                <CardTitle className="text-base">{ROLE_LABELS[role]}</CardTitle>
                <p className="text-xs text-[var(--text-muted)]">{assignedPlayer ? assignedPlayer.name : "Disponible"}</p>
              </CardHeader>
              <CardContent className="pt-0">
                {assignedPlayer ? (
                  <Badge variant={isMe ? "default" : assignedPlayer.isConnected ? "success" : "warning"}>
                    {isMe ? "Tu rol" : assignedPlayer.isConnected ? "Activo" : "Desconectado"}
                  </Badge>
                ) : (
                  <Badge variant="outline">Libre</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {spectators.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
            <Eye className="h-3.5 w-3.5" />
            Espectadores ({spectators.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {spectators.map((s) => (
              <Badge key={s.id} variant="outline">
                {s.name}
                <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${s.isConnected ? "bg-[var(--ok)]" : "bg-[var(--danger)]"}`} />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {error ? <p className="mb-4 text-sm text-[var(--danger)]">{error}</p> : null}

      {isCurrentSpectator ? (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] p-3 text-center text-sm text-[var(--text-muted)]">
          <Eye className="mr-1 inline h-3.5 w-3.5" />
          Modo observador — verás la partida completa sin poder intervenir.
        </div>
      ) : isHost ? (
        <Button className="w-full" size="lg" onClick={handleStart} disabled={!allRolesAssigned || starting}>
          {starting
            ? "Iniciando..."
            : allRolesAssigned
            ? "Iniciar juego"
            : "Esperando asignación de todos los roles"}
        </Button>
      ) : (
        <div className="rounded-lg border border-[var(--border-soft)] bg-white p-3 text-center text-sm text-[var(--text-muted)]">
          Esperando que el anfitrión inicie la partida.
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Beer className="w-3.5 h-3.5" />
        Cada rol solo observa su tramo de la cadena; coordina decisiones sin compartir inventario interno.
      </div>
    </PageShell>
  );
}
