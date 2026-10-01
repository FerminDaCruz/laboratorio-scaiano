import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Laboratorio Scaiano",
  description: "Gestión de órdenes de trabajo, remitos y cuentas corrientes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
