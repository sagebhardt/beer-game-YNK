"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Beer, Trophy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { ResultsCharts } from "@/components/game/results-charts";

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

export default function ResultadosPage() {
  const params = useParams();
  const code = params.code as string;
  const [data, setData] = useState<ResultsData | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${code}`);
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
        <p className="text-gray-500">Cargando resultados...</p>
      </div>
    );
  }

  const { game, players } = data;

  // Sort players by cost (winner = lowest)
  const sortedByCost = [...players]
    .filter((p) => ROLES.includes(p.role as Role))
    .sort((a, b) => a.totalCost - b.totalCost);
  const winner = sortedByCost[0];
  const totalChainCost = sortedByCost.reduce((s, p) => s + p.totalCost, 0);

  // Order by chain for display
  const orderedPlayers = ROLES.map((role) =>
    players.find((p) => p.role === role)
  ).filter(Boolean) as ResultsPlayer[];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <Beer className="w-10 h-10 text-[#2c02c6] mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Resultados del Juego</h1>
          {game.name && (
            <p className="text-gray-500">{game.name}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {game.currentRound} rondas jugadas
          </p>
        </div>

        {/* Winner Banner */}
        {winner && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-center">
            <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <p className="text-sm text-amber-700">Mejor desempeño</p>
            <p className="text-lg font-bold text-amber-900">
              {winner.name} ({ROLE_LABELS[winner.role as Role]})
            </p>
            <p className="text-sm text-amber-600">
              Costo total: {formatCurrency(winner.totalCost)}
            </p>
          </div>
        )}

        {/* Player Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {orderedPlayers.map((player, i) => {
            const role = player.role as Role;
            const isWinner = player.id === winner?.id;

            return (
              <Card
                key={role}
                className={isWinner ? "border-amber-300 ring-1 ring-amber-200" : ""}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {ROLE_LABELS[role]}
                    </CardTitle>
                    {isWinner && (
                      <Trophy className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{player.name}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">
                    {formatCurrency(player.totalCost)}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>Inv: {player.inventory}</span>
                    <span>BL: {player.backlog}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Total Chain Cost */}
        <div className="bg-[#2c02c6]/5 rounded-lg p-3 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-600">Costo total de la cadena</span>
          <span className="text-lg font-bold text-[#2c02c6]">
            {formatCurrency(totalChainCost)}
          </span>
        </div>

        {/* Charts */}
        <ResultsCharts
          players={orderedPlayers}
          demandPattern={game.demandPattern}
          totalRounds={game.currentRound}
        />

        {/* Play Again */}
        <div className="text-center mt-8">
          <Link href="/crear">
            <Button size="lg">Jugar de nuevo</Button>
          </Link>
          <div className="mt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-3 h-3" />
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
