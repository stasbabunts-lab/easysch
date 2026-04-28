import { prisma } from "./prisma";
export { formatAmount, formatOffset } from "./format";

/**
 * Assigns the lowest available payment offset for a new student.
 * Sequence: 1, 2, ..., 99, 101, 102, ... (100 is skipped to avoid confusion
 * between "1 hryvnia" and "1 hryvnia 1 kopeck" in bank statements).
 *
 * IDs are permanent per student. "Free" means not yet assigned to any student
 * of this teacher.
 */
export async function assignPaymentOffset(teacherId: string): Promise<number> {
  const students = await prisma.student.findMany({
    where: { teacherId },
    select: { paymentOffset: true },
  });
  const used = new Set(students.map((s) => s.paymentOffset));

  for (let i = 1; i <= 99; i++) {
    if (!used.has(i)) return i;
  }
  // 100 is skipped intentionally
  for (let i = 101; i <= 9999; i++) {
    if (!used.has(i)) return i;
  }
  return 10000; // extreme fallback
}

