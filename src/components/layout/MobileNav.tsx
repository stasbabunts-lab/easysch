"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarDays, Users, CreditCard, Settings } from "lucide-react";
import { LABELS } from "@/lib/labels";

const NAV = [
  { href: "/dashboard", label: LABELS.dashboard, icon: LayoutDashboard, exact: true },
  { href: "/dashboard/schedule", label: LABELS.schedule, icon: CalendarDays },
  { href: "/dashboard/students", label: LABELS.students, icon: Users },
  { href: "/dashboard/payments", label: LABELS.payments, icon: CreditCard },
  { href: "/dashboard/settings", label: LABELS.settings, icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
      <div className="flex items-stretch h-14">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-white" : "text-sidebar-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-sidebar-foreground")} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
