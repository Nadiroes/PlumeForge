import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlumeForge — Studio d'écriture IA",
  description: "Générateur de livres multi-agents : roman, essai, scénario, théâtre, sketch, dialogue. Interface type Word, agents conversationnels apprenants, prêt-à-imprimer, mode hors-ligne.",
  keywords: ["générateur de livre", "écriture IA", "agents", "Mistral", "Agnes AI", "Ollama", "Tiptap", "édition"],
  authors: [{ name: "PlumeForge" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android : le clavier redimensionne le layout au lieu de recouvrir (chat + éditeur)
  interactiveWidget: "resizes-content",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
