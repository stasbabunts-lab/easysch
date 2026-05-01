import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentRequestNotification } from "@/lib/bot/reminders";
import { logNotification } from "@/lib/bot/notification-log";
import { formatAmount } from "@/lib/payment-offset";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, amountBase, description } = await req.json();
  if (!studentId || !amountBase) {
    return NextResponse.json({ error: "studentId и сумма обязательны" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId: session.user.id },
    include: { teacher: { select: { paymentDetails: true, postLessonNote: true } } },
  });
  if (!student) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  if (!student.teacher.paymentDetails) {
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

  // Notify student in Telegram if connected (paymentDetails already validated above)
  if (student.telegramId) {
    await sendPaymentRequestNotification(
      student.telegramId,
      student.teacher.paymentDetails!,
      amountTotal,
      student.teacher.postLessonNote,
    ).catch(() => null);
    await logNotification({
      teacherId: session.user.id,
      studentId: studentId,
      studentName: student.name,
      type: "payment_request",
      text: `Запит на оплату ${formatAmount(amountTotal)}`,
    }).catch(() => null);
  }

  return NextResponse.json(request, { status: 201 });
}
