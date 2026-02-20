"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Beer, Check, Clock, Send, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { SupplyChainStrip } from "@/components/game/supply-chain-strip";
import { PageShell } from "@/components/layout/page-shell";

interface TestStateData {
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
  };
  players: Array<{
    id: string;
    name: string;
    role: Role;
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
  submissions: {
    retailer: boolean;
    wholesaler: boolean;
    distributor: boolean;
    factory: boolean;
  } | null;
}

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [state, setState] = useState<TestStateData | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [orders, setOrders] = useState<Record<Role, string>>({
    RETAILER: "0",
    WHOLESALER: "0",
    DISTRIBUTOR: "0",
    FACTORY: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { socket, isConnected } = useSocket(code, sessionId);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/test-state`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el estado");
        return;
      }

      if (data.game?.status === "COMPLETED") {
        router.push(`/juego/${code}/resultados`);
        return;
      }

      setState(data);
    } catch {
      setError("Error de conexión");
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

    socket.on(S2C.ORDER_SUBMITTED, fetchState);
    socket.on(S2C.ROUND_ADVANCED, fetchState);
    socket.on(S2C.GAME_ENDED, () => {
      router.push(`/juego/${code}/resultados`);
    });

    return () => {
      socket.off(S2C.ORDER_SUBMITTED, fetchState);
      socket.off(S2C.ROUND_ADVANCED, fetchState);
      socket.off(S2C.GAME_ENDED);
    };
  }, [socket, code, router, fetchState]);

  const orderedPlayers = useMemo(() => {
    if (!state) return [];
    return ROLES.map((role) => state.players.find((player) => player.role === role)).filter(
      Boolean
    ) as TestStateData["players"];
  }, [state]);

  async function processRound() {
    const parsed = Object.fromEntries(
      ROLES.map((role) => [role, Number.parseInt(orders[role], 10) || 0])
    ) as Record<Role, number>;

    if (Object.values(parsed).some((value) => value < 0)) {
      setError("Los pedidos deben ser enteros no negativos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/games/${code}/test-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: parsed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo procesar la ronda");
        return;
      }

      await fetchState();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Cargando modo test...</p>
      </div>
    );
  }

  const chainStatuses = Object.fromEntries(
    ROLES.map((role) => {
      const submitted = state.submissions
        ? state.submissions[role.toLowerCase() as keyof typeof state.submissions]
        : false;
      return [role, submitted ? "ok" : "warn"];
    })
  ) as Partial<Record<Role, "ok" | "warn" | "danger" | "neutral">>;

  const chainText = Object.fromEntries(
    ROLES.map((role) => {
      const submitted = state.submissions
        ? state.submissions[role.toLowerCase() as keyof typeof state.submissions]
        : false;
      return [role, submitted ? "Pedido definido" : "Pendiente"];
    })
  ) as Partial<Record<Role, string>>;

  return (
    <PageShell
      title="Modo Test"
      subtitle="Controla los 4 roles y evalúa sensibilidad del sistema en un solo tablero."
      rightSlot={
        <div className="flex items-center gap-2">
          <Badge variant="outline">Ronda {state.game.currentRound}/{state.game.totalRounds}</Badge>
          {isConnected ? (
            <Badge variant="success"><Wifi className="h-3.5 w-3.5" /> Conectado</Badge>
          ) : (
            <Badge variant="destructive"><WifiOff className="h-3.5 w-3.5" /> Offline</Badge>
          )}
        </div>
      }
    >
      <SupplyChainStrip statuses={chainStatuses} statusText={chainText} className="mb-4" />

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {orderedPlayers.map((player) => {
          const lastRound =
            player.roundData.length > 0
              ? player.roundData[player.roundData.length - 1]
              : null;
          const role = player.role as Role;
          const submitted = state.submissions
            ? state.submissions[role.toLowerCase() as keyof typeof state.submissions]
            : false;

          return (
            <Card key={player.id} className={submitted ? "border-[#c7f2d6]" : ""}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center justify-between">
                  {ROLE_LABELS[role]}
                  {submitted ? (
                    <Check className="w-4 h-4 text-[var(--ok)]" />
                  ) : (
                    <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </CardTitle>
                <p className="text-xs text-[var(--text-muted)]">{player.name}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs text-[var(--text-body)]">
                  <p>Inventario: <span className="font-semibold text-[var(--ok)]">{player.inventory}</span></p>
                  <p>Backlog: <span className="font-semibold text-[var(--danger)]">{player.backlog}</span></p>
                  <p>Costo total: <span className="font-semibold">{formatCurrency(player.totalCost)}</span></p>
                  <p>Pedido recibido: <span className="font-semibold">{lastRound?.incomingOrder ?? 0}</span></p>
                  <p>Envío recibido: <span className="font-semibold">{lastRound?.incomingShipment ?? 0}</span></p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Pedido de esta ronda
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={orders[role]}
                    onChange={(event) =>
                      setOrders((prev) => ({ ...prev, [role]: event.target.value }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          Define los pedidos de los 4 roles y procesa la semana completa.
        </p>
        <Button onClick={processRound} disabled={loading}>
          <Send className="w-4 h-4" />
          {loading ? "Procesando..." : "Procesar ronda"}
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Beer className="h-3.5 w-3.5" />
        Usa esta vista para calibrar escenarios antes de correr sesiones con jugadores reales.
      </div>
    </PageShell>
  );
}
