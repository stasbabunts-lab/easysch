import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — pending (not-yet-sent) personal reminders for the dashboard widget.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reminders = await prisma.reminder.findMany({
    where: { teacherId: session.user.id, sent: false },
    orderBy: { remindAt: "asc" },
    select: { id: true, text: true, remindAt: true },
  });

  return NextResponse.json(
    reminders.map((r) => ({ ...r, remindAt: r.remindAt.toISOString() }))
  );
}

// POST — create a personal reminder. Body: { date: "YYYY-MM-DD", time: "HH:MM", text }.
// remindAt is built as Kyiv wall-clock stored as UTC, matching the rest of the app.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, time, text } = await req.json();

  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return NextResponse.json({ error: "Введіть текст нагадування" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Невірна дата або час" }, { status: 400 });
  }

  const remindAt = new Date(`${date}T${time}:00Z`);
  if (isNaN(remindAt.getTime())) {
    return NextResponse.json({ error: "Невірна дата або час" }, { status: 400 });
  }

  const reminder = await prisma.reminder.create({
    data: {
      teacherId: session.user.id,
      text: trimmed.slice(0, 1000),
      remindAt,
    },
    select: { id: true, text: true, remindAt: true },
  });

  return NextResponse.json(
    { ...reminder, remindAt: reminder.remindAt.toISOString() },
    { status: 201 }
  );
}
