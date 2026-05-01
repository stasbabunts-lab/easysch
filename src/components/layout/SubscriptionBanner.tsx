import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function SubscriptionBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className={`px-6 py-2.5 flex items-center justify-between gap-3 text-sm ${
      daysLeft <= 3
        ? "bg-destructive/10 border-b border-destructive/20 text-destructive"
        : "bg-amber-50 border-b border-amber-200 text-amber-800"
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {daysLeft === 0
            ? "Підписка закінчується сьогодні."
            : `Підписка закінчується через ${daysLeft} ${daysLeft === 1 ? "день" : "днів"}.`}
        </span>
      </div>
      <Link
        href="/subscribe"
        className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
          daysLeft <= 3
            ? "bg-destructive text-white hover:bg-destructive/90"
            : "bg-amber-500 text-white hover:bg-amber-600"
        }`}
      >
        Продовжити
      </Link>
    </div>
  );
}
