#!/usr/bin/env python3
"""
CLI and management script for EasySch personal reminders (/board/rem).
Directly accesses /home/stas/apps/easysch/data/prod.db or remote DB via SSH.
"""

import sys
import os
import sqlite3
import re
import uuid
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

KYIV_TZ = ZoneInfo("Europe/Kyiv")
DEFAULT_TEACHER_EMAIL = "stas.babunts@gmail.com"
DB_PATH = os.environ.get("EASYSCH_DB", "/home/stas/apps/easysch/data/prod.db")
SERVNOT55_BOT_TOKEN = "8484182543:AAG3g6h_6Fv2kg1jU1VMhIkWE4aFf-s3Ixc"
DEFAULT_CHAT_ID = "283499750"


def get_conn():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_teacher_id(conn, email=DEFAULT_TEACHER_EMAIL):
    cur = conn.cursor()
    cur.execute("SELECT id FROM Teacher WHERE email = ?", (email,))
    row = cur.fetchone()
    if not row:
        # Fallback to first teacher if specific email not found
        cur.execute("SELECT id FROM Teacher LIMIT 1")
        row = cur.fetchone()
    if not row:
        raise ValueError("No teacher found in database")
    return row["id"]


def gen_id():
    # CUID-like 25-char alphanumeric starting with 'c'
    raw = uuid.uuid4().hex + uuid.uuid4().hex[:8]
    return "c" + raw[:24]


def kyiv_now():
    return datetime.now(KYIV_TZ)


def parse_datetime_spec(spec: str, base_dt: datetime = None) -> datetime:
    """
    Parses human specs into a Kyiv datetime.
    Supports:
      - '15:00', '15.30'
      - 'tomorrow 15:00', 'завтра 15:00'
      - 'послезавтра 12:00', 'day after tomorrow 12:00'
      - '+20m', '20m', 'in 20m', 'через 20 минут'
      - '+2h', '2h', 'in 2h', 'через 2 часа'
      - '+1d', 'in 1d', 'через 1 день 14:00'
      - '2026-09-25 14:00'
      - '25.09 14:00'
    """
    now = base_dt or kyiv_now()
    s = spec.strip().lower()

    # Relative minutes: "через 15 минут", "+15m", "15m", "in 15 minutes"
    m_rel_min = re.search(r'(?:через|\+|\bin\s+)?\s*(\d+)\s*(?:м|мин|минут[уы]?|m|min|minutes?)\b', s)
    if m_rel_min:
        mins = int(m_rel_min.group(1))
        return (now + timedelta(minutes=mins)).replace(second=0, microsecond=0)

    # Relative hours: "через 2 часа", "+2h", "2h", "in 2 hours"
    m_rel_hr = re.search(r'(?:через|\+|\bin\s+)?\s*(\d+)\s*(?:ч|час|часа|часов|h|hr|hours?)\b', s)
    if m_rel_hr:
        hrs = int(m_rel_hr.group(1))
        return (now + timedelta(hours=hrs)).replace(second=0, microsecond=0)

    # Relative days: "через 1 день", "+1d", "in 1 day"
    m_rel_day = re.search(r'(?:через|\+|\bin\s+)?\s*(\d+)\s*(?:д|дн|дня|дней|день|d|day|days?)\b', s)
    day_offset = 0
    if m_rel_day:
        day_offset = int(m_rel_day.group(1))
        s = re.sub(r'(?:через|\+|\bin\s+)?\s*\d+\s*(?:д|дн|дня|дней|день|d|day|days?)\b', '', s).strip()

    # Tomorrow / After tomorrow
    if "послезавтра" in s or "day after tomorrow" in s:
        day_offset = 2
        s = s.replace("послезавтра", "").replace("day after tomorrow", "").strip()
    elif "завтра" in s or "tomorrow" in s:
        day_offset = 1
        s = s.replace("завтра", "").replace("tomorrow", "").strip()
    elif "сегодня" in s or "today" in s:
        day_offset = 0
        s = s.replace("сегодня", "").replace("today", "").strip()

    # Specific date YYYY-MM-DD
    m_full_date = re.search(r'(\d{4})-(\d{2})-(\d{2})', s)
    # Specific date DD.MM.YYYY or DD.MM
    m_dot_date = re.search(r'(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?', s)

    target_year = now.year
    target_month = now.month
    target_day = now.day + day_offset

    if m_full_date:
        target_year = int(m_full_date.group(1))
        target_month = int(m_full_date.group(2))
        target_day = int(m_full_date.group(3))
        s = s.replace(m_full_date.group(0), "").strip()
    elif m_dot_date:
        target_day = int(m_dot_date.group(1))
        target_month = int(m_dot_date.group(2))
        if m_dot_date.group(3):
            y = int(m_dot_date.group(3))
            target_year = y if y >= 100 else 2000 + y
        s = s.replace(m_dot_date.group(0), "").strip()

    # Time parsing: HH:MM or HH.MM or plain HH
    m_time = re.search(r'(\d{1,2})[:.](\d{2})', s)
    if m_time:
        hour = int(m_time.group(1))
        minute = int(m_time.group(2))
    else:
        m_hour = re.search(r'\b(\d{1,2})\b', s)
        if m_hour:
            hour = int(m_hour.group(1))
            minute = 0
        else:
            # Default to current time or 10:00 AM if only date was given
            hour = 10
            minute = 0

    base_date = datetime(target_year, target_month, 1, tzinfo=KYIV_TZ) + timedelta(days=target_day - 1)
    target_dt = datetime(base_date.year, base_date.month, base_date.day, hour, minute, tzinfo=KYIV_TZ)

    # If only time was provided (no day offset or explicit date) and that time has already passed today, assume tomorrow
    if day_offset == 0 and not m_full_date and not m_dot_date and target_dt <= now:
        target_dt += timedelta(days=1)

    return target_dt


