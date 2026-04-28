import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, amountBase, description } = await req.json();
  if (!studentId || !amountBase) {
    return NextResponse.json({ error: "studentId и сумма обязательны" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId: session.user.id },
  });
  if (!student) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  const base = Math.round(Number(amountBase) * 100);
  const request = await prisma.paymentRequest.create({
    data: {
      studentId,
      amountBase: base,
      amountTotal: base + student.paymentOffset,
      description: description || null,
    },
  });

  return NextResponse.json(request, { status: 201 });
}
