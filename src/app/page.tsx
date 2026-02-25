import Link from "next/link";
import { Beer, Plus, Users, Shield, ArrowRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";

const actions = [
  {
    href: "/crear",
    title: "Crear juego",
    description: "Configura la sesión y comparte el código con tu equipo.",
    icon: Plus,
    cta: "Configurar juego",
  },
  {
    href: "/unirse",
    title: "Unirse por código",
    description: "Ingresa tu nombre, código y toma tu lugar en la cadena.",
    icon: Users,
    cta: "Entrar a sala",
  },
  {
    href: "/admin",
    title: "Panel admin",
    description: "Monitorea partidas, exporta datos y controla sesiones activas.",
    icon: Shield,
    cta: "Abrir admin",
  },
];

export default function HomePage() {
  return (
    <PageShell
      title="Beer Game YNK"
      subtitle="Simulación de cadena de suministro para visualizar decisiones, retrasos y efecto látigo."
      rightSlot={
        <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-body)]">
          <Beer className="h-4 w-4 text-[var(--accent)]" />
          Versión académica 2026.2.1
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="block h-full">
              <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-26px_rgba(0,40,120,0.65)]">
                <CardHeader>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-light)]">
                    <Icon className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <CardTitle>{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full justify-between">
                    {action.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-[var(--border-soft)] bg-white p-4 text-sm text-[var(--text-muted)]">
        Cada ronda simula una semana con retraso logístico. Tu objetivo es mantener inventario saludable y backlog controlado.
      </div>
    </PageShell>
  );
}
