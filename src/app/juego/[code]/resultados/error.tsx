"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ResultsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-lg font-semibold text-[var(--text-strong)]">
        Error al cargar los resultados
      </p>
      <p className="text-sm text-[var(--text-muted)]">
        Ocurrió un problema al mostrar los datos del juego.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Reintentar
        </Button>
        <Link href="/">
          <Button>Volver al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
