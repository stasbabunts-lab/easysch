import { isAdminAuthenticated } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Login page is always accessible
  return <>{children}</>;
}

// Middleware-like check is done per-page for the main admin page
export { isAdminAuthenticated };
