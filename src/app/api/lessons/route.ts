import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const studentId = searchParams.get("studentId");
  const now = new Date();

  const lessons = await prisma.lesson.findMany({
    where: {
      teacherId: session.user.id,
      ...(studentId && { studentId }),
      ...(status === "upcoming" && { scheduledAt: { gte: now }, status: { not: "CANCELLED" } }),
      ...(status === "past" && { scheduledAt: { lt: now } }),
    },
    include: { student: { select: { id: true, name: true } } },
    orderBy: { scheduledAt: status === "past" ? "desc" : "asc" },
    take: 50,
  });
  return NextResponse.json(lessons);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, scheduledAt, durationMin, notes } = await req.json();
  if (!studentId || !scheduledAt) {
    return NextResponse.json({ error: "studentId и scheduledAt обязательны" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, teacherId: session.user.id },
  });
  if (!student) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  const lesson = await prisma.lesson.create({
    data: {
      teacherId: session.user.id,
      studentId,
      scheduledAt: new Date(scheduledAt),
      durationMin: durationMin ?? 60,
      notes: notes || null,
    },
    include: { student: { select: { id: true, name: true } } },
  });
  return NextResponse.json(lesson, { status: 201 });
}
