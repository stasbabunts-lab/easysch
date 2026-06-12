import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/payment-offset";
import { CalendarDays, Users, CreditCard, TrendingUp, Clock, Bell } from "lucide-react";
import { LABELS } from "@/lib/labels";
import Link from "next/link";
import { NotificationLog } from "@/components/dashboard/NotificationLog";

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

function daysLabel(n: number) {
  const abs = Math.abs(n);
  if (abs % 10 === 1 && abs % 100 !== 11) return "день";
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return "дні";
  return "днів";
}

function SubscriptionPill({ expiresAt }: { expiresAt: Date | null }) {
  if (!expiresAt) return null;

  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const expired = daysLeft <= 0;

  const expiryStr = expiresAt.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let cls = "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";
  if (expired || daysLeft <= 3) {
    cls = "bg-red-50 border-red-200 text-red-700 hover:bg-red-100";
  } else if (daysLeft <= 7) {
    cls = "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100";
  }

  return (
    <Link
      href="/subscribe"
      title={expired ? "Підписка закінчилась" : `Підписка активна до ${expiryStr}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${cls}`}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {expired ? "Підписка закінчилась" : `${daysLeft} ${daysLabel(daysLeft)}`}
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const teacherId = session.user.id;
  const now = new Date();

  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toISOString().slice(11, 16);

  const [teacher, upcomingLessons, studentCount, studentsForDebt, recentPayments, recentNotifs] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { subscriptionExpiresAt: true },
    }),
    prisma.lesson.findMany({
      where: { teacherId, scheduledAt: { gte: now }, status: { not: "CANCELLED" } },
      include: { student: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.student.count({ where: { teacherId } }),
    prisma.student.findMany({
      where: { teacherId },
      select: {
        lessonPrice: true,
        paymentOffset: true,
        balanceAdjustmentKopecks: true,
        slots: {
          where: {
            isActive: true,
            OR: [{ date: { lt: today } }, { date: today, startTime: { lte: currentTime } }],
          },
          select: { id: true },
        },
        payments: {
          where: { isIgnored: false },
          select: { amountReceived: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: { teacherId },
      include: { student: { select: { name: true } } },
      orderBy: { confirmedAt: "desc" },
      take: 5,
    }),
    prisma.notificationLog.findMany({
      where: { teacherId },
      orderBy: { sentAt: "desc" },
      take: 20,
    }),
  ]);

  const totalDebt = studentsForDebt.reduce((sum, s) => {
    const totalOwed = s.slots.length * s.lessonPrice;
    const totalPaid = s.payments.reduce((p, pay) => p + pay.amountReceived - s.paymentOffset, 0);
    const effectiveBalance = totalPaid - totalOwed + s.balanceAdjustmentKopecks;
    return sum + (effectiveBalance < 0 ? -effectiveBalance : 0);
  }, 0);

  const todayLessons = upcomingLessons.filter(
    (l) => l.scheduledAt.toDateString() === now.toDateString()
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <div className="flex items-center gap-2 shrink-0">
          <SubscriptionPill expiresAt={teacher?.subscriptionExpiresAt ?? null} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label={LABELS.students} value={studentCount} icon={Users} color="text-violet-600" iconBg="bg-violet-50" />
        <StatCard label="Занять сьогодні" value={todayLessons} icon={CalendarDays} color="text-blue-600" iconBg="bg-blue-50" />
        <StatCard label="Очікує оплат" value={formatAmount(totalDebt)} icon={CreditCard} color="text-amber-600" iconBg="bg-amber-50" />
        <StatCard label="Найближчий клієнт" value={upcomingLessons[0]?.student.name.split(" ")[0] ?? "—"} icon={TrendingUp} color="text-emerald-600" iconBg="bg-emerald-50" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Найближчі заняття</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Немає запланованих занять</p>
            ) : (
              <div className="space-y-1">
                {upcomingLessons.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2.5 px-1 border-b border-border/40 last:border-0">
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

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Останні оплати</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Оплат поки немає</p>
            ) : (
              <div className="space-y-1">
                {recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 px-1 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold text-xs shrink-0">
                        {p.student?.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.student?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.confirmedAt.toLocaleDateString("uk-UA")}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 shrink-0 ml-2">+{formatAmount(p.amountReceived)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification log */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Сповіщення учням
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <NotificationLog notifs={recentNotifs.map((n) => ({ ...n, sentAt: n.sentAt.toISOString() }))} />
        </CardContent>
      </Card>
    </div>
  );
}
