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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);          // "YYYY-MM-DD" UTC
  const currentTime = now.toISOString().slice(11, 16);  // "HH:MM" UTC

  // "Active" = student has a slot in the last 60 days / future, OR has at least one payment
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const thirtyDaysAgoStr = sixtyDaysAgo.toISOString().slice(0, 10);

  const students = await prisma.student.findMany({
    where: {
      teacherId,
      OR: [
        {
          slots: {
            some: {
              isActive: true,
              date: { gte: thirtyDaysAgoStr },
            },
          },
        },
        {
          payments: { some: {} },
        },
      ],
    },
    include: {
      // Conducted slots: past days + today's slots whose startTime has already passed
      slots: {
        where: {
          isActive: true,
          OR: [
            { date: { lt: today } },
            { date: today, startTime: { lte: currentTime } },
          ],
        },
        select: { id: true, date: true },
        orderBy: { date: "desc" },
      },
      // All non-ignored payments received from this student
      payments: {
        where: { isIgnored: false },
        select: { amountReceived: true },
      },
    },
    orderBy: { createdAt: "asc" }, // stable fallback
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

    // Most recent conducted slot date (slots are already ordered desc)
    const lastSlotDate = s.slots[0]?.date ?? null;

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
      lastSlotDate,
    };
  });

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
    amountReal: p.student
      ? p.amountReceived - p.student.paymentOffset
      : p.amountReceived,
    confirmedAt: p.confirmedAt,
    source: p.source,
    isIgnored: p.isIgnored,
  }));

  return NextResponse.json({ clients, transactions });
}
