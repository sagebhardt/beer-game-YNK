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
import { PageShell } from "@/components/layout/page-shell";

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
    <PageShell
      title="Crear Partida"
      subtitle="Define parámetros de la simulación y abre la sala para tu equipo."
      rightSlot={
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      }
    >
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Configuración inicial</CardTitle>
          <CardDescription>
            Prioriza claridad para tus jugadores. Puedes ajustar costos avanzados si lo necesitas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--text-body)]">Tu nombre</label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ej: Juan"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--text-body)]">Nombre de partida (opcional)</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Clase de logística"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--text-body)]">Modo de juego</label>
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as GameMode)}
              >
                {GAME_MODES.map((gameMode) => (
                  <option key={gameMode} value={gameMode}>
                    {gameMode === "MULTI" ? "Multijugador" : "Test (1 persona)"}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {mode === "MULTI"
                  ? "Modo clásico para 4 participantes."
                  : "Una persona controla toda la cadena."}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--text-body)]">Rondas totales</label>
              <Input
                type="number"
                value={totalRounds}
                onChange={(e) => setTotalRounds(parseInt(e.target.value) || 36)}
                min={4}
                max={100}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-body)]"
          >
            <Settings className="w-3.5 h-3.5" />
            {showAdvanced ? "Ocultar" : "Configuración avanzada"}
          </button>

          {showAdvanced && (
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-body)]">Costo inventario</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={holdingCost}
                    onChange={(e) => setHoldingCost(parseFloat(e.target.value) || 0.5)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-body)]">Costo backlog</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={backlogCost}
                    onChange={(e) => setBacklogCost(parseFloat(e.target.value) || 1.0)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-body)]">Inventario inicial</label>
                  <Input
                    type="number"
                    value={startInventory}
                    onChange={(e) => setStartInventory(parseInt(e.target.value) || 12)}
                  />
                </div>
              </div>
            </div>
          )}

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <Button className="w-full" size="lg" onClick={handleCreate} disabled={loading}>
            {loading ? "Creando..." : "Crear y abrir sala"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
