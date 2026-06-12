import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AddStudentDialog } from "@/components/students/AddStudentDialog";
import { InlinePriceEdit } from "@/components/students/InlinePriceEdit";
import { ChevronRight, MessageCircle, MessageCircleOff } from "lucide-react";
import { formatOffset } from "@/lib/format";
import { StudentCodeBadge } from "@/components/students/StudentCodeBadge";
import { StudentInviteButton } from "@/components/students/StudentInvite";
import { PaymentReminderToggle } from "@/components/students/PaymentReminderToggle";
import { StudentSearch } from "@/components/students/StudentSearch";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const { q } = await searchParams;

  const students = await prisma.student.findMany({
    where: {
      teacherId: session.user.id,
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { lessons: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Клієнти</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {students.length} {q ? "знайдено" : "клієнтів"}
          </p>
        </div>
        <AddStudentDialog />
      </div>

      <StudentSearch defaultValue={q} />

      <p className="text-xs text-muted-foreground -mt-2">
        ID неактивних клієнтів звільняється і може бути присвоєно новим.
      </p>

      {students.length === 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            {q ? (
              <>
                <p>Нічого не знайдено за запитом «{q}».</p>
                <p className="text-sm mt-1">Спробуйте інший пошук.</p>
              </>
            ) : (
              <>
                <p>Клієнтів поки немає.</p>
                <p className="text-sm mt-1">Натисніть «Додати клієнта» щоб почати.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {students.map((s) => (
            <Link key={s.id} href={`/dashboard/students/${s.id}`}>
              <Card className="border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* ID badge */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest leading-none">id</span>
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{formatOffset(s.paymentOffset)}</span>
                      </div>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <InlinePriceEdit studentId={s.id} lessonPrice={s.lessonPrice} />
                        <span className="text-xs text-muted-foreground/50">·</span>
                        <span className="text-xs text-muted-foreground">{s._count.lessons} занять</span>
                      </div>
                      <div className="mt-1.5">
                        <PaymentReminderToggle studentId={s.id} enabled={s.sendPaymentReminder} />
                      </div>
                    </div>

                    {/* Right column */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <StudentInviteButton name={s.name} code={s.code} />
                        <StudentCodeBadge code={s.code} />
                      </div>
                      {s.telegramId ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                          <MessageCircle className="h-3 w-3 shrink-0" />
                          Telegram підключено
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                          <MessageCircleOff className="h-3 w-3 shrink-0" />
                          Не підключено
                        </span>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
