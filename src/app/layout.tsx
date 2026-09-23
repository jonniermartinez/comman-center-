import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { APP_NAME } from "@/lib/branding"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { THEME_INIT_SCRIPT } from "@/lib/theme"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Gestión comercial, formularios de captura diaria y dashboards de KPIs por empresa cliente.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      data-theme="light"
      // El script de abajo cambia `data-theme` antes de que React hidrate;
      // sin esto React lo tomaría como desajuste y volvería a renderizar.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Corre durante el parseo, antes del primer pintado: así una persona
            con tema oscuro guardado no ve un destello blanco al recargar. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
