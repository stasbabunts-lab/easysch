import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatOffset } from "@/lib/payment-offset";

// GET /api/payments
// Returns { clients: ActiveClient[], transactions: TxItem[] }
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacherId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  // "Active" = student has at least one slot within the last 60 days OR in the future
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 60);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const students = await prisma.student.findMany({
    where: {
      teacherId,
      slots: {
        some: {
          isActive: true,
          date: { gte: thirtyDaysAgoStr },
        },
      },
    },
    include: {
      // Past slots assigned to this student (= conducted lessons count)
      slots: {
        where: { isActive: true, date: { lte: today } },
        select: { id: true },
      },
      // All non-ignored payments received from this student
      payments: {
        where: { isIgnored: false },
        select: { amountReceived: true },
      },
    },
    orderBy: { paymentOffset: "asc" },
  });

  const clients = students.map((s) => {
    const conductedCount = s.slots.length;
    const totalOwed = conductedCount * s.lessonPrice;

    // Strip identification kopecks from each payment before summing
    const totalPaid = s.payments.reduce(
      (sum, p) => sum + p.amountReceived - s.paymentOffset,
      0
    );

    // Apply manual adjustment (balanceAdjustmentKopecks is stored as correction to computed balance)
    const computedBalance = totalPaid - totalOwed;
    const effectiveBalance = computedBalance + s.balanceAdjustmentKopecks;

    return {
      id: s.id,
      name: s.name,
      offset: s.paymentOffset,
      offsetFormatted: formatOffset(s.paymentOffset),
      lessonPrice: s.lessonPrice,
      conductedCount,
      totalOwed,
      totalPaid,
      computedBalance,
      balanceAdjustmentKopecks: s.balanceAdjustmentKopecks,
      credit: effectiveBalance > 0 ? effectiveBalance : 0,
      debt: effectiveBalance < 0 ? -effectiveBalance : 0,
    };
  });

  // Transaction history — all payments including ignored ones
  const payments = await prisma.payment.findMany({
    where: { teacherId },
    include: { student: { select: { name: true, paymentOffset: true } } },
    orderBy: { confirmedAt: "desc" },
    take: 100,
  });

  const transactions = payments.map((p) => ({
    id: p.id,
    studentName: p.student?.name ?? "—",
    amountReceived: p.amountReceived,
    amountReal: p.student
      ? p.amountReceived - p.student.paymentOffset
      : p.amountReceived,
    confirmedAt: p.confirmedAt,
    source: p.source,
    isIgnored: p.isIgnored,
  }));

  return NextResponse.json({ clients, transactions });
}
