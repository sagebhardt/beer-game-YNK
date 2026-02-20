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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { ROLE_LABELS, ROLES, UPSTREAM, DOWNSTREAM, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { formatCurrency } from "@/lib/utils";

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

      if (data.game?.status === "COMPLETED") {
        router.push(`/juego/${code}/resultados`);
        return;
      }
      if (data.game?.status === "LOBBY") {
        router.push(`/juego/${code}/lobby`);
        return;
      }

      // If host and received host data, redirect to host view
      if (data.isHost && data.players) {
        router.push(`/juego/${code}/host`);
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
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const { game, player, pipeline, roundHistory, submissions, hasSubmittedThisRound } = state;
  const role = player.role;
  const upstream = UPSTREAM[role];
  const downstream = DOWNSTREAM[role];

  const upstreamLabel =
    upstream === "PRODUCTION" ? "Producción" : ROLE_LABELS[upstream as Role];
  const downstreamLabel =
    downstream === "CONSUMER" ? "Consumidor" : ROLE_LABELS[downstream as Role];

  // Current round data (last processed round)
  const lastRound = roundHistory.length > 0 ? roundHistory[roundHistory.length - 1] : null;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Beer className="w-5 h-5 text-[#2c02c6]" />
            <div>
              <h1 className="font-bold text-lg">
                {ROLE_LABELS[role]}{" "}
                <span className="text-gray-400 font-normal text-sm">
                  — {player.name}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              Ronda {game.currentRound} / {game.totalRounds}
            </Badge>
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Cost Banner */}
        <div className="bg-[#2c02c6]/5 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">Costo total acumulado</span>
          <span className="text-lg font-bold text-[#2c02c6]">
            {formatCurrency(player.totalCost)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Incoming Order */}
            {lastRound && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Pedido recibido de {downstreamLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{lastRound.incomingOrder} <span className="text-sm font-normal text-gray-400">unidades</span></p>
                </CardContent>
              </Card>
            )}

            {/* Incoming Shipment */}
            {lastRound && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Envío recibido de {upstreamLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{lastRound.incomingShipment} <span className="text-sm font-normal text-gray-400">unidades</span></p>
                </CardContent>
              </Card>
            )}

            {/* Inventory / Backlog */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Estado actual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Inventario</p>
                    <p className="text-2xl font-bold text-green-600">
                      {player.inventory}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(player.inventory * 0.5)}/sem
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Backlog</p>
                    <p className={`text-2xl font-bold ${player.backlog > 0 ? "text-red-600" : "text-gray-300"}`}>
                      {player.backlog}
                    </p>
                    {player.backlog > 0 && (
                      <p className="text-xs text-red-400">
                        {formatCurrency(player.backlog * 1.0)}/sem
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  En tránsito
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pipeline.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No hay envíos en camino
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pipeline.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2"
                      >
                        <span className="text-sm font-medium">
                          {p.quantity} unidades
                        </span>
                        <Badge variant="outline">
                          Llega en {p.arrivesInRounds} ronda{p.arrivesInRounds !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Order Form */}
            <Card className={hasSubmittedThisRound ? "opacity-60" : ""}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  {upstream === "PRODUCTION"
                    ? "Ordenar producción"
                    : `Pedir a ${upstreamLabel}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasSubmittedThisRound ? (
                  <div className="text-center py-4">
                    <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Pedido enviado. Esperando a otros jugadores...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="number"
                      min={0}
                      value={orderQty}
                      onChange={(e) => setOrderQty(e.target.value)}
                      placeholder="Cantidad"
                      className="text-center text-lg"
                    />
                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}
                    <Button
                      className="w-full"
                      onClick={handleSubmitOrder}
                      disabled={submitting}
                    >
                      {submitting ? "Enviando..." : "Enviar Pedido"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Round Status */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Estado de la ronda
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
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-50 text-gray-500"
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

            {/* Round History */}
            {roundHistory.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Historial de rondas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-gray-500">
                          <th className="pb-2 text-left">#</th>
                          <th className="pb-2 text-right">Pedido</th>
                          <th className="pb-2 text-right">Envío</th>
                          <th className="pb-2 text-right">Orden</th>
                          <th className="pb-2 text-right">Inv.</th>
                          <th className="pb-2 text-right">BL</th>
                          <th className="pb-2 text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundHistory.slice(-10).map((r) => (
                          <tr key={r.round} className="border-b border-gray-50">
                            <td className="py-1.5">{r.round}</td>
                            <td className="py-1.5 text-right">{r.incomingOrder}</td>
                            <td className="py-1.5 text-right">{r.incomingShipment}</td>
                            <td className="py-1.5 text-right">{r.orderPlaced}</td>
                            <td className="py-1.5 text-right text-green-600">{r.inventoryAfter}</td>
                            <td className="py-1.5 text-right text-red-600">
                              {r.backlogAfter > 0 ? r.backlogAfter : "-"}
                            </td>
                            <td className="py-1.5 text-right">
                              {formatCurrency(r.totalCostCumulative)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Backlog warning */}
        {player.backlog > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Tienes {player.backlog} unidades en backlog. El costo de backlog es
            el doble del costo de inventario.
          </div>
        )}
      </div>
    </div>
  );
}
