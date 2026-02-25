import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { TopNav } from "@/components/layout/top-nav";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "Beer Game | Yáneken",
  description: "Simulación de cadena de suministro - El Juego de la Cerveza | Yáneken",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${barlowCondensed.variable} antialiased min-h-screen flex flex-col`}
      >
        <TopNav />
        <main className="flex-1">{children}</main>
        <footer className="mt-auto border-t border-[var(--border-soft)] bg-white/80 px-4 py-3 text-center text-xs text-[var(--text-muted)] backdrop-blur-sm">
          <small>
            Beer Game YNK (Versión 2026.2.1) | Yáneken | Desarrollado por Sebastián
            Gebhardt y Jacques Polette
          </small>
        </footer>
      </body>
    </html>
  );
}
