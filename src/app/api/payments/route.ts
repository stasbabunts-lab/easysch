import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatOffset } from "@/lib/payment-offset";
import { getStudentBalance } from "@/lib/balance";

// GET /api/payments
// Returns { clients: ActiveClient[], transactions: TxItem[] }
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teacherId = session.user.id;

  // "Active" = student has an individual OR group slot in the last 60 days / future,
  // OR has at least one payment.
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().slice(0, 10);

  const students = await prisma.student.findMany({
    where: {
      teacherId,
      OR: [
        { slots: { some: { isActive: true, date: { gte: sixtyDaysAgoStr } } } },
        { groupSlots: { some: { slot: { isActive: true, date: { gte: sixtyDaysAgoStr } } } } },
        { payments: { some: {} } },
      ],
    },
    include: {
      paymentRequests: {
        where: { fulfilledBy: null },
        select: { amountBase: true },
      },
    },
    orderBy: { createdAt: "asc" }, // stable fallback
  });

  const clients = await Promise.all(
    students.map(async (s) => {
      const bal = await getStudentBalance(s);
      return {
        id: s.id,
        name: s.name,
        offset: s.paymentOffset,
        offsetFormatted: formatOffset(s.paymentOffset),
        lessonPrice: s.lessonPrice,
        conductedCount: bal.conductedCount,
        totalOwed: bal.totalOwed,
        totalPaid: bal.totalPaid,
        computedBalance: bal.computedBalance,
        balanceAdjustmentKopecks: s.balanceAdjustmentKopecks,
        credit: bal.credit,
        debt: bal.debt,
        lastSlotDate: bal.lastConductedDate,
        openRequestCount: s.paymentRequests.length,
        openRequestTotal: s.paymentRequests.reduce((sum, r) => sum + r.amountBase, 0),
      };
    })
  );

  // Sort by most recent conducted lesson descending; clients with no lessons go last
  clients.sort((a, b) => {
    if (!a.lastSlotDate && !b.lastSlotDate) return 0;
    if (!a.lastSlotDate) return 1;
    if (!b.lastSlotDate) return -1;
    return b.lastSlotDate.localeCompare(a.lastSlotDate);
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
    amountReal: p.student && p.source !== "manual"
      ? p.amountReceived - p.student.paymentOffset
      : p.amountReceived,
    confirmedAt: p.confirmedAt,
    source: p.source,
    isIgnored: p.isIgnored,
  }));

  return NextResponse.json({ clients, transactions });
}
