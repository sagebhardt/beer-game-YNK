"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Beer,
  Package,
  Truck,
  AlertTriangle,
  Check,
  Clock,
  Send,
  Wifi,
  WifiOff,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ROLE_LABELS, ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { formatCurrency } from "@/lib/utils";
import { SupplyChainStrip } from "@/components/game/supply-chain-strip";
import { PageShell } from "@/components/layout/page-shell";

interface PlayerStateData {
  game: {
    accessCode: string;
    name: string;
    status: string;
    currentRound: number;
    totalRounds: number;
  };
  player: {
    id: string;
    name: string;
    role: Role;
    inventory: number;
    backlog: number;
    totalCost: number;
  };
  pipeline: Array<{ quantity: number; arrivesInRounds: number }>;
  roundHistory: Array<{
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
  submissions: {
    retailer: boolean;
    wholesaler: boolean;
    distributor: boolean;
    factory: boolean;
  } | null;
  hasSubmittedThisRound: boolean;
  isHost: boolean;
}

export default function JugarPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [state, setState] = useState<PlayerStateData | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [orderQty, setOrderQty] = useState<string>("0");
  const [submitting, setSubmitting] = useState(false);
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

      if (data.game?.status === "COMPLETED") {
        router.push(`/juego/${code}/resultados`);
        return;
      }
      if (data.game?.status === "LOBBY") {
        router.push(`/juego/${code}/lobby`);
        return;
      }

