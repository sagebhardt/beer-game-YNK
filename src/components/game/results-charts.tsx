"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ROLE_COLORS: Record<string, string> = {
  RETAILER: "#0039A7",
  WHOLESALER: "#3B82F6",
  DISTRIBUTOR: "#FB4F14",
  FACTORY: "#10b981",
};

interface ResultsPlayer {
  role: string;
  name: string;
  roundData: Array<{
    round: number;
    incomingOrder: number;
    orderPlaced: number;
    inventoryAfter: number;
    backlogAfter: number;
    totalCostCumulative: number;
  }>;
}

export interface OptimalData {
  perRole: Record<string, Array<{
    round: number;
    orderPlaced: number;
    inventoryAfter: number;
    backlogAfter: number;
    totalCostCumulative: number;
  }>>;
  perRoleTotalCost: Record<string, number>;
  totalChainCost: number;
}

interface Props {
  players: ResultsPlayer[];
  demandPattern: number[];
  totalRounds: number;
  optimal?: OptimalData;
}

export function ResultsCharts({ players, demandPattern, totalRounds, optimal }: Props) {
  if (players.length === 0 || totalRounds === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-soft)] p-6 text-center text-sm text-[var(--text-muted)]">
        No hay datos suficientes para generar gráficos.
      </div>
    );
  }

  const rounds = useMemo(
    () => Array.from({ length: totalRounds }, (_, i) => i + 1),
    [totalRounds]
  );

  // Pre-index round data into Maps for O(1) lookups instead of O(n) .find()
  const playerRoundMaps = useMemo(() => {
    const maps = new Map<string, Map<number, ResultsPlayer["roundData"][0]>>();
    for (const player of players) {
      maps.set(player.role, new Map(player.roundData.map((rd) => [rd.round, rd])));
    }
    return maps;
  }, [players]);

  const optimalRoundMaps = useMemo(() => {
    if (!optimal) return null;
    const maps = new Map<string, Map<number, NonNullable<typeof optimal>["perRole"][string][0]>>();
    for (const [role, data] of Object.entries(optimal.perRole)) {
      maps.set(role, new Map(data.map((d) => [d.round, d])));
    }
    return maps;
  }, [optimal]);

  const bullwhipData = useMemo(() => ({
    labels: rounds.map((r) => `${r}`),
    datasets: [
      {
        label: "Demanda consumidor",
        data: rounds.map((r) => demandPattern[r - 1] ?? 4),
        borderColor: "#9ca3af",
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
      },
      ...players.map((player) => ({
        label: ROLE_LABELS[player.role as Role] || player.role,
        data: rounds.map((r) => playerRoundMaps.get(player.role)?.get(r)?.orderPlaced ?? null),
        borderColor: ROLE_COLORS[player.role] || "#6b7280",
        borderWidth: 2,
        pointRadius: 1,
        tension: 0.2,
      })),
      ...(optimalRoundMaps
        ? [
            {
              label: "Pedido récord",
              data: rounds.map((r) => optimalRoundMaps.get("RETAILER")?.get(r)?.orderPlaced ?? null),
              borderColor: "#10b981",
              borderDash: [8, 4],
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.1,
            },
          ]
        : []),
    ],
  }), [rounds, demandPattern, players, playerRoundMaps, optimalRoundMaps]);

  const inventoryData = useMemo(() => ({
    labels: rounds.map((r) => `${r}`),
    datasets: [
      ...players.map((player) => ({
        label: ROLE_LABELS[player.role as Role] || player.role,
        data: rounds.map((r) => {
          const rd = playerRoundMaps.get(player.role)?.get(r);
          if (!rd) return null;
          return rd.inventoryAfter > 0
            ? rd.inventoryAfter
            : -rd.backlogAfter;
        }),
        borderColor: ROLE_COLORS[player.role] || "#6b7280",
        borderWidth: 2,
        pointRadius: 1,
        tension: 0.2,
      })),
      ...(optimalRoundMaps
        ? ROLES.map((role) => ({
            label: `${ROLE_LABELS[role]} récord`,
            data: rounds.map((r) => {
              const ord = optimalRoundMaps.get(role)?.get(r);
              if (!ord) return null;
              return ord.inventoryAfter > 0
                ? ord.inventoryAfter
                : -ord.backlogAfter;
            }),
            borderColor: ROLE_COLORS[role] || "#6b7280",
            borderDash: [8, 4] as number[],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
          }))
        : []),
    ],
  }), [rounds, players, playerRoundMaps, optimalRoundMaps]);

  const costData = useMemo(() => ({
    labels: rounds.map((r) => `${r}`),
    datasets: [
      ...players.map((player) => ({
        label: ROLE_LABELS[player.role as Role] || player.role,
        data: rounds.map((r) => playerRoundMaps.get(player.role)?.get(r)?.totalCostCumulative ?? null),
        borderColor: ROLE_COLORS[player.role] || "#6b7280",
        borderWidth: 2,
        pointRadius: 1,
        tension: 0.2,
      })),
      ...(optimalRoundMaps
        ? ROLES.map((role) => ({
            label: `${ROLE_LABELS[role]} récord`,
            data: rounds.map((r) => optimalRoundMaps.get(role)?.get(r)?.totalCostCumulative ?? null),
            borderColor: ROLE_COLORS[role] || "#6b7280",
            borderDash: [8, 4] as number[],
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
          }))
        : []),
    ],
  }), [rounds, players, playerRoundMaps, optimalRoundMaps]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { boxWidth: 12, padding: 16, font: { size: 11 } },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Ronda", font: { size: 11 } },
        ticks: { font: { size: 10 } },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Bullwhip Effect Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Efecto Látigo (Bullwhip)</CardTitle>
          <CardDescription>
            Pedidos realizados por cada rol vs. la demanda real del consumidor.
            La amplificación muestra el efecto látigo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <Line
              data={bullwhipData}
              options={{
                ...commonOptions,
                scales: {
                  ...commonOptions.scales,
                  y: {
                    title: {
                      display: true,
                      text: "Unidades ordenadas",
                      font: { size: 11 },
                    },
                    ticks: { font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory / Backlog Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventario y Backlog</CardTitle>
          <CardDescription>
            Valores positivos = inventario, negativos = backlog (pedidos sin
            cumplir)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <Line
              data={inventoryData}
              options={{
                ...commonOptions,
                scales: {
                  ...commonOptions.scales,
                  y: {
                    title: {
                      display: true,
                      text: "Unidades",
                      font: { size: 11 },
                    },
                    ticks: { font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costo acumulado</CardTitle>
          <CardDescription>
            Costo total acumulado por cada jugador a lo largo del juego
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <Line
              data={costData}
              options={{
                ...commonOptions,
                scales: {
                  ...commonOptions.scales,
                  y: {
                    title: {
                      display: true,
                      text: "Costo (USD)",
                      font: { size: 11 },
                    },
                    ticks: { font: { size: 10 } },
                  },
                },
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
