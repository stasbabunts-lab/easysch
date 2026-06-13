import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getStudent(id: string, teacherId: string) {
  return prisma.student.findFirst({ where: { id, teacherId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const student = await prisma.student.findFirst({
    where: { id, teacherId: session.user.id },
    include: {
      lessons: { orderBy: { scheduledAt: "desc" }, take: 20 },
      payments: { orderBy: { confirmedAt: "desc" } },
      paymentRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(student);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await getStudent(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, lessonPrice, groupLessonPrice, notes, paymentDetails, balanceAdjustmentKopecks, sendPaymentReminder, isArchived } = await req.json();

  // When price changes, compensate balanceAdjustmentKopecks so past lessons
  // are not retroactively affected. Only auto-adjust when the caller isn't
  // also sending an explicit balanceAdjustmentKopecks (they're separate ops).
  let autoAdjustment: number | undefined;
  if (lessonPrice !== undefined && balanceAdjustmentKopecks === undefined) {
    const newPriceKopecks = Math.round(Number(lessonPrice) * 100);
    const priceDiffKopecks = newPriceKopecks - existing.lessonPrice;
    if (priceDiffKopecks !== 0) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const currentTime = now.toISOString().slice(11, 16);
      const conductedCount = await prisma.availabilitySlot.count({
        where: {
          studentId: id,
          isActive: true,
          OR: [
            { date: { lt: today } },
            { date: today, endTime: { lte: currentTime } },
          ],
        },
      });
      // Add diff × count so effectiveBalance stays the same
      autoAdjustment = existing.balanceAdjustmentKopecks + priceDiffKopecks * conductedCount;
    }
  }

  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(lessonPrice !== undefined && { lessonPrice: Math.round(Number(lessonPrice) * 100) }),
      ...(groupLessonPrice !== undefined && {
        groupLessonPrice: groupLessonPrice === null ? null : Math.round(Number(groupLessonPrice) * 100),
      }),
      ...(notes !== undefined && { notes }),
      ...(paymentDetails !== undefined && { paymentDetails: paymentDetails || null }),
      ...(balanceAdjustmentKopecks !== undefined && {
        balanceAdjustmentKopecks: Math.round(Number(balanceAdjustmentKopecks)),
      }),
      ...(autoAdjustment !== undefined && { balanceAdjustmentKopecks: autoAdjustment }),
      ...(sendPaymentReminder !== undefined && { sendPaymentReminder }),
      ...(isArchived !== undefined && {
        isArchived: Boolean(isArchived),
        archivedAt: isArchived ? new Date() : null,
      }),
    },
  });
  return NextResponse.json(student);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await getStudent(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permanent delete is only allowed from the archive — it wipes all history.
  if (!existing.isArchived) {
    return NextResponse.json(
      { error: "Спочатку архівуйте клієнта. Остаточне видалення доступне лише з архіву." },
      { status: 400 }
    );
  }

  // Student has required relations (Lesson, PaymentRequest) and unique-linked
  // Payments — none cascade on delete, so the bare delete fails on FK constraints.
  // Remove dependents first, in FK-safe order, inside one transaction.
  try {
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { studentId: id } }),
      prisma.paymentRequest.deleteMany({ where: { studentId: id } }),
      prisma.lesson.deleteMany({ where: { studentId: id } }),
      prisma.groupSlotStudent.deleteMany({ where: { studentId: id } }),
      prisma.availabilitySlot.deleteMany({ where: { studentId: id } }),
      prisma.student.delete({ where: { id } }),
    ]);
  } catch (e) {
    console.error("Failed to delete student", id, e);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
