import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Auto-extend recurring series that are running out of future instances
  await extendExpiringSeries(session.user.id);

  const today = todayStr();
  const in90Days = daysFromNow(90);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      teacherId: session.user.id,
      isActive: true,
      date: { gte: today, lte: in90Days },
    },
    include: { student: { select: { id: true, name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(slots);
}

// POST: create a new event (single or recurring series)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, startTime, endTime, durationMin = 60, isRecurring = false, studentId } = body;

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "date, startTime, endTime required" }, { status: 400 });
  }

  if (isRecurring) {
    // Create 13 weekly instances (~3 months)
    const groupId = randomUUID();
    const instances = buildWeeklyInstances(date, startTime, endTime, durationMin, groupId, 13);
    await prisma.availabilitySlot.createMany({
      data: instances.map((inst) => ({
        teacherId: session.user.id,
        ...inst,
        studentId: studentId || null,
        isActive: true,
      })),
    });
    const created = await prisma.availabilitySlot.findMany({
      where: { teacherId: session.user.id, recurringGroupId: groupId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(created, { status: 201 });
  } else {
    const slot = await prisma.availabilitySlot.create({
      data: {
        teacherId: session.user.id,
        date,
        startTime,
        endTime,
        durationMin,
        isRecurring: false,
        studentId: studentId || null,
      },
      include: { student: { select: { id: true, name: true } } },
    });
    return NextResponse.json([slot], { status: 201 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildWeeklyInstances(
  startDate: string,
  startTime: string,
  endTime: string,
  durationMin: number,
  groupId: string,
  count: number
) {
  const instances = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate + "T12:00:00");
    d.setDate(d.getDate() + i * 7);
    instances.push({
      date: d.toISOString().slice(0, 10),
      startTime,
      endTime,
      durationMin,
      isRecurring: true,
      recurringGroupId: groupId,
    });
  }
  return instances;
}

export async function extendExpiringSeries(teacherId: string) {
  const threshold = daysFromNow(21);

  const groups = await prisma.availabilitySlot.groupBy({
    by: ["recurringGroupId"],
    where: { teacherId, isRecurring: true, isActive: true, recurringGroupId: { not: null } },
    _max: { date: true },
  });

  for (const g of groups) {
    if (!g.recurringGroupId || !g._max.date) continue;
    if (g._max.date > threshold) continue;

    const last = await prisma.availabilitySlot.findFirst({
      where: { recurringGroupId: g.recurringGroupId, date: g._max.date ?? undefined },
    });
    if (!last) continue;

    const nextDate = new Date(last.date + "T12:00:00");
    nextDate.setDate(nextDate.getDate() + 7);

    const instances = buildWeeklyInstances(
      nextDate.toISOString().slice(0, 10),
      last.startTime,
      last.endTime,
      last.durationMin,
      last.recurringGroupId!,
      8
    );
    await prisma.availabilitySlot.createMany({
      data: instances.map((inst) => ({
        teacherId,
        ...inst,
        studentId: last.studentId,
        isActive: true,
      })),
    });
  }
}
