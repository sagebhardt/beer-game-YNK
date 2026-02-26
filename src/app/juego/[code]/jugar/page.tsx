"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Beer,
  Package,
  Truck,
  AlertTriangle,
  Check,
  Send,
  Wifi,
  WifiOff,
  Info,
  X,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ROLE_LABELS, ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { formatCurrency } from "@/lib/utils";
import { SupplyChainDiagram } from "@/components/game/supply-chain-diagram";
import { PageShell } from "@/components/layout/page-shell";

interface PlayerStateData {
  game: {
    accessCode: string;
    name: string;
    status: string;
    mode: string;
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
  const [roundAlert, setRoundAlert] = useState<{ round: number; demand: number; shipment: number } | null>(null);
  const [alertExiting, setAlertExiting] = useState(false);
  const prevRoundRef = useRef<number>(0);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Detect round change and trigger alert
      const newRound = data.game?.currentRound ?? 0;
      if (prevRoundRef.current > 0 && newRound > prevRoundRef.current) {
        const lastEntry = data.roundHistory?.length > 0
          ? data.roundHistory[data.roundHistory.length - 1]
          : null;
        const demand = lastEntry?.incomingOrder ?? 0;
        const shipment = lastEntry?.incomingShipment ?? 0;
        setAlertExiting(false);
        setRoundAlert({ round: newRound, demand, shipment });
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => {
          setAlertExiting(true);
          setTimeout(() => setRoundAlert(null), 400);
        }, 4000);
      }
      prevRoundRef.current = newRound;

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

  // useMemo hooks must be ABOVE early returns to satisfy React rules of hooks
  const _submissions = state?.submissions ?? null;
  const _role = state?.player?.role;
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

  return (
    <PageShell
      title={`${ROLE_LABELS[role]} · ${player.name}`}
      subtitle="Decide tu pedido con base en señales locales: demanda, inventario y entregas."
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
      {/* Round advance alert banner */}
      {roundAlert && (
        <div
          className={`mb-4 flex items-center justify-between rounded-xl border border-[var(--accent-light-border)] bg-[var(--accent-light)] px-4 py-3 shadow-sm ${alertExiting ? "round-alert-exit" : "round-alert-enter"}`}
          onClick={() => {
            setAlertExiting(true);
            setTimeout(() => setRoundAlert(null), 400);
          }}
          role="status"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <Package className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--accent)]">Ronda {roundAlert.round}</p>
              <p className="text-sm text-[var(--text-body)]">
                Te piden <span className="font-bold text-[var(--text-strong)]">{roundAlert.demand}</span> unidades
              </p>
              <p className="text-sm text-[var(--text-body)]">
                Recibiste <span className="font-bold text-[var(--ok)]">{roundAlert.shipment}</span> unidades
              </p>
            </div>
          </div>
          <button className="text-[var(--text-muted)] hover:text-[var(--text-body)]" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <SupplyChainDiagram playerRole={role} submissions={submissions} gameMode={game.mode} className="mb-4" />

      <div className="mb-4 flex flex-col lg:flex-row lg:items-stretch gap-4">
        {/* 1. Recibiste */}
        <Card className="flex-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
              <Truck className="w-4 h-4" /> Recibiste ({upstreamLabel})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="kpi-value text-3xl font-bold text-[var(--text-strong)]">
              {lastRound !== null ? (
                <>{lastRound.incomingShipment} <span className="text-sm font-medium text-[var(--text-muted)]">uds</span></>
              ) : (
                <span className="text-lg font-medium text-[var(--text-muted)]">—</span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {lastRound !== null ? "Llegó de tu proveedor" : "Esperando primera ronda"}
            </p>
          </CardContent>
        </Card>

        {/* Arrow 1 */}
        <div className="hidden lg:flex items-center">
          <ArrowRight className="h-5 w-5 text-[var(--text-muted)]" />
        </div>

        {/* 2. Stock en bodega */}
        <Card className="flex-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)]">Stock en bodega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Inventario</p>
                <p className="kpi-value text-3xl font-bold text-[var(--ok)]">{player.inventory}</p>
                <p className="text-xs text-[var(--text-muted)]" title="Costo de mantener inventario por semana.">
                  {formatCurrency(player.inventory * 0.5)} / semana
                </p>
                <p className="text-xs italic text-[var(--text-muted)]">(US$0,50/ud)</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Backlog</p>
                <p className={`kpi-value text-3xl font-bold ${player.backlog > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                  {player.backlog}
                </p>
                <p className="text-xs text-[var(--text-muted)]" title="Pedidos pendientes. El backlog penaliza más que inventario.">
                  {player.backlog > 0 ? `${formatCurrency(player.backlog * 1)} / semana` : "Sin pendientes"}
                </p>
                <p className="text-xs italic text-[var(--text-muted)]">(US$1,00/ud)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arrow 2 */}
        <div className="hidden lg:flex items-center">
          <ArrowRight className="h-5 w-5 text-[var(--text-muted)]" />
        </div>

        {/* 3. Te piden */}
        <Card className="flex-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-body)] flex items-center gap-2">
              <Package className="w-4 h-4" /> Te piden ({downstreamLabel})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="kpi-value text-3xl font-bold text-[var(--text-strong)]">
              {lastRound !== null ? (
                <>{lastRound.incomingOrder} <span className="text-sm font-medium text-[var(--text-muted)]">uds</span></>
              ) : (
                <span className="text-lg font-medium text-[var(--text-muted)]">—</span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {lastRound !== null ? "Demanda de tu cliente" : "Esperando primera ronda"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Pipeline logístico */}
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

        {/* 2. Pedir a proveedor */}
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
                <Button variant="cta" className="w-full" onClick={handleSubmitOrder} disabled={submitting}>
                  {submitting ? "Enviando..." : "Confirmar pedido"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Costo acumulado */}
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
                    <th className="pb-2 text-right">Te piden</th>
                    <th className="pb-2 text-right">Recibiste</th>
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
