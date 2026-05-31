import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/payment-offset";
import { getStudentBalance, GROUP_BILLING_START } from "@/lib/balance";
import { StudentActions } from "@/components/students/StudentActions";
import { PriceField, GroupPriceField, NotesField, PaymentDetailsField } from "@/components/students/StudentEditableFields";
import { PaymentReminderToggle } from "@/components/students/PaymentReminderToggle";
import { MessageCircle } from "lucide-react";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("uk-UA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return null;
  const { id } = await params;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toISOString().slice(11, 16);

  const [student, teacher] = await Promise.all([
    prisma.student.findFirst({
      where: { id, teacherId: session.user.id },
      include: {
        slots: {
          where: {
            isActive: true,
            OR: [
              { date: { lt: today } },
              { date: today, endTime: { lte: currentTime } },
            ],
          },
          select: { id: true, date: true, startTime: true },
          orderBy: { date: "desc" },
        },
        payments: {
          orderBy: { confirmedAt: "desc" },
          select: {
            id: true,
            amountReceived: true,
            confirmedAt: true,
            isIgnored: true,
          },
        },
        paymentRequests: {
          orderBy: { createdAt: "desc" },
          include: { fulfilledBy: { select: { id: true } } },
        },
      },
    }),
    prisma.teacher.findUnique({
      where: { id: session.user.id },
      select: { paymentDetails: true },
    }),
  ]);

  if (!student) notFound();

  // Conducted group lessons (billed since the cutoff) — student.slots only holds
  // individual slots, so fetch group slots separately to list them alongside.
  const groupSlots = await prisma.availabilitySlot.findMany({
    where: {
      isGroup: true,
      isActive: true,
      date: { gte: GROUP_BILLING_START },
      groupStudents: { some: { studentId: id } },
      OR: [
        { date: { lt: today } },
        { date: today, endTime: { lte: currentTime } },
      ],
    },
    select: { id: true, date: true },
    orderBy: { date: "desc" },
  });

  // Real balance calculation (shared helper — counts individual + group lessons)
  const bal = await getStudentBalance(student);
  const conductedCount = bal.conductedCount;
  const totalOwedKopecks = bal.totalOwed;
  const credit = bal.credit;
  const debt = bal.debt;

  // Unified conducted-lessons list (individual + billable group), newest first
  const groupPrice = student.groupLessonPrice ?? student.lessonPrice;
  const conductedLessons = [
    ...student.slots.map((s) => ({ id: s.id, date: s.date, price: student.lessonPrice, isGroup: false })),
    ...groupSlots.map((s) => ({ id: s.id, date: s.date, price: groupPrice, isGroup: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const openRequestsTotal = student.paymentRequests
    .filter((r) => r.fulfilledBy === null)
    .reduce((s, r) => s + r.amountBase, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg md:text-xl shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{student.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <PriceField studentId={student.id} lessonPrice={student.lessonPrice} />
              <GroupPriceField studentId={student.id} groupLessonPrice={student.groupLessonPrice} />
              {student.telegramId && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <MessageCircle className="h-3 w-3" /> Telegram
                </span>
              )}
              <PaymentReminderToggle studentId={student.id} enabled={student.sendPaymentReminder} />
            </div>
          </div>
        </div>
        <StudentActions student={student} hasPaymentDetails={!!student.paymentDetails || !!teacher?.paymentDetails} />
      </div>

      {/* Notes */}
      <NotesField studentId={student.id} notes={student.notes} />

      {/* Individual payment details */}
      <PaymentDetailsField studentId={student.id} paymentDetails={student.paymentDetails} />

      {/* Balance summary — 3 cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Баланс</p>
            {credit > 0 ? (
              <p className="text-2xl font-bold text-emerald-600 mt-1">+{formatAmount(credit)}</p>
            ) : debt > 0 ? (
              <p className="text-2xl font-bold text-destructive mt-1">−{formatAmount(debt)}</p>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground mt-1">0,00</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Проведено занять</p>
            <p className="text-2xl font-bold mt-1">{conductedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Запити оплати</p>
            <p className={`text-2xl font-bold mt-1 ${openRequestsTotal > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              {formatAmount(openRequestsTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Борги — full-width */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Борги (проведені заняття)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {conductedLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-5">Занять ще не проведено</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {conductedLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between px-6 py-2.5 border-b border-border/30 last:border-0">
                  <p className="text-sm flex items-center gap-2">
                    {fmtDate(lesson.date)}
                    {lesson.isGroup && (
                      <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">група</span>
                    )}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{formatAmount(lesson.price)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between px-6 py-2.5 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground">Разом</p>
                <p className="text-sm font-bold tabular-nums">{formatAmount(totalOwedKopecks)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Оплати + Запити оплати */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Оплати */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Оплати</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {student.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-5">Оплат ще немає</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {student.payments.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-6 py-2.5 border-b border-border/30 last:border-0 ${p.isIgnored ? "opacity-50" : ""}`}
                  >
                    <p className={`text-sm text-muted-foreground tabular-nums ${p.isIgnored ? "line-through" : ""}`}>
                      {p.confirmedAt.toLocaleDateString("uk-UA", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      })}
                    </p>
                    <p className={`text-sm font-semibold tabular-nums ${p.isIgnored ? "line-through text-muted-foreground" : "text-emerald-600"}`}>
                      +{formatAmount(p.amountReceived - student.paymentOffset)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Запити оплати */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Запити оплати</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {student.paymentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Запитів немає</p>
            ) : (
              student.paymentRequests.map((r) => (
                <div key={r.id} className="py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-semibold">{formatAmount(r.amountTotal)}</span>
                    <Badge variant={r.fulfilledBy !== null ? "secondary" : "outline"} className="text-xs">
                      {r.fulfilledBy !== null ? "Оплачено" : "Очікує"}
                    </Badge>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  <p className="text-xs text-muted-foreground">{r.createdAt.toLocaleDateString("uk-UA")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
