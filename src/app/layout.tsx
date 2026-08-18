import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { APP_NAME, OPERATOR_NAME } from "@/lib/branding"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
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
  title: `${APP_NAME} · ${OPERATOR_NAME}`,
  description:
    "Gestión comercial, formularios de captura diaria y dashboards de KPIs por empresa cliente.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
