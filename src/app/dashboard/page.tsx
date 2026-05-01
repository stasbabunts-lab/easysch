import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/payment-offset";
import { CalendarDays, Users, CreditCard, TrendingUp, Clock, ChevronDown, Bell } from "lucide-react";
import { LABELS } from "@/lib/labels";
import Link from "next/link";
import type { NotifType } from "@/lib/bot/notification-log";

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

function formatNotifTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "щойно";
  if (diffMin < 60) return `${diffMin} хв тому`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} год тому`;
  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
}

const NOTIF_META: Record<NotifType, { label: string; cls: string }> = {
  lesson_reminder:   { label: "Нагадування урок",   cls: "bg-blue-50 text-blue-700" },
  payment_reminder:  { label: "Нагадування оплата",  cls: "bg-amber-50 text-amber-700" },
  payment_confirmed: { label: "Оплату підтверджено", cls: "bg-emerald-50 text-emerald-700" },
  payment_request:   { label: "Запит оплати",        cls: "bg-violet-50 text-violet-700" },
};

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

function SubscriptionBanner({ expiresAt }: { expiresAt: Date | null }) {
  if (!expiresAt) return null;

  const now = new Date();
  const msLeft = expiresAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const expired = daysLeft <= 0;

  const expiryStr = expiresAt.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let bg = "bg-emerald-50 border-emerald-200";
  let textColor = "text-emerald-700";
  let badgeCls = "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
  let label = `Підписка активна, ${daysLeft} ${daysLabel(daysLeft)}`;

  if (expired) {
    bg = "bg-red-50 border-red-200";
    textColor = "text-red-700";
    badgeCls = "bg-red-600 text-white hover:bg-red-700";
    label = "Підписка закінчилась";
  } else if (daysLeft <= 3) {
    bg = "bg-red-50 border-red-200";
    textColor = "text-red-700";
    badgeCls = "bg-red-600 text-white hover:bg-red-700";
    label = `Залишилось ${daysLeft} ${daysLabel(daysLeft)}`;
  } else if (daysLeft <= 7) {
    bg = "bg-amber-50 border-amber-200";
    textColor = "text-amber-700";
    badgeCls = "bg-amber-500 text-white hover:bg-amber-600";
    label = `Залишилось ${daysLeft} ${daysLabel(daysLeft)}`;
  }

  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${bg}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Clock className={`h-4 w-4 shrink-0 ${textColor}`} />
        <div className="min-w-0">
          <span className={`text-sm font-medium ${textColor}`}>{label}</span>
          {!expired && (
            <span className="text-xs text-muted-foreground ml-2">до {expiryStr}</span>
          )}
        </div>
      </div>
      <Link
        href="/subscribe"
        className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${badgeCls}`}
      >
        Продовжити
      </Link>
    </div>
  );
}

function GettingStarted() {
  return (
    <details className="group rounded-xl border border-border/60 bg-card shadow-sm">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span>🚀</span>
          Як розпочати роботу
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/50 px-4 py-5">
        <ol className="space-y-5 text-sm">

          {/* 1 */}
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">1</span>
            <div className="min-w-0">
              <Link href="/dashboard/settings" className="font-medium text-foreground hover:text-primary transition-colors">
                Підключіть Telegram бот
              </Link>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                У «Налаштування» знайдіть ваш персональний код і надішліть команду{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">/start КОД</code> боту{" "}
                <Link href="https://t.me/EasySchBot" target="_blank" className="text-primary hover:underline">@EasySchBot</Link>.
                Після цього ви отримуватимете сповіщення про оплати та нагадування про заняття.
                Клієнти підключаються так само — кожен отримує свій особистий код на сторінці «Клієнти».
              </p>
            </div>
          </li>

          {/* 2 */}
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">2</span>
            <div className="min-w-0">
              <Link href="/dashboard/settings" className="font-medium text-foreground hover:text-primary transition-colors">
                Налаштуйте API банку
              </Link>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                У «Налаштування» додайте токен вашого банку.
                Система автоматично перевіряє вхідні транзакції кожні 5 хвилин.{" "}
                <span className="font-medium text-foreground">Як розпізнається платіж:</span>{" "}
                кожен клієнт має унікальний ідентифікатор у копійках (наприклад, 03).
                Клієнт платить рівно <span className="font-medium text-foreground">суму + ці копійки</span> — система знаходить платіж за «хвостиком» і автоматично зараховує потрібному клієнту.
              </p>
            </div>
          </li>

          {/* 3 */}
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">3</span>
            <div className="min-w-0">
              <Link href="/dashboard/payments" className="font-medium text-foreground hover:text-primary transition-colors">
                Заповніть реквізити для оплати
              </Link>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                На сторінці «Оплати» вкажіть номер картки або IBAN.
                Ці реквізити автоматично надсилаються клієнту в Telegram після кожного заняття та коли ви створюєте запит на оплату.
              </p>
            </div>
          </li>

          {/* 4 */}
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-0.5">4</span>
            <div className="min-w-0">
              <Link href="/dashboard/students" className="font-medium text-foreground hover:text-primary transition-colors">
                Додавайте клієнтів і заняття
              </Link>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                У «Клієнти» додайте учнів і вкажіть ціну заняття.
                У «Розклад» створюйте слоти часу — поки слот не призначено клієнту, він відображається як{" "}
                <span className="font-medium text-foreground">вільний час</span> на публічній сторінці розкладу.
                Після призначення клієнту слот стає заняттям і зникає з публічного вигляду.
              </p>
            </div>
          </li>

        </ol>
      </div>
    </details>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const teacherId = session.user.id;
  const now = new Date();

  const [teacher, upcomingLessons, studentCount, pendingPayments, recentPayments, recentNotifs] = await Promise.all([
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
    prisma.paymentRequest.aggregate({
      where: { student: { teacherId }, fulfilledBy: null },
      _sum: { amountBase: true },
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

  const todayLessons = upcomingLessons.filter(
    (l) => l.scheduledAt.toDateString() === now.toDateString()
  ).length;

  return (
    <div className="space-y-6">
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

      <SubscriptionBanner expiresAt={teacher?.subscriptionExpiresAt ?? null} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label={LABELS.students} value={studentCount} icon={Users} color="text-violet-600" iconBg="bg-violet-50" />
        <StatCard label="Занять сьогодні" value={todayLessons} icon={CalendarDays} color="text-blue-600" iconBg="bg-blue-50" />
        <StatCard label="Очікує оплат" value={formatAmount(pendingPayments._sum.amountBase ?? 0)} icon={CreditCard} color="text-amber-600" iconBg="bg-amber-50" />
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
          {recentNotifs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Сповіщення поки не надсилались
            </p>
          ) : (
            <div className="space-y-0">
              {recentNotifs.map((n) => {
                const meta = NOTIF_META[n.type as NotifType] ?? { label: n.type, cls: "bg-muted text-muted-foreground" };
                return (
                  <div key={n.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0 mt-0.5">
                        {n.studentName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{n.studentName}</span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.text}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                      {formatNotifTime(n.sentAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GettingStarted />
    </div>
  );
}
