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

  const { name, lessonPrice, notes, balanceAdjustmentKopecks } = await req.json();
  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(lessonPrice !== undefined && { lessonPrice: Math.round(Number(lessonPrice) * 100) }),
      ...(notes !== undefined && { notes }),
      ...(balanceAdjustmentKopecks !== undefined && {
        balanceAdjustmentKopecks: Math.round(Number(balanceAdjustmentKopecks)),
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

  await prisma.student.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
