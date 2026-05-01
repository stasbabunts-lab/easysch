import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/payment-offset";
import { StudentActions } from "@/components/students/StudentActions";
import { PriceField, GroupPriceField, NotesField } from "@/components/students/StudentEditableFields";
import { PaymentReminderToggle } from "@/components/students/PaymentReminderToggle";
import { MessageCircle } from "lucide-react";

function fmtDate(d: Date) {
  return d.toLocaleString("uk-UA", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return null;
  const { id } = await params;

  const [student, teacher] = await Promise.all([
    prisma.student.findFirst({
      where: { id, teacherId: session.user.id },
      include: {
        lessons: { orderBy: { scheduledAt: "desc" }, take: 20 },
        payments: { orderBy: { confirmedAt: "desc" } },
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

  const totalPaid = student.payments.reduce((s, p) => s + p.amountReceived, 0);
  const totalOwed = student.paymentRequests
    .filter((r) => r.fulfilledBy === null)
    .reduce((s, r) => s + r.amountTotal, 0);

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
        <StudentActions student={student} hasPaymentDetails={!!teacher?.paymentDetails} />
      </div>

      {/* Notes — full-width editable block */}
      <NotesField studentId={student.id} notes={student.notes} />

      {/* Balance */}
      <div className="grid gap-4 grid-cols-2">
        <Card className="border-border/50">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Оплачено всього</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatAmount(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Очікує оплати</p>
            <p className={`text-2xl font-bold mt-1 ${totalOwed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {formatAmount(totalOwed)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lessons */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Заняття</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {student.lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Занять поки немає</p>
            ) : (
              student.lessons.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm">{fmtDate(l.scheduledAt)}</p>
                    <p className="text-xs text-muted-foreground">{l.durationMin} хв</p>
                  </div>
                  <Badge
                    variant={l.status === "COMPLETED" ? "secondary" : l.status === "CANCELLED" ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {l.status === "SCHEDULED" ? "Заплановано" : l.status === "COMPLETED" ? "Проведено" : "Скасовано"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Payment requests */}
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
