import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignPaymentOffset } from "@/lib/payment-offset";
import { generateUniqueStudentCode } from "@/lib/student-code";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await prisma.student.findMany({
    where: { teacherId: session.user.id, isArchived: false },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { lessons: true } },
      payments: { select: { amountReceived: true } },
      paymentRequests: {
        where: { fulfilledBy: null },
        select: { amountTotal: true },
      },
    },
  });

  return NextResponse.json(
    students.map((s) => ({
      ...s,
      totalPaid: s.payments.reduce((sum, p) => sum + p.amountReceived, 0),
      totalOwed: s.paymentRequests.reduce((sum, r) => sum + r.amountTotal, 0),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, lessonPrice, groupLessonPrice, notes } = await req.json();
  const priceNum = Number(lessonPrice);
  if (!name || isNaN(priceNum) || priceNum < 0) {
    return NextResponse.json({ error: "Ім'я та ціна обов'язкові" }, { status: 400 });
  }

  const paymentOffset = await assignPaymentOffset(session.user.id);
  const code = await generateUniqueStudentCode();
  const student = await prisma.student.create({
    data: {
      name,
      code,
      lessonPrice: Math.round(Number(lessonPrice) * 100),
      groupLessonPrice: groupLessonPrice ? Math.round(Number(groupLessonPrice) * 100) : null,
      paymentOffset,
      notes: notes || null,
      teacherId: session.user.id,
    },
  });
  return NextResponse.json(student, { status: 201 });
}