      // Spectators get redirected to the spectate view
      if (data.isSpectator) {
        router.push(`/juego/${code}/spectate`);
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

    socket.on(S2C.ORDER_SUBMITTED, () => {
      fetchState();
    });

    socket.on(S2C.ROUND_ADVANCED, () => {
      fetchState();
    });

    socket.on(S2C.GAME_ENDED, () => {
      router.push(`/juego/${code}/resultados`);
    });

    return () => {
      socket.off(S2C.ORDER_SUBMITTED);
      socket.off(S2C.ROUND_ADVANCED);
      socket.off(S2C.GAME_ENDED);
    };
  }, [socket, code, router, fetchState]);

  async function handleSubmitOrder() {
    const qty = parseInt(orderQty) || 0;
    if (qty < 0) {
      setError("La cantidad no puede ser negativa");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/games/${code}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar pedido");
        return;
      }

      fetchState();
    } catch {
      setError("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Cargando...</p>
      </div>
    );
  }

  const { game, player, pipeline, roundHistory, submissions, hasSubmittedThisRound } = state;
  const role = player.role;
  const upstream = UPSTREAM[role];
  const downstream = DOWNSTREAM[role];

  const upstreamLabel = upstream === "PRODUCTION" ? "Producción" : ROLE_LABELS[upstream as Role];
  const downstreamLabel = downstream === "CONSUMER" ? "Consumidor" : ROLE_LABELS[downstream as Role];

  const lastRound = roundHistory.length > 0 ? roundHistory[roundHistory.length - 1] : null;
  const inTransit = pipeline.reduce((acc, p) => acc + p.quantity, 0);

  const chainStatus = Object.fromEntries(
    ROLES.map((r) => {
      const submitted = submissions ? submissions[r.toLowerCase() as keyof typeof submissions] : false;
      return [r, submitted ? "ok" : "warn"];
    })
  ) as Partial<Record<Role, "ok" | "warn" | "danger" | "neutral">>;

  const chainText = Object.fromEntries(
    ROLES.map((r) => {
      if (r === role) {
        return [r, hasSubmittedThisRound ? "Pedido enviado" : "Pendiente de enviar"];
      }
      const submitted = submissions ? submissions[r.toLowerCase() as keyof typeof submissions] : false;
      return [r, submitted ? "Listo" : "Esperando"];
    })
  ) as Partial<Record<Role, string>>;

  return (
    <PageShell
      title={`${ROLE_LABELS[role]} · ${player.name}`}
      subtitle="Decide tu pedido con base en señales locales: pedido recibido, inventario y backlog."
      rightSlot={
        <div className="flex items-center gap-2">
          <Badge variant="outline">Ronda {game.currentRound}/{game.totalRounds}</Badge>
          {isConnected ? (
            <Badge variant="success"><Wifi className="h-3.5 w-3.5" /> En línea</Badge>
          ) : (
            <Badge variant="destructive"><WifiOff className="h-3.5 w-3.5" /> Sin conexión</Badge>
          )}
        </div>
      }
    >
      <SupplyChainStrip currentRole={role} statuses={chainStatus} statusText={chainText} className="mb-4" />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
              <Package className="w-4 h-4" /> Pedido recibido ({downstreamLabel})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="kpi-value text-3xl font-bold text-[var(--text-strong)]">
              {lastRound?.incomingOrder ?? 0} <span className="text-sm font-medium text-[var(--text-muted)]">uds</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
              <Truck className="w-4 h-4" /> Envío recibido ({upstreamLabel})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="kpi-value text-3xl font-bold text-[var(--text-strong)]">
              {lastRound?.incomingShipment ?? 0} <span className="text-sm font-medium text-[var(--text-muted)]">uds</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)]">Costo acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="kpi-value text-3xl font-bold text-[var(--accent)]">{formatCurrency(player.totalCost)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Objetivo: estabilizar pedidos y minimizar variabilidad.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-[var(--text-body)]">Estado operativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Inventario</p>
                  <p className="kpi-value text-3xl font-bold text-[var(--ok)]">{player.inventory}</p>
                  <p className="text-xs text-[var(--text-muted)]" title="Costo de mantener inventario por semana.">
                    {formatCurrency(player.inventory * 0.5)} / semana
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Backlog</p>
                  <p className={`kpi-value text-3xl font-bold ${player.backlog > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                    {player.backlog}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]" title="Pedidos pendientes. El backlog penaliza más que inventario.">
                    {player.backlog > 0 ? `${formatCurrency(player.backlog * 1)} / semana` : "Sin pendientes"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
                <Truck className="w-4 h-4" /> Pipeline logístico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-[var(--text-muted)]">{inTransit} unidades en tránsito hacia tu nodo.</p>
              {pipeline.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No hay envíos en camino.</p>
              ) : (
                <div className="space-y-2">
                  {pipeline.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-[var(--bg-muted)] px-3 py-2">
                      <span className="text-sm font-semibold text-[var(--text-strong)]">{p.quantity} unidades</span>
                      <Badge variant="outline">Llega en {p.arrivesInRounds} ronda{p.arrivesInRounds !== 1 ? "s" : ""}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={hasSubmittedThisRound ? "opacity-80" : ""}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
                <Send className="w-4 h-4" />
                {upstream === "PRODUCTION" ? "Ordenar producción" : `Pedir a ${upstreamLabel}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasSubmittedThisRound ? (
                <div className="rounded-lg border border-[#c7f2d6] bg-[#f0fdf5] p-3 text-sm text-[var(--ok)]">
                  <div className="mb-1 flex items-center gap-2 font-semibold"><Check className="w-4 h-4" /> Pedido enviado</div>
                  Esperando a que el resto de la cadena complete su decisión.
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    type="number"
                    min={0}
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    placeholder="Cantidad"
                    className="text-center text-xl font-semibold"
                  />
                  <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Info className="h-3.5 w-3.5" />
                    Pedido sugerido = demanda reciente + ajuste gradual de backlog.
                  </p>
                  {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
                  <Button className="w-full" onClick={handleSubmitOrder} disabled={submitting}>
                    {submitting ? "Enviando..." : "Confirmar pedido"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
                <Clock className="w-4 h-4" /> Estado de la ronda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const submitted = submissions
                    ? submissions[r.toLowerCase() as keyof typeof submissions]
                    : false;
                  return (
                    <div
                      key={r}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        submitted
                          ? "bg-[#f0fdf5] text-[var(--ok)]"
                          : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                      }`}
                    >
                      {submitted ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {ROLE_LABELS[r]}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {roundHistory.length > 0 ? (
        <Card className="mt-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)]">Historial reciente (últimas 10 rondas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-[var(--text-muted)]">
                    <th className="pb-2 text-left">#</th>
                    <th className="pb-2 text-right">Pedido rec.</th>
                    <th className="pb-2 text-right">Envío rec.</th>
                    <th className="pb-2 text-right">Orden</th>
                    <th className="pb-2 text-right">Inv.</th>
                    <th className="pb-2 text-right">BL</th>
                    <th className="pb-2 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {roundHistory.slice(-10).map((r) => (
                    <tr key={r.round} className="border-b border-[var(--bg-muted)]">
                      <td className="py-1.5">{r.round}</td>
                      <td className="py-1.5 text-right">{r.incomingOrder}</td>
                      <td className="py-1.5 text-right">{r.incomingShipment}</td>
                      <td className="py-1.5 text-right">{r.orderPlaced}</td>
                      <td className="py-1.5 text-right text-[var(--ok)]">{r.inventoryAfter}</td>
                      <td className="py-1.5 text-right text-[var(--danger)]">{r.backlogAfter > 0 ? r.backlogAfter : "-"}</td>
                      <td className="py-1.5 text-right">{formatCurrency(r.totalCostCumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {player.backlog > 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#f7ccd5] bg-[#fff1f4] px-4 py-3 text-sm text-[var(--danger)]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Tienes {player.backlog} unidades en backlog. Ajusta pedido con cautela para evitar sobrecorrección.
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Beer className="h-3.5 w-3.5" />
        Recuerda: un cambio brusco en pedido suele amplificarse aguas arriba por el retraso.
      </div>
    </PageShell>
  );
}
