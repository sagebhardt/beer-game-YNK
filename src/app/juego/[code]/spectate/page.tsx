"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Beer, Eye, Check, Clock, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ROLES, ROLE_LABELS, DOWNSTREAM, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { formatCurrency } from "@/lib/utils";
import { SupplyChainStrip } from "@/components/game/supply-chain-strip";
import { PageShell } from "@/components/layout/page-shell";

interface SpectatorStateData {
  game: {
    id: string;
    accessCode: string;
    name: string;
    status: string;
    mode: string;
    currentRound: number;
    totalRounds: number;
    holdingCost: number;
    backlogCost: number;
    endedAt: string | null;
    endedReason: string | null;
  };
  players: Array<{
    id: string;
    name: string;
    role: string;
    isConnected: boolean;
    inventory: number;
    backlog: number;
    totalCost: number;
    roundData: Array<{
      round: number;
      incomingOrder: number;
      incomingShipment: number;
      orderPlaced: number;
      shipmentSent: number;
      inventoryAfter: number;
      backlogAfter: number;
      holdingCost: number;
      backlogCost: number;
      totalCostCumulative: number;
    }>;
  }>;
  pipeline: Array<{
    type: string;
    fromRole: string;
    toRole: string;
    quantity: number;
    roundDue: number;
    arrivesInRounds: number;
  }>;
  submissions: {
    retailer: boolean;
    wholesaler: boolean;
    distributor: boolean;
    factory: boolean;
  } | null;
  isSpectator: boolean;
}

export default function SpectatePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [state, setState] = useState<SpectatorStateData | null>(null);
  const [sessionId, setSessionId] = useState("");

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

      if (data.game?.status === "COMPLETED") {
        router.push(`/juego/${code}/resultados`);
        return;
      }
      if (data.game?.status === "LOBBY") {
        router.push(`/juego/${code}/lobby`);
        return;
      }

      // If not a spectator, redirect to the player view
      if (!data.isSpectator) {
        router.push(`/juego/${code}/jugar`);
        return;
      }

      setState(data);
    } catch {
      // ignore
    }
  }, [code, router]);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.sessionId) setSessionId(data.sessionId);
      });
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!socket) return;

    const handleOrderSubmitted = () => fetchState();
    const handleRoundAdvanced = () => fetchState();
    const handleGameEnded = () => {
      router.push(`/juego/${code}/resultados`);
    };

    socket.on(S2C.ORDER_SUBMITTED, handleOrderSubmitted);
    socket.on(S2C.ROUND_ADVANCED, handleRoundAdvanced);
    socket.on(S2C.GAME_ENDED, handleGameEnded);

    return () => {
      socket.off(S2C.ORDER_SUBMITTED, handleOrderSubmitted);
      socket.off(S2C.ROUND_ADVANCED, handleRoundAdvanced);
      socket.off(S2C.GAME_ENDED, handleGameEnded);
    };
  }, [socket, code, router, fetchState]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Cargando vista de espectador...</p>
      </div>
    );
  }

  const { game, players, submissions, pipeline } = state;

  const orderedPlayers = useMemo(
    () => ROLES.map((role) => players.find((p) => p.role === role)).filter(Boolean),
    [players]
  );

  const chainStatuses = useMemo(
    () =>
      Object.fromEntries(
        ROLES.map((role) => {
          const p = players.find((x) => x.role === role);
          const submitted = submissions
            ? submissions[role.toLowerCase() as keyof typeof submissions]
            : false;

          if (!p || !p.isConnected) return [role, "danger"];
          if (submitted) return [role, "ok"];
          return [role, "warn"];
        })
      ) as Partial<Record<Role, "ok" | "warn" | "danger" | "neutral">>,
    [players, submissions]
  );

  const chainText = useMemo(
    () =>
      Object.fromEntries(
        ROLES.map((role) => {
          const p = players.find((x) => x.role === role);
          if (!p) return [role, "Sin jugador"];
          const submitted = submissions
            ? submissions[role.toLowerCase() as keyof typeof submissions]
            : false;
          return [role, submitted ? `${p.name} · Listo` : `${p.name} · Esperando`];
        })
      ) as Partial<Record<Role, string>>,
    [players, submissions]
  );

  const inTransit = useMemo(
    () =>
      Object.fromEntries(
        ROLES.map((role) => {
          const downstream = DOWNSTREAM[role];
          const qty = pipeline
            .filter((p) => p.type === "SHIPMENT" && p.fromRole === role && p.toRole === downstream)
            .reduce((sum, p) => sum + p.quantity, 0);
          return [role, qty];
        })
      ) as Partial<Record<Role, number>>,
    [pipeline]
  );

  return (
    <PageShell
      title="Vista de Espectador"
      subtitle={game.name ? `${game.name} · monitoreo en tiempo real` : "Monitoreo de la cadena en tiempo real"}
      rightSlot={
        <div className="flex items-center gap-2">
          <Badge variant="outline"><Eye className="h-3.5 w-3.5" /> Ronda {game.currentRound}/{game.totalRounds}</Badge>
          <Badge>Observador</Badge>
          {isConnected ? (
            <Badge variant="success"><Wifi className="h-3.5 w-3.5" /> Conectado</Badge>
          ) : (
            <Badge variant="destructive"><WifiOff className="h-3.5 w-3.5" /> Offline</Badge>
          )}
        </div>
      }
    >
      <SupplyChainStrip statuses={chainStatuses} statusText={chainText} inTransit={inTransit} className="mb-4" />

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {orderedPlayers.map((player) => {
          if (!player) return null;
          const role = player.role as Role;
          const submitted = submissions
            ? submissions[role.toLowerCase() as keyof typeof submissions]
            : false;
          const lastRound =
            player.roundData.length > 0
              ? player.roundData[player.roundData.length - 1]
              : null;

          return (
            <Card key={role}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{ROLE_LABELS[role]}</CardTitle>
                  <Badge variant={submitted ? "success" : "warning"}>{submitted ? "Listo" : "Pendiente"}</Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{player.name}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Inventario</p>
                    <p className="font-bold text-[var(--ok)]">{player.inventory}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Backlog</p>
                    <p className={`font-bold ${player.backlog > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                      {player.backlog}
                    </p>
                  </div>
                </div>
                <div className="border-t border-[var(--border-soft)] pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Costo total</span>
                    <span className="text-sm font-bold">{formatCurrency(player.totalCost)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Ultima orden</span>
                    <span className="text-xs font-semibold">{lastRound?.orderPlaced ?? 0} uds</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className={`h-2 w-2 rounded-full ${player.isConnected ? "bg-[var(--ok)]" : "bg-[var(--danger)]"}`} />
                  {player.isConnected ? "Jugador conectado" : "Jugador desconectado"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold text-[var(--text-body)]">Progreso de ronda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {ROLES.map((r) => {
              const submitted = submissions
                ? submissions[r.toLowerCase() as keyof typeof submissions]
                : false;
              return (
                <div
                  key={r}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                    submitted
                      ? "bg-[#f0fdf5] text-[var(--ok)]"
                      : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                  }`}
                >
                  <span className="font-medium">{ROLE_LABELS[r]}</span>
                  {submitted ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Beer className="h-3.5 w-3.5" />
        Modo observador: ves todas las decisiones sin poder intervenir en la cadena.
      </div>
    </PageShell>
  );
}
