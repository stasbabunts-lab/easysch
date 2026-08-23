import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDailyLine, splitTimes } from "@/lib/daily-reminder";

// PATCH — edit a rule: { line } to rewrite text/times, { isActive } to pause it.
// Editing the times resets lastSentAt so a slot moved to a later hour still fires today.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.dailyReminder.findFirst({
    where: { id, teacherId: session.user.id },
    select: { id: true, times: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { line, isActive } = await req.json();
  const data: { text?: string; times?: string; isActive?: boolean; lastSentAt?: null } = {};

  if (line !== undefined) {
    const parsed = parseDailyLine(line);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data.text = parsed.text;
    data.times = parsed.times.join(",");
    if (data.times !== existing.times) data.lastSentAt = null;
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive);

  const rule = await prisma.dailyReminder.update({
    where: { id },
    data,
    select: { id: true, text: true, times: true, isActive: true },
  });

  return NextResponse.json({ ...rule, times: splitTimes(rule.times) });
}

// DELETE — remove a rule (ownership-checked).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.dailyReminder.deleteMany({
    where: { id, teacherId: session.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
