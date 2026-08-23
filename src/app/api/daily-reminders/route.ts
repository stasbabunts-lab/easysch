import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDailyLine, splitTimes } from "@/lib/daily-reminder";

type Row = { id: string; text: string; times: string; isActive: boolean };
const shape = (r: Row) => ({ id: r.id, text: r.text, times: splitTimes(r.times), isActive: r.isActive });

// GET — the teacher's daily reminder rules.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.dailyReminder.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, times: true, isActive: true },
  });

  return NextResponse.json(rules.map(shape));
}

// POST — create a rule from one line: { line: "Спорт; 14:00; 18:00; 21:00" }.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { line } = await req.json();
  const parsed = parseDailyLine(line);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const rule = await prisma.dailyReminder.create({
    data: {
      teacherId: session.user.id,
      text: parsed.text,
      times: parsed.times.join(","),
    },
    select: { id: true, text: true, times: true, isActive: true },
  });

  return NextResponse.json(shape(rule), { status: 201 });
}
