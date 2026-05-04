import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teacherCode: string }> }
) {
  const { teacherCode } = await params;

  // Resolve: alias (lowercase) first, then code (uppercase)
  const teacher = await prisma.teacher.findFirst({
    where: { OR: [{ alias: teacherCode.toLowerCase() }, { code: teacherCode.toUpperCase() }] },
    select: { id: true, name: true, displayName: true, timezone: true, telegramUsername: true, phone: true },
  });

  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const in28Days = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId: teacher.id,
      isActive: true,
      date: { gte: today, lte: in28Days },
      OR: [
        { isGroup: false, studentId: null },   // free individual slots
        { isGroup: true, showAsFree: true },   // group slots explicitly marked as public
      ],
    },
    select: {
      date: true,
      startTime: true,
      endTime: true,
      durationMin: true,
      isRecurring: true,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({
    teacherName: teacher.displayName ?? teacher.name,
    telegramUsername: teacher.telegramUsername ?? null,
    phone: teacher.phone ?? null,
    slots: slots.map((s) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMin: s.durationMin,
      isRecurring: s.isRecurring,
    })),
  });
}