def parse_daily_line(line: str):
    """
    Parses 'Спорт; 14:00; 18:00' or 'Спорт 14:00 18:00'.
    """
    tokens = [t.strip() for t in re.split(r'[;,\n]', line) if t.strip()]
    times = []
    text_parts = []

    time_token_re = re.compile(r'^(\d{1,2})[:.\-]?(\d{2})?$')
    for tok in tokens:
        m = time_token_re.match(tok)
        if m:
            h = int(m.group(1))
            m_min = int(m.group(2)) if m.group(2) is not None else 0
            if 0 <= h <= 23 and 0 <= m_min <= 59:
                times.append(f"{h:02d}:{m_min:02d}")
                continue
        text_parts.append(tok)

    text = ", ".join(text_parts)
    # Check for inline HH:MM in text
    inline_re = re.compile(r'\b(\d{1,2})[:.](\d{2})\b')
    for m in inline_re.finditer(text):
        h = int(m.group(1))
        m_min = int(m.group(2))
        if 0 <= h <= 23 and 0 <= m_min <= 59:
            times.append(f"{h:02d}:{m_min:02d}")

    text = inline_re.sub(" ", text)
    text = re.sub(r'\s+', ' ', text).strip(" .,;–-")

    unique_times = sorted(list(set(times)))
    if not text:
        raise ValueError("Не указан текст напоминания")
    if not unique_times:
        raise ValueError("Не указано время напоминания (например: 14:00)")

    return text[:300], ",".join(unique_times)


def cmd_list():
    conn = get_conn()
    tid = get_teacher_id(conn)
    cur = conn.cursor()

    cur.execute(
        "SELECT id, text, remindAt FROM Reminder WHERE teacherId = ? AND sent = 0 ORDER BY remindAt ASC",
        (tid,)
    )
    reminders = cur.fetchall()

    cur.execute(
        "SELECT id, text, times, isActive, lastSentAt FROM DailyReminder WHERE teacherId = ? ORDER BY createdAt ASC",
        (tid,)
    )
    daily = cur.fetchall()

    now = kyiv_now()
    res = {
        "now_kyiv": now.strftime("%Y-%m-%d %H:%M"),
        "reminders": [],
        "daily": []
    }

    print(f"🕒 Текущее время (Киев): {now.strftime('%Y-%m-%d %H:%M')}\n")
    print(f"📋 Одноразовые напоминания ({len(reminders)}):")
    if not reminders:
        print("  (нет активных напоминаний)")
    for r in reminders:
        remind_at = r["remindAt"]
        # Format string
        item = {
            "id": r["id"],
            "text": r["text"],
            "remindAt": remind_at
        }
        res["reminders"].append(item)
        print(f"  • [{r['id']}] {remind_at[:16].replace('T', ' ')}: {r['text']}")

    print(f"\n🔄 Ежедневные напоминания ({len(daily)}):")
    if not daily:
        print("  (нет ежедневных напоминаний)")
    for d in daily:
        status = "ВКЛ" if d["isActive"] else "ВЫКЛ"
        item = {
            "id": d["id"],
            "text": d["text"],
            "times": d["times"],
            "isActive": bool(d["isActive"])
        }
        res["daily"].append(item)
        print(f"  • [{d['id']}] ({status}) {d['times']}: {d['text']}")

    return res


