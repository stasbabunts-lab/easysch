import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBoardData, setBoardData } from "@/lib/board-db";

// Personal goal board persistence (/board). Stored in the standalone board.db,
// one JSON blob per teacher. Reminders live elsewhere (main Reminder model via
// /api/reminders) — this only holds categories, loose cards, todos and layout.

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = getBoardData(session.user.id);
  // Return parsed state, or an empty board for first-time users.
  return NextResponse.json(
    data ? JSON.parse(data) : { version: 4, categories: [], loose: [], todos: [] }
  );
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.text();
  // Guard against runaway payloads (the board is small JSON; 2 MB is generous).
  if (body.length > 2_000_000) {
    return NextResponse.json({ error: "Board too large" }, { status: 413 });
  }
  // Validate it parses before storing, so a corrupt blob can't be saved.
  try {
    JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  setBoardData(session.user.id, body);
  return NextResponse.json({ ok: true });
}
