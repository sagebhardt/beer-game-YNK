"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Beer,
  Eye,
  Check,
  Clock,
  Wifi,
  WifiOff,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { ROLES, ROLE_LABELS, DOWNSTREAM, type Role } from "@/lib/types";
import { useSocket } from "@/lib/use-socket";
import { S2C } from "@/lib/socket-events";
import { formatCurrency } from "@/lib/utils";

interface HostStateData {
  game: {
    id: string;
    accessCode: string;
    name: string;
    status: string;
    currentRound: number;
    totalRounds: number;
    demandPattern: number[];
    holdingCost: number;
    backlogCost: number;
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
  pipeline: Array<{
    type: string;
    fromRole: string;
    toRole: string;
    quantity: number;
    roundDue: number;
    arrivesInRounds: number;
  }>;
  submissions: {
    retailer: boolean;
    wholesaler: boolean;
    distributor: boolean;
    factory: boolean;
  } | null;
  currentDemand: number;
  isHost: boolean;
}

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [state, setState] = useState<HostStateData | null>(null);
  const [sessionId, setSessionId] = useState("");

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

    socket.on(S2C.ORDER_SUBMITTED, () => fetchState());
    socket.on(S2C.ROUND_ADVANCED, () => fetchState());
    socket.on(S2C.GAME_ENDED, () => {
      router.push(`/juego/${code}/resultados`);
    });

    return () => {
      socket.off(S2C.ORDER_SUBMITTED);
      socket.off(S2C.ROUND_ADVANCED);
      socket.off(S2C.GAME_ENDED);
    };
  }, [socket, code, router, fetchState]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const { game, players, submissions, currentDemand, pipeline } = state;

  // Sort players by chain order
  const orderedPlayers = ROLES.map((role) =>
    players.find((p) => p.role === role)
  ).filter(Boolean);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Beer className="w-5 h-5 text-[#2c02c6]" />
            <h1 className="font-bold text-lg">
              Vista del Anfitrión
              {game.name && (
                <span className="text-gray-400 font-normal text-sm ml-2">
                  — {game.name}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Eye className="w-4 h-4 text-gray-400" />
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

        {/* Consumer demand */}
        <div className="bg-amber-50 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-amber-700">
            Demanda del consumidor esta ronda
          </span>
          <span className="text-lg font-bold text-amber-800">
            {currentDemand} unidades
          </span>
        </div>

        {/* Supply Chain Overview */}
        <div className="flex items-center justify-center gap-2 mb-6 overflow-x-auto py-2">
          <div className="text-center flex-shrink-0">
            <div className="bg-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-600">Consumidor</p>
              <p className="text-sm font-bold">{currentDemand}/sem</p>
            </div>
          </div>
          {orderedPlayers.map((player, i) => {
            if (!player) return null;
            const role = player.role as Role;
            const submitted = submissions
              ? submissions[role.toLowerCase() as keyof typeof submissions]
              : false;

            // Pipeline between this player and next
            const downstream = DOWNSTREAM[role];
            const pipelineToDownstream = pipeline.filter(
              (p) => p.type === "SHIPMENT" && p.fromRole === role && p.toRole === downstream
            );
            const totalInTransit = pipelineToDownstream.reduce((s, p) => s + p.quantity, 0);

            return (
              <div key={role} className="flex items-center gap-2 flex-shrink-0">
                <ArrowRight className="w-4 h-4 text-gray-300" />
                {totalInTransit > 0 && (
                  <div className="text-xs text-gray-400 bg-gray-50 rounded px-1.5 py-0.5">
                    {totalInTransit} →
                  </div>
                )}
                <div className={`text-center rounded-lg px-3 py-2 border ${submitted ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
                  <p className="text-xs text-gray-500">
                    {ROLE_LABELS[role]}
                  </p>
                  <p className="text-xs font-medium">{player.name}</p>
                  <div className="flex gap-2 mt-1 text-xs">
                    <span className="text-green-600">{player.inventory}inv</span>
                    {player.backlog > 0 && (
                      <span className="text-red-600">{player.backlog}bl</span>
                    )}
                  </div>
                  {submitted ? (
                    <Check className="w-3 h-3 text-green-500 mx-auto mt-1" />
                  ) : (
                    <Clock className="w-3 h-3 text-gray-400 mx-auto mt-1" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Player Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {orderedPlayers.map((player) => {
            if (!player) return null;
            const role = player.role as Role;
            const lastRound =
              player.roundData.length > 0
                ? player.roundData[player.roundData.length - 1]
                : null;

            return (
              <Card key={role}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {ROLE_LABELS[role]}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${player.isConnected ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="text-xs text-gray-400">
                        {player.name}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Inventario</p>
                      <p className="font-bold text-green-600">
                        {player.inventory}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Backlog</p>
                      <p className={`font-bold ${player.backlog > 0 ? "text-red-600" : "text-gray-300"}`}>
                        {player.backlog}
                      </p>
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Costo total</span>
                      <span className="text-sm font-bold">
                        {formatCurrency(player.totalCost)}
                      </span>
                    </div>
                    {lastRound && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">
                          Última orden
                        </span>
                        <span className="text-xs font-medium">
                          {lastRound.orderPlaced} uds
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Round Submission Status */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Progreso de la ronda {game.currentRound}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                    {submitted ? " — Listo" : " — Esperando"}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
