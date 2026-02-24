"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";

export default function UnirsePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [playerName, setPlayerName] = useState("");

  async function handleJoin(spectate = false) {
    if (!code.trim()) {
      setError("Ingresa el código de acceso");
      return;
    }
    if (!playerName.trim()) {
      setError("Ingresa tu nombre");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const accessCode = code.trim().toUpperCase();
      const res = await fetch(`/api/games/${accessCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim(), spectate }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al unirse");
        return;
      }

      // If joining an active game as spectator, go directly to spectate
      if (spectate && data.game?.status === "ACTIVE") {
        router.push(`/juego/${accessCode}/spectate`);
      } else {
        router.push(`/juego/${accessCode}/lobby`);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      title="Unirse a Juego"
      subtitle="Entra con tu nombre y código para ocupar un rol en la cadena."
      rightSlot={
        <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
      }
    >
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>Acceso a sala</CardTitle>
          <CardDescription>
            El código te lo comparte el anfitrión antes de iniciar la simulación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--text-body)]">Tu nombre</label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Ej: María"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--text-body)]">Código de acceso</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BEER-123"
              className="text-center text-lg font-mono tracking-wider"
            />
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Tip: verifica mayúsculas y guiones para evitar errores de ingreso.
          </p>

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <Button className="w-full" size="lg" onClick={() => handleJoin(false)} disabled={loading}>
            {loading ? "Uniéndose..." : "Entrar a la sala"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleJoin(true)}
            disabled={loading}
          >
            <Eye className="w-4 h-4" />
            {loading ? "Uniéndose..." : "Observar juego"}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
