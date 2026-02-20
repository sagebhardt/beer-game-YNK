"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

export default function UnirsePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [playerName, setPlayerName] = useState("");

  async function handleJoin() {
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
        body: JSON.stringify({ name: playerName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al unirse");
        return;
      }

      router.push(`/juego/${accessCode}/lobby`);
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
            <CardTitle>Unirse a Partida</CardTitle>
            <CardDescription>
              Ingresa el código de acceso que te compartió el anfitrión
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
                placeholder="Ej: María"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de acceso
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BEER-123"
                className="text-center text-lg font-mono tracking-wider"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? "Uniéndose..." : "Unirse"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
