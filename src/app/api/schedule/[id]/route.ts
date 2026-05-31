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
  const { isRecurring, applyTo = "one", date, startTime, endTime, durationMin, studentId, groupStudentIds, showAsFree } = body;

  const slotInclude = {
    student: { select: { id: true, name: true, createdAt: true } },
    groupStudents: { include: { student: { select: { id: true, name: true, createdAt: true } } } },
  } as const;

  // ── Toggle recurring (special: creates/destroys series) ─────────────
  if (isRecurring !== undefined && isRecurring !== slot.isRecurring) {
    if (isRecurring) {
      const groupId = randomUUID();
      const instances = buildWeeklyInstances(slot.date, slot.startTime, slot.endTime, slot.durationMin, groupId, 13);
      await prisma.availabilitySlot.delete({ where: { id } });
      await prisma.availabilitySlot.createMany({
        data: instances.map((inst: ReturnType<typeof buildWeeklyInstances>[number]) => ({
          teacherId: session.user.id, ...inst, studentId: slot.studentId, isActive: true,
        })),
      });
      const created = await prisma.availabilitySlot.findMany({
        where: { teacherId: session.user.id, recurringGroupId: groupId },
        include: slotInclude,
        orderBy: { date: "asc" },
      });
      return NextResponse.json({ action: "series_created", slots: created });
    } else {
      if (slot.recurringGroupId && applyTo === "future") {
        await prisma.availabilitySlot.updateMany({
          where: { recurringGroupId: slot.recurringGroupId, date: { gte: slot.date }, isActive: true },
          data: { isActive: false },
        });
      } else {
        await prisma.availabilitySlot.update({ where: { id }, data: { isRecurring: false, recurringGroupId: null } });
      }
      const updated = await prisma.availabilitySlot.findUnique({ where: { id }, include: slotInclude });
      return NextResponse.json({ action: "updated", slots: updated ? [updated] : [] });
    }
  }

  // ── Unified field update (date/time, student, group, showAsFree) ────
  // Build scalar fields to update
  const scalarData: Record<string, unknown> = {};
  if (date !== undefined) scalarData.date = date;
  if (startTime !== undefined) scalarData.startTime = startTime;
  if (endTime !== undefined) scalarData.endTime = endTime;
  if (durationMin !== undefined) scalarData.durationMin = durationMin;
  if (!slot.isGroup && studentId !== undefined) scalarData.studentId = studentId || null;
  if (showAsFree !== undefined) scalarData.showAsFree = showAsFree;

  if (applyTo === "future" && slot.recurringGroupId) {
    // Apply scalar changes to all future slots in the series.
    // Exclude `date` — setting every slot in a weekly series to the same fixed date
    // collapses them all to one day, which is never what the user wants.
    const { date: _excludedDate, ...bulkData } = scalarData as Record<string, unknown> & { date?: unknown };
    void _excludedDate;
    if (Object.keys(bulkData).length > 0) {
      await prisma.availabilitySlot.updateMany({
        where: { recurringGroupId: slot.recurringGroupId, date: { gte: slot.date }, isActive: true },
        data: bulkData,
      });
    }
    // Group students always apply to this single slot only — each occurrence can have its own attendees
    if (slot.isGroup && groupStudentIds !== undefined && Array.isArray(groupStudentIds)) {
      await prisma.groupSlotStudent.deleteMany({ where: { slotId: id } });
      if (groupStudentIds.length > 0) {
        await prisma.groupSlotStudent.createMany({
          data: groupStudentIds.map((sid: string) => ({ slotId: id, studentId: sid })),
        });
      }
    }
    const updated = await prisma.availabilitySlot.findMany({
      where: { recurringGroupId: slot.recurringGroupId, isActive: true },
      include: slotInclude,
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ action: "updated", slots: updated });
  } else {
    // Single slot update
    if (Object.keys(scalarData).length > 0) {
      await prisma.availabilitySlot.update({ where: { id }, data: scalarData });
    }
    // Group students (only single-slot, not bulk)
    if (slot.isGroup && groupStudentIds !== undefined && Array.isArray(groupStudentIds)) {
      await prisma.groupSlotStudent.deleteMany({ where: { slotId: id } });
      if (groupStudentIds.length > 0) {
        await prisma.groupSlotStudent.createMany({
          data: groupStudentIds.map((sid: string) => ({ slotId: id, studentId: sid })),
        });
      }
    }
    const updated = await prisma.availabilitySlot.findUnique({ where: { id }, include: slotInclude });
    return NextResponse.json({ action: "updated", slots: updated ? [updated] : [] });
  }
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
    // End the recurrence here: detach the remaining (earlier) occurrences from the
    // series so extendExpiringSeries won't regenerate the slots we just deleted.
    // Without this, the remaining tail stays within the 21-day extension window and
    // the deleted future slots reappear on the next schedule load.
    await prisma.availabilitySlot.updateMany({
      where: { recurringGroupId: slot.recurringGroupId, isActive: true },
      data: { isRecurring: false, recurringGroupId: null },
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