def cmd_add(text: str, time_spec: str):
    conn = get_conn()
    tid = get_teacher_id(conn)
    cur = conn.cursor()

    dt = parse_datetime_spec(time_spec)
    # Kyiv wall-clock as UTC ISO string: YYYY-MM-DDTHH:MM:00.000Z
    iso_kyiv_wall_clock = dt.strftime("%Y-%m-%dT%H:%M:00.000+00:00")
    created_at = kyiv_now().strftime("%Y-%m-%dT%H:%M:%S.000+00:00")
    rid = gen_id()

    cur.execute(
        "INSERT INTO Reminder (id, teacherId, text, remindAt, sent, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
        (rid, tid, text.strip()[:1000], iso_kyiv_wall_clock, created_at)
    )
    conn.commit()

    time_human = dt.strftime("%Y-%m-%d %H:%M")
    print(f"✅ Напоминание создано!")
    print(f"ID: {rid}")
    print(f"Текст: {text}")
    print(f"Время: {time_human} (Киев)")
    return {"id": rid, "text": text, "remindAt": iso_kyiv_wall_clock, "human": time_human}


def cmd_add_daily(line: str):
    conn = get_conn()
    tid = get_teacher_id(conn)
    cur = conn.cursor()

    text, times = parse_daily_line(line)
    rid = gen_id()
    created_at = kyiv_now().strftime("%Y-%m-%dT%H:%M:%S.000+00:00")

    cur.execute(
        "INSERT INTO DailyReminder (id, teacherId, text, times, isActive, createdAt) VALUES (?, ?, ?, ?, 1, ?)",
        (rid, tid, text, times, created_at)
    )
    conn.commit()

    print(f"✅ Ежедневное напоминание создано!")
    print(f"ID: {rid}")
    print(f"Текст: {text}")
    print(f"Время: {times}")
    return {"id": rid, "text": text, "times": times}


def cmd_delete(item_id: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM Reminder WHERE id = ?", (item_id,))
    deleted = cur.rowcount
    if deleted == 0:
        cur.execute("DELETE FROM DailyReminder WHERE id = ?", (item_id,))
        deleted = cur.rowcount
    conn.commit()
    if deleted:
        print(f"🗑️ Напоминание {item_id} удалено.")
    else:
        print(f"⚠️ Напоминание с ID {item_id} не найдено.")
    return {"deleted": deleted > 0}


def cmd_test_send(text: str = "Тестовое уведомление от ассистента"):
    url = f"https://api.telegram.org/bot{SERVNOT55_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": DEFAULT_CHAT_ID,
        "text": f"🔔 <b>Нагадування (тест)</b>\n\n{text}",
        "parse_mode": "HTML"
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    print("Telegram response:", res.get("ok"))
    return res


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование:")
        print("  remind.py list")
        print("  remind.py add <текст> <время>")
        print("  remind.py add-daily <текст; время>")
        print("  remind.py delete <id>")
        print("  remind.py test-send [текст]")
        sys.exit(0)

    action = sys.argv[1]
    if action == "list":
        cmd_list()
    elif action == "add":
        if len(sys.argv) < 4:
            print("Ошибка: укажите текст и время. Пример: remind.py add 'Купить хлеб' '18:00'")
            sys.exit(1)
        cmd_add(sys.argv[2], sys.argv[3])
    elif action == "add-daily":
        if len(sys.argv) < 3:
            print("Ошибка: укажите правило. Пример: remind.py add-daily 'Спорт; 14:00; 18:00'")
            sys.exit(1)
        cmd_add_daily(sys.argv[2])
    elif action == "delete":
        if len(sys.argv) < 3:
            print("Ошибка: укажите ID для удаления.")
            sys.exit(1)
        cmd_delete(sys.argv[2])
    elif action == "test-send":
        t = sys.argv[2] if len(sys.argv) > 2 else "Тест напоминания"
        cmd_test_send(t)
    else:
        print(f"Неизвестная команда: {action}")
        sys.exit(1)
