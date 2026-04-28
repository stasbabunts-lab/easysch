import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/payment-offset";
import { CalendarDays, Users, CreditCard, TrendingUp } from "lucide-react";
import { LABELS } from "@/lib/labels";

function formatDateTime(date: Date) {
  return date.toLocaleString("uk-UA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  iconBg: string;
}

function StatCard({ label, value, icon: Icon, color, iconBg }: StatCardProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1.5 ${color}`}>{value}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const teacherId = session.user.id;
  const now = new Date();

  const [upcomingLessons, studentCount, pendingPayments, recentPayments] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId, scheduledAt: { gte: now }, status: { not: "CANCELLED" } },
      include: { student: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.student.count({ where: { teacherId } }),
    prisma.paymentRequest.aggregate({
      where: { student: { teacherId }, fulfilledBy: null },
      _sum: { amountTotal: true },
    }),
    prisma.payment.findMany({
      where: { teacherId },
      include: { student: { select: { name: true } } },
      orderBy: { confirmedAt: "desc" },
      take: 5,
    }),
  ]);

  const todayLessons = upcomingLessons.filter(
    (l) => l.scheduledAt.toDateString() === now.toDateString()
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Вітаємо, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Код для клієнтів:{" "}
          <span className="font-mono font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded text-xs">
            {session.user.teacherCode}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={LABELS.students}
          value={studentCount}
          icon={Users}
          color="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          label="Занять сьогодні"
          value={todayLessons}
          icon={CalendarDays}
          color="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Очікує оплат"
          value={formatAmount(pendingPayments._sum.amountTotal ?? 0)}
          icon={CreditCard}
          color="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Найближчий клієнт"
          value={upcomingLessons[0]?.student.name.split(" ")[0] ?? "—"}
          icon={TrendingUp}
          color="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming lessons */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Найближчі заняття
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Немає запланованих занять</p>
            ) : (
              <div className="space-y-1">
                {upcomingLessons.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between py-2.5 px-1 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                        {l.student.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{l.student.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(l.scheduledAt)}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">{l.durationMin} хв</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent payments */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Останні оплати
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Оплат поки немає</p>
            ) : (
              <div className="space-y-1">
                {recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2.5 px-1 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold text-xs shrink-0">
                        {p.student?.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.student?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.confirmedAt.toLocaleDateString("uk-UA")}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">
                      +{formatAmount(p.amountReceived)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
