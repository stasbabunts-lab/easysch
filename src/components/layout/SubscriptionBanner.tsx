import { AlertTriangle } from "lucide-react";

export function SubscriptionBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className={`px-6 py-2.5 flex items-center gap-2 text-sm ${
      daysLeft <= 3
        ? "bg-destructive/10 border-b border-destructive/20 text-destructive"
        : "bg-amber-50 border-b border-amber-200 text-amber-800"
    }`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {daysLeft === 0
          ? "Підписка закінчується сьогодні."
          : `Підписка закінчується через ${daysLeft} ${daysLeft === 1 ? "день" : "днів"}.`}
        {" "}Зверніться до адміністратора для продовження.
      </span>
    </div>
  );
}
