import { prisma } from "./prisma";

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
    // Use T12:00:00 (noon) so toISOString() never crosses a UTC day boundary
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
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 21);
  const thresholdStr = threshold.toISOString().slice(0, 10);

  const groups = await prisma.availabilitySlot.groupBy({
    by: ["recurringGroupId"],
    where: { teacherId, isRecurring: true, isActive: true, recurringGroupId: { not: null } },
    _max: { date: true },
  });

  for (const g of groups) {
    if (!g.recurringGroupId || !g._max.date) continue;
    if (g._max.date > thresholdStr) continue; // still plenty of future instances

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
      8 // extend by 8 more weeks
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
