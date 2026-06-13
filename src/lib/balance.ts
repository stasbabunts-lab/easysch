import { prisma } from "./prisma";
import { kyivToday, kyivCurrentTime } from "./time";

/**
 * Group lessons only count toward a student's debt from this date onward.
 *
 * Historically group lessons were never billed (a bug: balance code only ever
 * looked at AvailabilitySlot.studentId, which is null for group slots). Fixing
 * it retroactively would suddenly surface large debts for every group student,
 * so we bill group lessons only from this cutoff forward. Individual lessons are
 * billed for the whole history as before.
 */
export const GROUP_BILLING_START = "2026-06-01";

export interface BillingStudent {
  id: string;
  paymentOffset: number;
  lessonPrice: number;
  groupLessonPrice: number | null;
  balanceAdjustmentKopecks: number;
}

export interface StudentBalance {
  individualConducted: number;
  groupConducted: number;
  /** individual (all history) + group (billable, since cutoff) */
  conductedCount: number;
  totalOwed: number;
  totalPaid: number;
  computedBalance: number;
  effectiveBalance: number;
  credit: number;
  debt: number;
  /** most recent conducted lesson date (individual or group), for sorting */
  lastConductedDate: string | null;
}

/**
 * Single source of truth for a student's balance. Counts conducted individual
 * slots (priced at lessonPrice, full history) plus conducted group slots since
 * GROUP_BILLING_START (priced at groupLessonPrice, falling back to lessonPrice).
 */
export async function getStudentBalance(s: BillingStudent): Promise<StudentBalance> {
  const today = kyivToday();
  const currentTime = kyivCurrentTime();
  // "Conducted" = a past day, or today with the slot already ended.
  const conducted = {
    OR: [
      { date: { lt: today } },
      { date: today, endTime: { lte: currentTime } },
    ],
  };

  const [indAgg, groupBillable, grpAgg, payments] = await Promise.all([
    // Individual conducted slots (whole history)
    prisma.availabilitySlot.aggregate({
      where: { studentId: s.id, isGroup: false, isActive: true, ...conducted },
      _count: true,
      _max: { date: true },
    }),
    // Group conducted slots since the billing cutoff (these are billed)
    prisma.availabilitySlot.count({
      where: {
        isGroup: true,
        isActive: true,
        date: { gte: GROUP_BILLING_START },
        groupStudents: { some: { studentId: s.id } },
        ...conducted,
      },
    }),
    // Most recent group lesson regardless of cutoff (for "last activity" sorting)
    prisma.availabilitySlot.aggregate({
      where: {
        isGroup: true,
        isActive: true,
        groupStudents: { some: { studentId: s.id } },
        ...conducted,
      },
      _max: { date: true },
    }),
    prisma.payment.findMany({
      where: { studentId: s.id, isIgnored: false },
      select: { amountReceived: true, source: true },
    }),
  ]);

  const individualConducted = indAgg._count;
  const groupConducted = groupBillable;
  const groupPrice = s.groupLessonPrice ?? s.lessonPrice;
  const totalOwed = individualConducted * s.lessonPrice + groupConducted * groupPrice;
  // Bank payments include the student's offset kopecks (the identifier) — strip it.
  // Manual payments are entered by the teacher as the real amount and are
  // authoritative, so they count in full.
  const totalPaid = payments.reduce(
    (sum, p) => sum + p.amountReceived - (p.source === "manual" ? 0 : s.paymentOffset),
    0
  );
  const computedBalance = totalPaid - totalOwed;
  const effectiveBalance = computedBalance + s.balanceAdjustmentKopecks;

  const dates = [indAgg._max.date, grpAgg._max.date].filter((d): d is string => !!d);
  const lastConductedDate = dates.length ? dates.sort().at(-1)! : null;

  return {
    individualConducted,
    groupConducted,
    conductedCount: individualConducted + groupConducted,
    totalOwed,
    totalPaid,
    computedBalance,
    effectiveBalance,
    credit: effectiveBalance > 0 ? effectiveBalance : 0,
    debt: effectiveBalance < 0 ? -effectiveBalance : 0,
    lastConductedDate,
  };
}
