import { redirect } from "next/navigation"

export default function Home() {
  // La home real es el grid de empresas. El login entra acá cuando haya Supabase.
  redirect("/empresas")
}
