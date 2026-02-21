"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { io as ioClient, type Socket } from "socket.io-client";
import { ArrowLeft, Download, ExternalLink, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { DEMAND_PRESETS, ROLE_LABELS, ROLES, type Role } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { C2S, S2C } from "@/lib/socket-events";
import { PageShell } from "@/components/layout/page-shell";
import { SupplyChainStrip } from "@/components/game/supply-chain-strip";
import { ResultsCharts, type OptimalData } from "@/components/game/results-charts";

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
  demandSeries: number[];
  kpis: {
    totalChainCost: number;
    totalBacklogPeak: number;
    costsByRole: Record<string, number>;
    avgInventoryByRole: Record<string, number>;
    bullwhipByRole: Record<string, number>;
  };
  optimal: OptimalData | null;
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
        <p className="text-[var(--text-muted)]">Cargando detalle...</p>
      </div>
    );
  }

  const chainStatuses = Object.fromEntries(
    ROLES.map((role) => {
      const p = detail.players.find((pl) => pl.role === role);
      const submitted = detail.submissions
        ? detail.submissions[role.toLowerCase() as keyof typeof detail.submissions]
        : false;
      if (!p || !p.isConnected) return [role, "danger"];
      if (submitted) return [role, "ok"];
      return [role, "warn"];
    })
  ) as Partial<Record<Role, "ok" | "warn" | "danger" | "neutral">>;

  const chainText = Object.fromEntries(
    ROLES.map((role) => {
      const p = detail.players.find((pl) => pl.role === role);
      if (!p) return [role, "Sin jugador"];
      const submitted = detail.submissions
        ? detail.submissions[role.toLowerCase() as keyof typeof detail.submissions]
        : false;
      return [role, submitted ? `${p.name} · listo` : `${p.name} · pendiente`];
    })
  ) as Partial<Record<Role, string>>;

  return (
    <PageShell
      title={`Admin partida ${detail.game.accessCode}`}
      subtitle={detail.game.name || "Sin nombre"}
      rightSlot={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)]"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>
          <Badge variant="outline">{detail.game.status}</Badge>
          <Badge variant="outline">{detail.game.mode}</Badge>
          {detail.game.status === "COMPLETED" ? (
            <Link href={`/juego/${code}/resultados`}>
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4" /> Ver resultados
              </Button>
            </Link>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = `/api/admin/exports/games/${code}?format=csv`;
            }}
          >
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = `/api/admin/exports/games/${code}?format=xlsx`;
            }}
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      }
    >
      <SupplyChainStrip statuses={chainStatuses} statusText={chainText} className="mb-4" />

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Ronda</p>
            <p className="kpi-value text-xl font-bold">{detail.game.currentRound}/{detail.game.totalRounds}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Demanda actual</p>
            <p className="kpi-value text-xl font-bold">{detail.currentDemand}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Motivo de término</p>
            <p className="text-sm font-semibold">{detail.meta.endedReason || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Costo cadena</p>
            <p className="kpi-value text-xl font-bold">
              {formatCurrency(
                orderedPlayers.reduce((sum, player) => sum + player.totalCost, 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {analytics ? (
        <>
          {/* Optimal comparison KPIs — only for completed games */}
          {analytics.optimal && detail.game.status === "COMPLETED" ? (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card>
                <CardContent className="py-4">
                  <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Target className="h-3.5 w-3.5" /> Mejor partida (récord)
                  </p>
                  <p className="kpi-value mt-1 text-xl font-bold text-emerald-600">
                    {formatCurrency(analytics.optimal.totalChainCost)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-[var(--text-muted)]">% sobre récord</p>
                  <p className="kpi-value mt-1 text-xl font-bold text-[var(--accent)]">
                    {analytics.optimal.totalChainCost > 0 && Number.isFinite(analytics.kpis.totalChainCost / analytics.optimal.totalChainCost)
                      ? `${((analytics.kpis.totalChainCost / analytics.optimal.totalChainCost - 1) * 100).toFixed(0)}%`
                      : "–"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-[var(--text-muted)]">Costo real vs récord por rol</p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    {ROLES.map((role) => {
                      const actual = analytics.kpis.costsByRole[role] ?? 0;
                      const opt = analytics.optimal!.perRoleTotalCost[role] ?? 0;
                      return (
                        <div key={role} className="flex justify-between">
                          <span>{ROLE_LABELS[role]}</span>
                          <span>
                            <span className="font-medium">{formatCurrency(actual)}</span>
                            <span className="text-[var(--text-muted)]"> / {formatCurrency(opt)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
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

          {/* Charts with optimal overlay — only for completed games with round data */}
          {detail.game.status === "COMPLETED" && orderedPlayers.length > 0 && orderedPlayers[0].roundData.length > 0 ? (
            <div className="mb-4">
              <ResultsCharts
                players={orderedPlayers.map((p) => ({
                  role: p.role,
                  name: p.name,
                  roundData: p.roundData.map((rd) => ({
                    round: rd.round,
                    incomingOrder: rd.incomingOrder,
                    orderPlaced: rd.orderPlaced,
                    inventoryAfter: rd.inventoryAfter,
                    backlogAfter: rd.backlogAfter,
                    totalCostCumulative: rd.totalCostCumulative,
                  })),
                }))}
                demandPattern={analytics.demandSeries}
                totalRounds={detail.game.currentRound}
                optimal={analytics.optimal ?? undefined}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <Card className="mb-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Configuración de demanda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Preset</label>
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
          {detail.game.status !== "LOBBY" ? (
            <p className="text-xs text-[var(--text-muted)]">Solo editable en LOBBY</p>
          ) : null}
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
                <tr className="border-b text-left text-[var(--text-muted)]">
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
                    <tr key={player.id} className="border-b border-[var(--bg-muted)]">
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
    </PageShell>
  );
}
