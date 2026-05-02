import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { buildWeeklyInstances } from "../route";
// Note: buildWeeklyInstances uses T12:00:00 internally to avoid UTC day-boundary drift

type Params = { params: Promise<{ id: string }> };

// PATCH: update a slot
// body can include: studentId, isRecurring (toggle), applyTo: "one"|"future"
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id },
    include: { student: { select: { id: true, name: true } } },
  });
  if (!slot || slot.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { studentId, isRecurring, applyTo = "one" } = body;

  // ── Toggle recurring ────────────────────────────────────────────────
  if (isRecurring !== undefined && isRecurring !== slot.isRecurring) {
    if (isRecurring) {
      // Turn ON recurring: create a new series from this slot's date
      const groupId = randomUUID();
      const instances = buildWeeklyInstances(
        slot.date,
        slot.startTime,
        slot.endTime,
        slot.durationMin,
        groupId,
        13
      );

      // Delete the current single slot and replace with series
      await prisma.availabilitySlot.delete({ where: { id } });
      await prisma.availabilitySlot.createMany({
        data: instances.map((inst: ReturnType<typeof buildWeeklyInstances>[number]) => ({
          teacherId: session.user.id,
          ...inst,
          studentId: slot.studentId,
          isActive: true,
        })),
      });

      const created = await prisma.availabilitySlot.findMany({
        where: { teacherId: session.user.id, recurringGroupId: groupId },
        include: { student: { select: { id: true, name: true } } },
        orderBy: { date: "asc" },
      });
      return NextResponse.json({ action: "series_created", slots: created });
    } else {
      // Turn OFF recurring: convert this specific slot to a one-off, cancel future series instances
      if (slot.recurringGroupId && applyTo === "future") {
        // Cancel this + future instances in the series
        await prisma.availabilitySlot.updateMany({
          where: {
            recurringGroupId: slot.recurringGroupId,
            date: { gte: slot.date },
            isActive: true,
          },
          data: { isActive: false },
        });
      } else {
        // Just make this one non-recurring (detach from group)
        await prisma.availabilitySlot.update({
          where: { id },
          data: { isRecurring: false, recurringGroupId: null },
        });
      }
      const updated = await prisma.availabilitySlot.findUnique({
        where: { id },
        include: { student: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ action: "updated", slots: updated ? [updated] : [] });
    }
  }

  // ── Update student assignment ───────────────────────────────────────
  if (studentId !== undefined) {
    const newStudentId = studentId || null;

    if (applyTo === "future" && slot.recurringGroupId) {
      await prisma.availabilitySlot.updateMany({
        where: {
          recurringGroupId: slot.recurringGroupId,
          date: { gte: slot.date },
          isActive: true,
        },
        data: { studentId: newStudentId },
      });
      const updated = await prisma.availabilitySlot.findMany({
        where: { recurringGroupId: slot.recurringGroupId, isActive: true },
        include: { student: { select: { id: true, name: true } } },
        orderBy: { date: "asc" },
      });
      return NextResponse.json({ action: "updated", slots: updated });
    } else {
      const updated = await prisma.availabilitySlot.update({
        where: { id },
        data: { studentId: newStudentId },
        include: { student: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ action: "updated", slots: [updated] });
    }
  }

  // Generic update
  const updated = await prisma.availabilitySlot.update({
    where: { id },
    data: body,
    include: { student: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ action: "updated", slots: [updated] });
}

// DELETE: remove slot(s)
// query: ?mode=one (default) | ?mode=future (this + all future in series)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mode = new URL(req.url).searchParams.get("mode") ?? "one";

  const slot = await prisma.availabilitySlot.findUnique({ where: { id } });
  if (!slot || slot.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toISOString().slice(11, 16);

  if (mode === "future" && slot.recurringGroupId) {
    // Before deleting, compensate balance for any conducted slots being removed
    const conductedToDelete = await prisma.availabilitySlot.findMany({
      where: {
        recurringGroupId: slot.recurringGroupId,
        date: { gte: slot.date },
        isActive: true,
        studentId: { not: null },
        OR: [
          { date: { lt: today } },
          { date: today, endTime: { lte: currentTime } },
        ],
      },
      include: { student: { select: { id: true, lessonPrice: true, balanceAdjustmentKopecks: true } } },
    });

    if (conductedToDelete.length > 0) {
      // Group by student and sum up the compensation needed
      const byStudent = new Map<string, { lessonPrice: number; balanceAdjustmentKopecks: number; count: number }>();
      for (const s of conductedToDelete) {
        if (!s.student) continue;
        const entry = byStudent.get(s.student.id) ?? { ...s.student, count: 0 };
        entry.count++;
        byStudent.set(s.student.id, entry);
      }
      await Promise.all(
        [...byStudent.entries()].map(([studentId, { lessonPrice, balanceAdjustmentKopecks, count }]) =>
          prisma.student.update({
            where: { id: studentId },
            data: { balanceAdjustmentKopecks: balanceAdjustmentKopecks + lessonPrice * count },
          })
        )
      );
    }

    await prisma.availabilitySlot.deleteMany({
      where: {
        recurringGroupId: slot.recurringGroupId,
        date: { gte: slot.date },
      },
    });
    return NextResponse.json({ ok: true, mode: "future", groupId: slot.recurringGroupId });
  } else {
    // Single slot — compensate balance if it was already conducted
    const isConducted =
      slot.studentId &&
      (slot.date < today || (slot.date === today && slot.endTime <= currentTime));

    if (isConducted) {
      const student = await prisma.student.findUnique({ where: { id: slot.studentId! } });
      if (student) {
        await prisma.student.update({
          where: { id: student.id },
          data: { balanceAdjustmentKopecks: student.balanceAdjustmentKopecks + student.lessonPrice },
        });
      }
    }

    await prisma.availabilitySlot.delete({ where: { id } });
    return NextResponse.json({ ok: true, mode: "one", id });
  }
}
