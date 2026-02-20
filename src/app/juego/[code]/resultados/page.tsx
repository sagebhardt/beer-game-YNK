"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Beer, Trophy, ArrowLeft, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { ResultsCharts } from "@/components/game/results-charts";
import { SupplyChainStrip } from "@/components/game/supply-chain-strip";
import { PageShell } from "@/components/layout/page-shell";

interface ResultsPlayer {
  id: string;
  name: string;
  role: string;
  inventory: number;
  backlog: number;
  totalCost: number;
  roundData: Array<{
    round: number;
    incomingOrder: number;
    orderPlaced: number;
    inventoryAfter: number;
    backlogAfter: number;
    totalCostCumulative: number;
  }>;
}

interface ResultsData {
  game: {
    accessCode: string;
    name: string;
    status: string;
    currentRound: number;
    totalRounds: number;
    demandPattern: number[];
  };
  players: ResultsPlayer[];
}

function stdDev(values: number[]) {
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export default function ResultadosPage() {
  const params = useParams();
  const code = params.code as string;
  const [data, setData] = useState<ResultsData | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}/results`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // ignore
    }
  }, [code]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Cargando resultados...</p>
      </div>
    );
  }

  const { game, players } = data;

  const sortedByCost = [...players]
    .filter((p) => ROLES.includes(p.role as Role))
    .sort((a, b) => a.totalCost - b.totalCost);
  const winner = sortedByCost[0];
  const totalChainCost = sortedByCost.reduce((s, p) => s + p.totalCost, 0);

  const orderedPlayers = ROLES.map((role) =>
    players.find((p) => p.role === role)
  ).filter(Boolean) as ResultsPlayer[];

  const summary = useMemo(() => {
    const roleVariability = orderedPlayers.map((player) => {
      const orders = player.roundData.map((r) => r.orderPlaced);
      return {
        role: player.role as Role,
        playerName: player.name,
        variability: stdDev(orders),
        peakBacklog: Math.max(0, ...player.roundData.map((r) => r.backlogAfter)),
      };
    });

    const mostVariable = [...roleVariability].sort((a, b) => b.variability - a.variability)[0];
    const biggestBacklog = [...roleVariability].sort((a, b) => b.peakBacklog - a.peakBacklog)[0];

    return {
      mostVariable,
      biggestBacklog,
    };
  }, [orderedPlayers]);

  return (
    <PageShell
      title="Resultados del Juego"
      subtitle={game.name ? `${game.name} · ${game.currentRound} rondas simuladas` : `${game.currentRound} rondas simuladas`}
      rightSlot={<Badge variant="outline">Código {game.accessCode}</Badge>}
    >
      <SupplyChainStrip className="mb-4" />

      {winner ? (
        <div className="mb-4 rounded-xl border border-[#fde7bc] bg-[#fff8e8] p-4 text-center">
          <Trophy className="mx-auto mb-1 h-6 w-6 text-[var(--warn)]" />
          <p className="text-sm text-[var(--warn)]">Mejor desempeño</p>
          <p className="text-lg font-bold text-[var(--text-strong)]">
            {winner.name} ({ROLE_LABELS[winner.role as Role]})
          </p>
          <p className="text-sm text-[var(--text-body)]">Costo total: {formatCurrency(winner.totalCost)}</p>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Costo total cadena</p>
            <p className="kpi-value mt-1 text-2xl font-bold text-[var(--accent)]">{formatCurrency(totalChainCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <TrendingUp className="h-3.5 w-3.5" /> Mayor variabilidad
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
              {summary.mostVariable
                ? `${ROLE_LABELS[summary.mostVariable.role]} (${summary.mostVariable.playerName})`
                : "-"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Desv. estándar: {summary.mostVariable?.variability.toFixed(2) ?? "0.00"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <AlertTriangle className="h-3.5 w-3.5" /> Pico backlog
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
              {summary.biggestBacklog
                ? `${ROLE_LABELS[summary.biggestBacklog.role]} (${summary.biggestBacklog.playerName})`
                : "-"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">Máximo: {summary.biggestBacklog?.peakBacklog ?? 0} unidades</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {orderedPlayers.map((player) => {
          const role = player.role as Role;
          const isWinner = player.id === winner?.id;

          return (
            <Card key={role} className={isWinner ? "border-[#fde7bc] ring-1 ring-[#fde7bc]" : ""}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{ROLE_LABELS[role]}</CardTitle>
                  {isWinner ? <Trophy className="h-4 w-4 text-[var(--warn)]" /> : <Activity className="h-4 w-4 text-[var(--text-muted)]" />}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{player.name}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-[var(--text-strong)]">{formatCurrency(player.totalCost)}</p>
                <div className="mt-2 flex gap-3 text-xs text-[var(--text-muted)]">
                  <span>Inv: {player.inventory}</span>
                  <span>BL: {player.backlog}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ResultsCharts
        players={orderedPlayers}
        demandPattern={game.demandPattern}
        totalRounds={game.currentRound}
      />

      <div className="mt-7 text-center">
        <Link href="/crear">
          <Button size="lg">Jugar de nuevo</Button>
        </Link>
        <div className="mt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)]"
          >
            <ArrowLeft className="w-3 h-3" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
