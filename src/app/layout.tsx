import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { TopNav } from "@/components/layout/top-nav";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Beer Game YNK",
  description: "Simulación de cadena de suministro - El Juego de la Cerveza",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} antialiased min-h-screen flex flex-col`}
      >
        <TopNav />
        <main className="flex-1">{children}</main>
        <footer className="mt-auto border-t border-[var(--border-soft)] bg-white/80 px-4 py-3 text-center text-xs text-[var(--text-muted)] backdrop-blur-sm">
          <small>
            Beer Game App (Versión 2026.2.1) | Yáneken | Desarrollado por Sebastián
            Gebhardt y Jacques Polette
          </small>
        </footer>
      </body>
    </html>
  );
}
