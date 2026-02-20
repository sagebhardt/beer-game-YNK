"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { io as ioClient, type Socket } from "socket.io-client";
import { ArrowLeft, Download, Lock, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { C2S, S2C } from "@/lib/socket-events";
import { formatCurrency } from "@/lib/utils";
import { PageShell } from "@/components/layout/page-shell";

interface AdminGameSummary {
  id: string;
  accessCode: string;
  name: string;
  status: string;
  mode: string;
  currentRound: number;
  totalRounds: number;
  playerCount: number;
  assignedRoles: number;
  updatedAt: string;
  endedAt: string | null;
  submissions: {
    ready: number;
    total: number;
  } | null;
}

interface OverviewData {
  kpis: {
    totalGames: number;
    avgCost: number;
    medianCost: number;
    countsByMode: Record<string, number>;
  };
}

export default function AdminPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [authError, setAuthError] = useState("");

  const [games, setGames] = useState<AdminGameSummary[]>([]);
  const [analytics, setAnalytics] = useState<OverviewData | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    const res = await fetch("/api/admin/session");
    const data = await res.json();
    setAuthenticated(!!data.authenticated);
    setAuthLoading(false);
  }, []);

  const fetchGames = useCallback(async () => {
    const params = new URLSearchParams({
      status: statusFilter,
      mode: modeFilter,
      q: query,
    });

    const res = await fetch(`/api/admin/games?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setGames(data.games ?? []);
  }, [statusFilter, modeFilter, query]);

  const fetchAnalytics = useCallback(async () => {
    const params = new URLSearchParams({ mode: modeFilter });
    const res = await fetch(`/api/admin/analytics/overview?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json();
    setAnalytics(data);
  }, [modeFilter]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!authenticated) return;
    fetchGames();
    fetchAnalytics();
  }, [authenticated, fetchGames, fetchAnalytics]);

  useEffect(() => {
    if (!authenticated) return;

    const socket: Socket = ioClient({ path: "/api/socketio" });

    socket.on("connect", () => {
      socket.emit(C2S.JOIN_ADMIN_DASHBOARD);
    });

    socket.on(S2C.ADMIN_GAME_UPSERT, (payload: { snapshot?: AdminGameSummary[] } & AdminGameSummary) => {
      if (Array.isArray(payload.snapshot)) {
        setGames(payload.snapshot);
        return;
      }

      setGames((prev) => {
        const index = prev.findIndex((game) => game.accessCode === payload.accessCode);
        if (index === -1) return [payload, ...prev];

        const next = [...prev];
        next[index] = payload;
        return next;
      });
    });

    socket.on(S2C.ADMIN_GAME_REMOVED, ({ code }: { code: string }) => {
      setGames((prev) => prev.filter((game) => game.accessCode !== code));
    });

    return () => {
      socket.disconnect();
    };
  }, [authenticated]);

  const visibleGames = useMemo(() => {
    return games.filter((game) => {
      if (statusFilter !== "ALL" && game.status !== statusFilter) return false;
      if (modeFilter !== "ALL" && game.mode !== modeFilter) return false;
      if (!query.trim()) return true;

      const needle = query.toLowerCase();
      return (
        game.accessCode.toLowerCase().includes(needle) ||
        game.name.toLowerCase().includes(needle)
      );
    });
  }, [games, statusFilter, modeFilter, query]);

  async function handleLogin() {
    setAuthError("");

    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: adminKey }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAuthError(data.error || "No se pudo iniciar sesión");
      return;
    }

    setAdminKey("");
    await fetchSession();
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setGames([]);
    setAnalytics(null);
  }

  async function runAction(code: string, action: "close" | "terminate" | "delete") {
    setBusyCode(code);
    setBusyAction(action);

    const endpoint =
      action === "delete"
        ? `/api/admin/games/${code}`
        : `/api/admin/games/${code}/${action}`;

    await fetch(endpoint, {
      method: action === "delete" ? "DELETE" : "POST",
    });

    setBusyCode(null);
    setBusyAction(null);
    await fetchGames();
    await fetchAnalytics();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Cargando admin...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <PageShell
        title="Panel Administrador"
        subtitle="Acceso protegido para monitoreo y gestión de partidas."
        rightSlot={
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        }
      >
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--accent)]" />
              Ingresar al dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm font-semibold text-[var(--text-body)]">Clave admin</label>
            <Input
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Ingresa clave"
            />
            {authError ? <p className="text-sm text-[var(--danger)]">{authError}</p> : null}
            <Button className="w-full" onClick={handleLogin}>
              <Lock className="w-4 h-4" />
              Ingresar
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Admin de Juegos"
      subtitle="Monitoreo en tiempo real de rondas, costos y estado operacional."
      rightSlot={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/admin/exports/overview?format=csv&mode=${modeFilter}`;
            }}
          >
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/admin/exports/overview?format=xlsx&mode=${modeFilter}`;
            }}
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      }
    >
      {analytics ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-[var(--text-muted)]">Juegos completados</p>
              <p className="kpi-value text-2xl font-bold text-[var(--text-strong)]">{analytics.kpis.totalGames}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-[var(--text-muted)]">Costo promedio</p>
              <p className="kpi-value text-xl font-bold text-[var(--text-strong)]">{formatCurrency(analytics.kpis.avgCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-[var(--text-muted)]">Costo mediana</p>
              <p className="kpi-value text-xl font-bold text-[var(--text-strong)]">{formatCurrency(analytics.kpis.medianCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-[var(--text-muted)]">Modo TEST / MULTI</p>
              <p className="kpi-value text-xl font-bold text-[var(--text-strong)]">
                {(analytics.kpis.countsByMode.TEST ?? 0)} / {(analytics.kpis.countsByMode.MULTI ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="mb-4">
        <CardContent className="grid grid-cols-1 gap-3 py-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-[var(--text-muted)]" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Código o nombre"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Estado</label>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">Todos</option>
              <option value="LOBBY">LOBBY</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="COMPLETED">COMPLETED</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-muted)]">Modo</label>
            <Select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
              <option value="ALL">Todos</option>
              <option value="MULTI">MULTI</option>
              <option value="TEST">TEST</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Juegos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[var(--text-muted)]">
                  <th className="py-2 pr-2">Código</th>
                  <th className="py-2 pr-2">Nombre</th>
                  <th className="py-2 pr-2">Estado</th>
                  <th className="py-2 pr-2">Modo</th>
                  <th className="py-2 pr-2">Ronda</th>
                  <th className="py-2 pr-2">Roles</th>
                  <th className="py-2 pr-2">Submissions</th>
                  <th className="py-2 pr-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleGames.map((game) => {
                  const isBusy = busyCode === game.accessCode;
                  return (
                    <tr key={game.id} className="border-b border-[var(--bg-muted)] align-top">
                      <td className="py-2 pr-2 font-mono">{game.accessCode}</td>
                      <td className="py-2 pr-2">{game.name || "Sin nombre"}</td>
                      <td className="py-2 pr-2">
                        <Badge variant="outline">{game.status}</Badge>
                      </td>
                      <td className="py-2 pr-2">{game.mode}</td>
                      <td className="py-2 pr-2">{game.currentRound}/{game.totalRounds}</td>
                      <td className="py-2 pr-2">{game.assignedRoles}/4</td>
                      <td className="py-2 pr-2">
                        {game.submissions
                          ? `${game.submissions.ready}/${game.submissions.total}`
                          : "-"}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/juegos/${game.accessCode}`}>
                            <Button size="sm" variant="outline">Ver</Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runAction(game.accessCode, "close")}
                            disabled={isBusy}
                          >
                            {isBusy && busyAction === "close" ? "..." : "Cerrar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runAction(game.accessCode, "terminate")}
                            disabled={isBusy}
                          >
                            {isBusy && busyAction === "terminate" ? "..." : "Terminar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => runAction(game.accessCode, "delete")}
                            disabled={isBusy}
                          >
                            {isBusy && busyAction === "delete" ? "..." : "Eliminar"}
                          </Button>
                        </div>
                      </td>
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
