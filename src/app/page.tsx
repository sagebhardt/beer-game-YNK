import Link from "next/link";
import { Beer, Plus, Users, Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#2c02c6]/10 mb-4">
            <Beer className="w-8 h-8 text-[#2c02c6]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Beer Game YNK</h1>
          <p className="mt-2 text-gray-500">
            Simulación de cadena de suministro — El Juego de la Cerveza
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/crear">
            <Card className="hover:border-[#2c02c6]/40 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#2c02c6]/10 mb-2">
                  <Plus className="w-5 h-5 text-[#2c02c6]" />
                </div>
                <CardTitle>Crear Juego</CardTitle>
                <CardDescription>
                  Crea una nueva partida y comparte el código con tu equipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Crear Partida</Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/unirse">
            <Card className="hover:border-[#2c02c6]/40 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#2c02c6]/10 mb-2">
                  <Users className="w-5 h-5 text-[#2c02c6]" />
                </div>
                <CardTitle>Unirse a Juego</CardTitle>
                <CardDescription>
                  Ingresa el código de acceso para unirte a una partida existente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Unirse
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin">
            <Card className="hover:border-[#2c02c6]/40 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#2c02c6]/10 mb-2">
                  <Shield className="w-5 h-5 text-[#2c02c6]" />
                </div>
                <CardTitle>Panel Admin</CardTitle>
                <CardDescription>
                  Monitorea partidas en vivo, analytics y exportación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Administrar
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>
            Simulación del Efecto Látigo en cadenas de suministro con retraso de
            4 semanas
          </p>
        </div>
      </div>
    </div>
  );
}
