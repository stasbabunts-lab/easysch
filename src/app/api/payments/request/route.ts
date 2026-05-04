import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentRequestNotification } from "@/lib/bot/reminders";
import { logNotification } from "@/lib/bot/notification-log";
import { formatAmount } from "@/lib/payment-offset";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, amountBase, description, silent } = await req.json();
  if (!studentId || !amountBase) {
    return NextResponse.json({ error: "studentId и сумма обязательны" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId: session.user.id },
    include: { teacher: { select: { paymentDetails: true, postLessonNote: true } } },
  });
  if (!student) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  const effectivePaymentDetails = student.paymentDetails ?? student.teacher.paymentDetails;
  if (!effectivePaymentDetails) {
    return NextResponse.json({ error: "Спочатку заповніть реквізити для оплати в налаштуваннях" }, { status: 400 });
  }

  const base = Math.round(Number(amountBase) * 100);
  const amountTotal = base + student.paymentOffset;

  const request = await prisma.paymentRequest.create({
    data: {
      studentId,
      amountBase: base,
      amountTotal,
      description: description || null,
    },
  });

  // Notify student in Telegram if connected and not a silent update
  if (!silent && student.telegramId) {
    const sentText = await sendPaymentRequestNotification(
      student.telegramId,
      effectivePaymentDetails,
      amountTotal,
      student.teacher.postLessonNote,
      description || null,
    ).catch(() => null);
    await logNotification({
      teacherId: session.user.id,
      studentId: studentId,
      studentName: student.name,
      type: "payment_request",
      text: sentText ?? `Запит на оплату ${formatAmount(amountTotal)}`,
    }).catch(() => null);
  }

  return NextResponse.json(request, { status: 201 });
}

// DELETE /api/payments/request — cancel all open payment requests for a student
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId обязателен" }, { status: 400 });

  // Verify student belongs to this teacher
  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId: session.user.id },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  await prisma.paymentRequest.deleteMany({
    where: { studentId, fulfilledBy: null },
  });

  return NextResponse.json({ ok: true });
}
