import { prisma } from "./prisma";
import { getBankAdapter } from "./bank";
import { MockBankAdapter } from "./bank/mock-adapter";
import { extendExpiringSeries } from "./recurring";
import {
  sendPaymentConfirmation,
  sendTeacherPaymentNotification,
  sendPostLessonPaymentReminder,
  sendStudentLessonReminder,
  sendTeacherLessonReminder,
} from "./bot/reminders";
import { logNotification } from "./bot/notification-log";
import { formatAmount } from "./payment-offset";

export async function pollPayments(teacherId: string): Promise<number> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      lastPolledAt: true,
      teacherReminderMinutes: true,
      studentReminderMinutes: true,
      telegramChatId: true,
      name: true,
      paymentDetails: true,
      postLessonNote: true,
    },
  });
  if (!teacher) return 0;

  const since = teacher.lastPolledAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── Payment matching — all active bank accounts ───────────────────
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { teacherId, isActive: true },
  });

  // If no real bank accounts configured, fall back to mock (dev mode)
  const adapters =
    bankAccounts.length > 0
      ? bankAccounts.map((acc) => {
          try {
            return getBankAdapter(acc.bankType, acc.creds);
          } catch {
            return null; // skip mis-configured accounts silently
          }
        }).filter(Boolean)
      : [new MockBankAdapter()];

  // Collect all transactions from all adapters, dedup by id
  const seen = new Set<string>();
  const allTransactions = [];
  for (const adapter of adapters) {
    try {
      const txs = await adapter!.getIncomingTransactions(since);
      for (const tx of txs) {
        if (!seen.has(tx.id)) {
          seen.add(tx.id);
          allTransactions.push(tx);
        }
      }
    } catch {
      // One failing adapter should not block others
    }
  }

  // Pre-load all students for this teacher (for offset matching)
  const teacherStudents = await prisma.student.findMany({
    where: { teacherId },
    select: { id: true, paymentOffset: true, telegramId: true, name: true, lessonPrice: true, groupLessonPrice: true },
  });

  let matched = 0;
  for (const tx of allTransactions) {
    const exists = await prisma.payment.findUnique({ where: { bankTxId: tx.id } });
    if (exists) continue;

    // Two-tier offset matching:
    //   Small amounts < 1000 kopecks (< 10 UAH): use last 2 digits → % 100
    //     e.g. 1.03 UAH = 103 kop → 103 % 100 = 3 → student 03
    //   Large amounts ≥ 1000 kopecks (≥ 10 UAH): use last 3 digits → % 1000
    //     e.g. 800.03 UAH → 80003 % 1000 = 3 → student 03
    //     e.g. 801.03 UAH → 80103 % 1000 = 103 → student 103 (no conflict!)
    const offsetValue = tx.amount < 1000
      ? tx.amount % 100
      : tx.amount % 1000;
    if (offsetValue === 0) continue; // round amount — can't identify student

    const student = teacherStudents.find((s) => s.paymentOffset === offsetValue);
    if (!student) continue;

    // Accept only exact amounts: open PaymentRequest match OR a lesson-price multiple
    const exactRequest = await prisma.paymentRequest.findFirst({
      where: { studentId: student.id, fulfilledBy: null, amountTotal: tx.amount },
      orderBy: { createdAt: "asc" },
    });

    let openRequest = exactRequest;
    if (!exactRequest) {
      const baseAmount = tx.amount - student.paymentOffset;
      const validPrices = [student.lessonPrice, student.groupLessonPrice].filter((p): p is number => !!p && p > 0);
      const isValid = validPrices.some((p) => baseAmount > 0 && baseAmount % p === 0);
      if (!isValid) continue;

      // Link to oldest open request for tracking (if any)
      openRequest = await prisma.paymentRequest.findFirst({
        where: { studentId: student.id, fulfilledBy: null },
        orderBy: { createdAt: "asc" },
      });
    }

    await prisma.payment.create({
      data: {
        teacherId,
        studentId: student.id,
        paymentRequestId: openRequest?.id ?? null,
        amountReceived: tx.amount,
        bankTxId: tx.id,
        matchedAt: tx.receivedAt,
        source: "bank",
      },
    });
    matched++;

    if (student.telegramId) {
      const sentText = await sendPaymentConfirmation(
        student.telegramId,
        tx.amount,
      ).catch(() => null);
      await logNotification({
        teacherId,
        studentId: student.id,
        studentName: student.name,
        type: "payment_confirmed",
        text: sentText ?? `Оплата ${formatAmount(tx.amount)} підтверджена`,
      }).catch(() => null);
    }

    if (teacher.telegramChatId) {
      await sendTeacherPaymentNotification(
        teacher.telegramChatId,
        tx.amount,
        student.name
      ).catch(() => null);
    }
  }

  // ── Lesson reminders ──────────────────────────────────────────────
  const teacherWindowsMin = parseMinutes(teacher.teacherReminderMinutes);
  const studentWindowsMin = parseMinutes(teacher.studentReminderMinutes);
  const now = Date.now();

  const maxWindowMs = Math.max(...teacherWindowsMin, ...studentWindowsMin, 60) * 60 * 1000;
  const windowEnd = new Date(now + maxWindowMs + 10 * 60 * 1000);
  const today = new Date().toISOString().slice(0, 10);

  // ── Individual-slot reminders ──────────────────────────────────────────
  const upcomingSlots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId,
      isActive: true,
      isGroup: false,
      studentId: { not: null },
      date: { gte: today, lte: windowEnd.toISOString().slice(0, 10) },
    },
    include: { student: true },
  });

  for (const slot of upcomingSlots) {
    if (!slot.student) continue;

    const scheduledAt = new Date(`${slot.date}T${slot.startTime}:00`);
    const msUntil = scheduledAt.getTime() - now;
    if (msUntil < 0) continue;

    const lesson = await ensureLesson(slot.id, teacherId, slot.student.id, scheduledAt, slot.durationMin);

    if (!lesson.reminderSent && slot.student.telegramId && msUntil >= 5 * 60 * 1000) {
      const bestWindow = [...studentWindowsMin].sort((a, b) => a - b).find((w) => msUntil <= w * 60 * 1000 + 5 * 60 * 1000);
      if (bestWindow !== undefined) {
        const sentText = await sendStudentLessonReminder(
          slot.student.telegramId,
          scheduledAt,
          bestWindow,
          teacher.name,
          slot.isRecurring
        ).catch(() => null);
        await logNotification({
          teacherId,
          studentId: slot.student.id,
          studentName: slot.student.name,
          type: "lesson_reminder",
          text: sentText ?? `Нагадування: заняття ${slot.date} о ${slot.startTime}`,
        }).catch(() => null);
        await prisma.lesson.update({ where: { id: lesson.id }, data: { reminderSent: true } });
      }
    }

    if (!lesson.reminderSentTeacher && teacher.telegramChatId && msUntil >= 5 * 60 * 1000) {
      const bestWindow = [...teacherWindowsMin].sort((a, b) => a - b).find((w) => msUntil <= w * 60 * 1000 + 5 * 60 * 1000);
      if (bestWindow !== undefined) {
        await sendTeacherLessonReminder(
          teacher.telegramChatId,
          scheduledAt,
          bestWindow,
          slot.student.name,
          slot.isRecurring
        ).catch(() => null);
        await prisma.lesson.update({ where: { id: lesson.id }, data: { reminderSentTeacher: true } });
      }
    }
  }

  // ── Group-slot reminders ───────────────────────────────────────────────
  const upcomingGroupSlots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId,
      isActive: true,
      isGroup: true,
      date: { gte: today, lte: windowEnd.toISOString().slice(0, 10) },
    },
    include: { groupStudents: { include: { student: true } } },
  });

  for (const slot of upcomingGroupSlots) {
    const scheduledAt = new Date(`${slot.date}T${slot.startTime}:00`);
    const msUntil = scheduledAt.getTime() - now;
    if (msUntil < 0) continue;

    const studentNames = slot.groupStudents.map((gs) => gs.student.name).join(", ");

    for (const { student } of slot.groupStudents) {
      const lesson = await ensureLesson(slot.id, teacherId, student.id, scheduledAt, slot.durationMin);

      if (!lesson.reminderSent && student.telegramId && msUntil >= 5 * 60 * 1000) {
        const bestWindow = [...studentWindowsMin].sort((a, b) => a - b).find((w) => msUntil <= w * 60 * 1000 + 5 * 60 * 1000);
        if (bestWindow !== undefined) {
          await sendStudentLessonReminder(
            student.telegramId,
            scheduledAt,
            bestWindow,
            teacher.name,
            slot.isRecurring
          ).catch(() => null);
          await logNotification({
            teacherId,
            studentId: student.id,
            studentName: student.name,
            type: "lesson_reminder",
            text: `Нагадування: групове заняття ${slot.date} о ${slot.startTime}`,
          }).catch(() => null);
          await prisma.lesson.update({ where: { id: lesson.id }, data: { reminderSent: true } });
        }
      }
    }

    if (teacher.telegramChatId && msUntil >= 5 * 60 * 1000) {
      const anyLesson = await prisma.lesson.findFirst({
        where: { slotId: slot.id, reminderSentTeacher: false },
      });
      if (anyLesson) {
        const bestWindow = [...teacherWindowsMin].sort((a, b) => a - b).find((w) => msUntil <= w * 60 * 1000 + 5 * 60 * 1000);
        if (bestWindow !== undefined) {
          await sendTeacherLessonReminder(
            teacher.telegramChatId,
            scheduledAt,
            bestWindow,
            `Група: ${studentNames}`,
            slot.isRecurring
          ).catch(() => null);
          await prisma.lesson.updateMany({
            where: { slotId: slot.id },
            data: { reminderSentTeacher: true },
          });
        }
      }
    }
  }

  // ── Post-lesson payment reminder ──────────────────────────────────────
  // Send payment details to student after lesson ends (if teacher has paymentDetails set)
  if (teacher.paymentDetails) {
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Individual slot reminders
    const justFinishedSlots = await prisma.availabilitySlot.findMany({
      where: {
        teacherId,
        isActive: true,
        isGroup: false,
        studentId: { not: null },
        date: { gte: yesterday, lte: today },
      },
      include: { student: true, lessons: { where: { paymentReminderSent: false } } },
    });

    for (const slot of justFinishedSlots) {
      if (!slot.student?.telegramId) continue;
      if (!slot.student.sendPaymentReminder) continue;

      const slotEnd = new Date(`${slot.date}T${slot.endTime}:00`);
      if (slotEnd.getTime() > now || slotEnd.getTime() < threeHoursAgo.getTime()) continue;

      const lesson = slot.lessons[0];
      if (!lesson) continue;

      const request = await prisma.paymentRequest.findFirst({
        where: { studentId: slot.student.id, fulfilledBy: null },
        orderBy: { createdAt: "desc" },
      });

      const sentReminderText = await sendPostLessonPaymentReminder(
        slot.student.telegramId,
        teacher.paymentDetails ?? "",
        request?.amountTotal,
        teacher.postLessonNote
      ).catch(() => null);
      await logNotification({
        teacherId,
        studentId: slot.student.id,
        studentName: slot.student.name,
        type: "payment_reminder",
        text: sentReminderText ?? (request?.amountTotal
          ? `Нагадування про оплату після заняття: ${formatAmount(request.amountTotal)}`
          : "Нагадування про оплату після заняття"),
      }).catch(() => null);
      await prisma.lesson.update({ where: { id: lesson.id }, data: { paymentReminderSent: true } });
    }

    // Group slot reminders
    const justFinishedGroupSlots = await prisma.availabilitySlot.findMany({
      where: {
        teacherId,
        isActive: true,
        isGroup: true,
        date: { gte: yesterday, lte: today },
      },
      include: {
        groupStudents: { include: { student: true } },
        lessons: { where: { paymentReminderSent: false } },
      },
    });

    for (const slot of justFinishedGroupSlots) {
      const slotEnd = new Date(`${slot.date}T${slot.endTime}:00`);
      if (slotEnd.getTime() > now || slotEnd.getTime() < threeHoursAgo.getTime()) continue;

      for (const { student } of slot.groupStudents) {
        if (!student.telegramId || !student.sendPaymentReminder) continue;

        const lesson = slot.lessons.find((l) => l.studentId === student.id);
        if (!lesson) continue;

        const request = await prisma.paymentRequest.findFirst({
          where: { studentId: student.id, fulfilledBy: null },
          orderBy: { createdAt: "desc" },
        });

        const priceKopecks = student.groupLessonPrice ?? student.lessonPrice;
        const amount = request?.amountTotal ?? priceKopecks;

        const sentGroupReminderText = await sendPostLessonPaymentReminder(
          student.telegramId,
          teacher.paymentDetails ?? "",
          amount,
          teacher.postLessonNote
        ).catch(() => null);
        await logNotification({
          teacherId,
          studentId: student.id,
          studentName: student.name,
          type: "payment_reminder",
          text: sentGroupReminderText ?? `Нагадування про оплату після групового заняття: ${formatAmount(amount)}`,
        }).catch(() => null);
        await prisma.lesson.update({ where: { id: lesson.id }, data: { paymentReminderSent: true } });
      }
    }
  }

  // ── Auto-extend recurring series ──────────────────────────────────────
  await extendExpiringSeries(teacherId);

  await prisma.teacher.update({ where: { id: teacherId }, data: { lastPolledAt: new Date() } });
  return matched;
}

function parseMinutes(raw: string): number[] {
  return raw
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v) && v > 0)
    .sort((a, b) => b - a);
}

async function ensureLesson(
  slotId: string,
  teacherId: string,
  studentId: string,
  scheduledAt: Date,
  durationMin: number
) {
  const startOfDay = new Date(scheduledAt);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(scheduledAt);
  endOfDay.setHours(23, 59, 59, 999);

  let lesson = await prisma.lesson.findFirst({
    where: {
      slotId,
      scheduledAt: { gte: startOfDay, lte: endOfDay },
      status: { not: "CANCELLED" },
    },
  });

  if (!lesson) {
    lesson = await prisma.lesson.create({
      data: { teacherId, studentId, slotId, scheduledAt, durationMin },
    });
  }
  return lesson;
}

