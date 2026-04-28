import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: { id, teacherId: session.user.id },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status, scheduledAt, notes } = await req.json();
  const updated = await prisma.lesson.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(notes !== undefined && { notes }),
    },
    include: { student: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: { id, teacherId: session.user.id },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lesson.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
