import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, amount, notes } = await req.json();
  if (!studentId || !amount) {
    return NextResponse.json({ error: "studentId и сумма обязательны" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId: session.user.id },
  });
  if (!student) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  const payment = await prisma.payment.create({
    data: {
      teacherId: session.user.id,
      studentId,
      amountReceived: Math.round(Number(amount) * 100),
      source: "manual",
      notes: notes || null,
    },
    include: { student: { select: { id: true, name: true } } },
  });
  return NextResponse.json(payment, { status: 201 });
}
