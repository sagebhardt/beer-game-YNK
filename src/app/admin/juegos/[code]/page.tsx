"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { io as ioClient, type Socket } from "socket.io-client";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { DEMAND_PRESETS, ROLE_LABELS, ROLES, type Role } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { C2S, S2C } from "@/lib/socket-events";

interface AdminDetailData {
  game: {
    id: string;
    accessCode: string;
    name: string;
    status: string;
    mode: string;
    currentRound: number;
    totalRounds: number;
    demandPattern: number[];
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
  submissions: {
    retailer: boolean;
    wholesaler: boolean;
    distributor: boolean;
    factory: boolean;
  } | null;
  currentDemand: number;
  meta: {
    endedReason: string | null;
    demandPresetKey: string;
  };
}

interface GameAnalyticsData {
  kpis: {
    totalChainCost: number;
    totalBacklogPeak: number;
    costsByRole: Record<string, number>;
    avgInventoryByRole: Record<string, number>;
    bullwhipByRole: Record<string, number>;
  };
}

export default function AdminGameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [detail, setDetail] = useState<AdminDetailData | null>(null);
  const [analytics, setAnalytics] = useState<GameAnalyticsData | null>(null);
  const [presetKey, setPresetKey] = useState("classic");
  const [savingDemand, setSavingDemand] = useState(false);
  const [runningAction, setRunningAction] = useState("");
  const [error, setError] = useState("");

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/admin/games/${code}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cargar el juego");
      return;
    }

    setDetail(data);
    setPresetKey(data.meta?.demandPresetKey ?? "classic");
  }, [code]);

  const fetchAnalytics = useCallback(async () => {
    const res = await fetch(`/api/admin/analytics/games/${code}`);
    if (!res.ok) return;
    const data = await res.json();
    setAnalytics(data);
  }, [code]);

  useEffect(() => {
    fetchDetail();
    fetchAnalytics();
  }, [fetchDetail, fetchAnalytics]);

  useEffect(() => {
    const socket: Socket = ioClient({ path: "/api/socketio" });

    socket.on("connect", () => {
      socket.emit(C2S.JOIN_ADMIN_GAME, { gameCode: code });
    });

    socket.on(S2C.ADMIN_GAME_DETAIL, (payload: AdminDetailData) => {
      if (payload.game.accessCode !== code) return;
      setDetail(payload);
      if (payload.meta?.demandPresetKey) {
        setPresetKey(payload.meta.demandPresetKey);
      }
    });

    socket.on(S2C.ADMIN_GAME_REMOVED, ({ code: removedCode }: { code: string }) => {
      if (removedCode === code) {
        router.push("/admin");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [code, router]);

  const orderedPlayers = useMemo(() => {
    if (!detail) return [];
    return ROLES.map((role) => detail.players.find((player) => player.role === role)).filter(
      Boolean
    ) as AdminDetailData["players"];
  }, [detail]);

  async function saveDemand() {
    if (!detail) return;
    setSavingDemand(true);
    setError("");

    const res = await fetch(`/api/admin/games/${code}/demand`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetKey }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar demanda");
    } else {
      await fetchDetail();
    }

    setSavingDemand(false);
  }

  async function runAction(action: "close" | "terminate" | "delete") {
    setRunningAction(action);
    setError("");

    const endpoint =
      action === "delete"
        ? `/api/admin/games/${code}`
        : `/api/admin/games/${code}/${action}`;

    const res = await fetch(endpoint, {
      method: action === "delete" ? "DELETE" : "POST",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo ejecutar la acción");
      setRunningAction("");
      return;
    }

    if (action === "delete") {
      router.push("/admin");
      return;
    }

    setRunningAction("");
    await fetchDetail();
    await fetchAnalytics();
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando detalle...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al dashboard
            </Link>
            <h1 className="text-xl font-bold mt-1">{detail.game.accessCode}</h1>
            <p className="text-sm text-gray-500">{detail.game.name || "Sin nombre"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{detail.game.status}</Badge>
            <Badge variant="outline">{detail.game.mode}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = `/api/admin/exports/games/${code}?format=csv`;
              }}
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = `/api/admin/exports/games/${code}?format=xlsx`;
              }}
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500">Ronda</p>
              <p className="text-xl font-bold">{detail.game.currentRound}/{detail.game.totalRounds}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500">Demanda actual</p>
              <p className="text-xl font-bold">{detail.currentDemand}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500">Motivo de término</p>
              <p className="text-sm font-semibold">{detail.meta.endedReason || "-"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500">Costo cadena</p>
              <p className="text-xl font-bold">
                {formatCurrency(
                  orderedPlayers.reduce((sum, player) => sum + player.totalCost, 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Bullwhip por rol</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {ROLES.map((role) => (
                  <div key={role} className="flex justify-between">
                    <span>{ROLE_LABELS[role]}</span>
                    <span className="font-medium">
                      {(analytics.kpis.bullwhipByRole[role] ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Inventario promedio por rol</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {ROLES.map((role) => (
                  <div key={role} className="flex justify-between">
                    <span>{ROLE_LABELS[role]}</span>
                    <span className="font-medium">
                      {(analytics.kpis.avgInventoryByRole[role] ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Configuración de demanda</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Preset</label>
              <Select value={presetKey} onChange={(event) => setPresetKey(event.target.value)}>
                {Object.entries(DEMAND_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </Select>
            </div>
            <Button
              onClick={saveDemand}
              disabled={detail.game.status !== "LOBBY" || savingDemand}
            >
              {savingDemand ? "Guardando..." : "Guardar demanda"}
            </Button>
            {detail.game.status !== "LOBBY" && (
              <p className="text-xs text-gray-500">Solo editable en LOBBY</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Acciones administrativas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => runAction("close")} disabled={!!runningAction}>
              {runningAction === "close" ? "Procesando..." : "Cerrar"}
            </Button>
            <Button variant="outline" onClick={() => runAction("terminate")} disabled={!!runningAction}>
              {runningAction === "terminate" ? "Procesando..." : "Terminar"}
            </Button>
            <Button variant="destructive" onClick={() => runAction("delete")} disabled={!!runningAction}>
              {runningAction === "delete" ? "Procesando..." : "Eliminar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estado por rol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Rol</th>
                    <th className="py-2 pr-2">Jugador</th>
                    <th className="py-2 pr-2">Inventario</th>
                    <th className="py-2 pr-2">Backlog</th>
                    <th className="py-2 pr-2">Costo</th>
                    <th className="py-2 pr-2">Última orden</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedPlayers.map((player) => {
                    const role = player.role as Role;
                    const lastRound =
                      player.roundData.length > 0
                        ? player.roundData[player.roundData.length - 1]
                        : null;

                    return (
                      <tr key={player.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2">{ROLE_LABELS[role]}</td>
                        <td className="py-2 pr-2">{player.name}</td>
                        <td className="py-2 pr-2">{player.inventory}</td>
                        <td className="py-2 pr-2">{player.backlog}</td>
                        <td className="py-2 pr-2">{formatCurrency(player.totalCost)}</td>
                        <td className="py-2 pr-2">{lastRound?.orderPlaced ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
