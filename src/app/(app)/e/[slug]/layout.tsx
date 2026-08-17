import { CompanyGuard } from "@/components/company-guard"

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <CompanyGuard>{children}</CompanyGuard>
}
