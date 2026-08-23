import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pollPayments } from "@/lib/poller";
import { dispatchDueReminders, dispatchDailyReminders } from "@/lib/reminders-personal";

// Called by server cron every 5 minutes:
// curl -s -X POST https://easy-sch.com/api/cron \
//   -H "x-cron-secret: YOUR_CRON_SECRET"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teachers = await prisma.teacher.findMany({
    select: { id: true },
  });

  let totalMatched = 0;
  for (const teacher of teachers) {
    try {
      const matched = await pollPayments(teacher.id);
      totalMatched += matched;
    } catch {
      // one failing teacher should not block others
    }
  }

  let remindersSent = 0;
  try {
    remindersSent = await dispatchDueReminders();
  } catch {
    // Reminder dispatch must never break the payment-polling cron run
  }

  let dailySent = 0;
  try {
    dailySent = await dispatchDailyReminders();
  } catch {
    // Same here — a broken daily rule must not affect anything else
  }

  return NextResponse.json({
    ok: true,
    teachers: teachers.length,
    matched: totalMatched,
    remindersSent,
    dailySent,
  });
}
