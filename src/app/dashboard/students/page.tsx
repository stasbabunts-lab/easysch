import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddStudentDialog } from "@/components/students/AddStudentDialog";
import { InlinePriceEdit } from "@/components/students/InlinePriceEdit";
import { formatAmount } from "@/lib/payment-offset";
import { ChevronRight, MessageCircle } from "lucide-react";
import { StudentCodeBadge } from "@/components/students/StudentCodeBadge";

export default async function StudentsPage() {
  const session = await auth();
  if (!session) return null;

  const students = await prisma.student.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { lessons: true } },
      payments: { select: { amountReceived: true } },
      paymentRequests: { where: { fulfilledBy: null }, select: { amountTotal: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Клієнти</h1>
          <p className="text-muted-foreground text-sm mt-1">{students.length} клієнтів</p>
        </div>
        <AddStudentDialog />
      </div>

      {students.length === 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Клієнтів поки немає.</p>
            <p className="text-sm mt-1">Натисніть «Додати клієнта» щоб почати.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {students.map((s) => {
            const totalPaid = s.payments.reduce((sum, p) => sum + p.amountReceived, 0);
            const totalOwed = s.paymentRequests.reduce((sum, r) => sum + r.amountTotal, 0);
            return (
              <Link key={s.id} href={`/dashboard/students/${s.id}`}>
                <Card className="border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{s.name}</p>
                          {s.telegramId && (
                            <span title="Прив'язано до Telegram">
                              <MessageCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {/* Inline price edit */}
                          <InlinePriceEdit studentId={s.id} lessonPrice={s.lessonPrice} />
                          <span className="text-xs text-muted-foreground/50">·</span>
                          <span className="text-xs text-muted-foreground">{s._count.lessons} занять</span>
                        </div>
                      </div>

                      {/* Personal code badge */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <StudentCodeBadge code={s.code} />
                        {totalOwed > 0 ? (
                          <Badge variant="destructive" className="text-[11px]">
                            Борг {formatAmount(totalOwed)}
                          </Badge>
                        ) : totalPaid > 0 ? (
                          <Badge variant="secondary" className="text-[11px] text-emerald-600">
                            {formatAmount(totalPaid)}
                          </Badge>
                        ) : null}
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
