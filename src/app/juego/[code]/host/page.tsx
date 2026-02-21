"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy host page — redirects to the play page.
 * The host now plays as a regular player (information silo).
 * Full monitoring is available via the spectator view.
 */
export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  useEffect(() => {
    router.replace(`/juego/${code}/jugar`);
  }, [code, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[var(--text-muted)]">Redirigiendo...</p>
    </div>
  );
}
