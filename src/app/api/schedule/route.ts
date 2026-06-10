import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { buildWeeklyInstances } from "@/lib/recurring";

// Recurring series are auto-extended by the cron poller (extendExpiringSeries in
// pollPayments, every 5 min for every teacher) — not on schedule load, so the
// horizon never depends on whether the teacher opened this page.

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const historyDays = 60;
  const startDate = daysFromNow(-historyDays);
  const in90Days = daysFromNow(90);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId: session.user.id,
      isActive: true,
      date: { gte: startDate, lte: in90Days },
    },
    include: {
      student: { select: { id: true, name: true, createdAt: true } },
      groupStudents: { include: { student: { select: { id: true, name: true, createdAt: true } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(slots);
}

// POST: create a new event (single or recurring series)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, startTime, endTime, durationMin = 60, isRecurring = false, studentId, isGroup = false, studentIds = [], showAsFree = false } = body;

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "date, startTime, endTime required" }, { status: 400 });
  }

  const slotInclude = {
    student: { select: { id: true, name: true, createdAt: true } },
    groupStudents: { include: { student: { select: { id: true, name: true, createdAt: true } } } },
  };

  if (isRecurring) {
    const groupId = randomUUID();
    const instances = buildWeeklyInstances(date, startTime, endTime, durationMin, groupId, 13);
    await prisma.availabilitySlot.createMany({
      data: instances.map((inst) => ({
        teacherId: session.user.id,
        ...inst,
        isGroup,
        studentId: isGroup ? null : (studentId || null),
        isActive: true,
        showAsFree: isGroup ? showAsFree : false,
      })),
    });
    const created = await prisma.availabilitySlot.findMany({
      where: { teacherId: session.user.id, recurringGroupId: groupId },
      include: slotInclude,
      orderBy: { date: "asc" },
    });
    if (isGroup && studentIds.length > 0) {
      await prisma.groupSlotStudent.createMany({
        data: created.flatMap((slot) =>
          (studentIds as string[]).map((sid) => ({ slotId: slot.id, studentId: sid }))
        ),
      });
      const withGroup = await prisma.availabilitySlot.findMany({
        where: { recurringGroupId: groupId },
        include: slotInclude,
        orderBy: { date: "asc" },
      });
      return NextResponse.json(withGroup, { status: 201 });
    }
    return NextResponse.json(created, { status: 201 });
  } else {
    const slot = await prisma.availabilitySlot.create({
      data: {
        teacherId: session.user.id,
        date, startTime, endTime, durationMin,
        isRecurring: false,
        isGroup,
        studentId: isGroup ? null : (studentId || null),
        showAsFree: isGroup ? showAsFree : false,
      },
      include: slotInclude,
    });
    if (isGroup && studentIds.length > 0) {
      await prisma.groupSlotStudent.createMany({
        data: (studentIds as string[]).map((sid) => ({ slotId: slot.id, studentId: sid })),
      });
      const withGroup = await prisma.availabilitySlot.findUnique({
        where: { id: slot.id },
        include: slotInclude,
      });
      return NextResponse.json([withGroup], { status: 201 });
    }
    return NextResponse.json([slot], { status: 201 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
