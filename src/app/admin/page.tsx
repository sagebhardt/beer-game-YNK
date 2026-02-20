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
        <p className="text-gray-500">Cargando admin...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#2c02c6]" />
                Panel Administrador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Clave admin</label>
              <Input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Ingresa clave"
              />
              {authError && <p className="text-sm text-red-600">{authError}</p>}
              <Button className="w-full" onClick={handleLogin}>
                <Lock className="w-4 h-4" />
                Ingresar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Admin de Juegos</h1>
            <p className="text-sm text-gray-500">Monitoreo en tiempo real y gestión de partidas</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = `/api/admin/exports/overview?format=csv&mode=${modeFilter}`;
              }}
            >
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = `/api/admin/exports/overview?format=xlsx&mode=${modeFilter}`;
              }}
            >
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </div>

        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">Juegos completados</p>
                <p className="text-2xl font-bold">{analytics.kpis.totalGames}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">Costo promedio</p>
                <p className="text-xl font-bold">{formatCurrency(analytics.kpis.avgCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">Costo mediana</p>
                <p className="text-xl font-bold">{formatCurrency(analytics.kpis.medianCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-gray-500">Modo TEST / MULTI</p>
                <p className="text-xl font-bold">
                  {(analytics.kpis.countsByMode.TEST ?? 0)} / {(analytics.kpis.countsByMode.MULTI ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-4">
          <CardContent className="py-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Código o nombre"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Estado</label>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">Todos</option>
                <option value="LOBBY">LOBBY</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Modo</label>
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
                  <tr className="text-left border-b">
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
                      <tr key={game.id} className="border-b border-gray-100 align-top">
                        <td className="py-2 pr-2 font-mono">{game.accessCode}</td>
                        <td className="py-2 pr-2">{game.name || "Sin nombre"}</td>
                        <td className="py-2 pr-2">
                          <Badge variant="outline">{game.status}</Badge>
                        </td>
                        <td className="py-2 pr-2">{game.mode}</td>
                        <td className="py-2 pr-2">
                          {game.currentRound}/{game.totalRounds}
                        </td>
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
      </div>
    </div>
  );
}
