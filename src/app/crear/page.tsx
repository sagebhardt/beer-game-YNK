"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { GAME_MODES, type GameMode } from "@/lib/types";

export default function CrearPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [mode, setMode] = useState<GameMode>("MULTI");
  const [totalRounds, setTotalRounds] = useState(36);
  const [holdingCost, setHoldingCost] = useState(0.5);
  const [backlogCost, setBacklogCost] = useState(1.0);
  const [startInventory, setStartInventory] = useState(12);

  async function handleCreate() {
    if (!playerName.trim()) {
      setError("Ingresa tu nombre");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playerName: playerName.trim(),
          mode,
          totalRounds,
          holdingCost,
          backlogCost,
          startInventory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear el juego");
        return;
      }

      if (mode === "TEST") {
        router.push(`/juego/${data.game.accessCode}/test`);
      } else {
        router.push(`/juego/${data.game.accessCode}/lobby`);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

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
            <CardTitle>Crear Partida</CardTitle>
            <CardDescription>
              Configura y crea una nueva partida del Beer Game
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tu nombre
              </label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ej: Juan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la partida (opcional)
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Clase de Logística"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modo de juego
              </label>
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as GameMode)}
              >
                {GAME_MODES.map((gameMode) => (
                  <option key={gameMode} value={gameMode}>
                    {gameMode === "MULTI"
                      ? "Multijugador"
                      : "Test (1 persona)"}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-400 mt-1">
                {mode === "MULTI"
                  ? "Modo clásico para 4 participantes."
                  : "Una sola persona controla todos los roles."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rondas totales
              </label>
              <Input
                type="number"
                value={totalRounds}
                onChange={(e) => setTotalRounds(parseInt(e.target.value) || 36)}
                min={4}
                max={100}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <Settings className="w-3.5 h-3.5" />
              {showAdvanced ? "Ocultar" : "Configuración avanzada"}
            </button>

            {showAdvanced && (
              <div className="space-y-3 border-t pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Costo inventario ($/unidad/sem)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={holdingCost}
                      onChange={(e) =>
                        setHoldingCost(parseFloat(e.target.value) || 0.5)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Costo backlog ($/unidad/sem)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={backlogCost}
                      onChange={(e) =>
                        setBacklogCost(parseFloat(e.target.value) || 1.0)
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Inventario inicial (unidades)
                  </label>
                  <Input
                    type="number"
                    value={startInventory}
                    onChange={(e) =>
                      setStartInventory(parseInt(e.target.value) || 12)
                    }
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear Partida"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
