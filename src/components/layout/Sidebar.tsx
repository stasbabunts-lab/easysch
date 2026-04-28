"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { APP_NAME, LABELS } from "@/lib/labels";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Layers,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: LABELS.dashboard, icon: LayoutDashboard, exact: true },
  { href: "/dashboard/schedule", label: LABELS.schedule, icon: CalendarDays },
  { href: "/dashboard/students", label: LABELS.students, icon: Users },
  { href: "/dashboard/payments", label: LABELS.payments, icon: CreditCard },
  { href: "/dashboard/settings", label: LABELS.settings, icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] flex-col bg-sidebar shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-[60px] border-b border-sidebar-border">
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Layers className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-[15px] font-semibold text-white tracking-tight">{APP_NAME}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-all duration-150",
                active
                  ? "bg-white/[0.11] text-white"
                  : "text-sidebar-foreground hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-sidebar-foreground hover:bg-white/[0.06] hover:text-white transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Вийти
        </button>
      </div>
    </aside>
  );
}
