#!/usr/bin/env python3
"""
find_telegram_channels.py — discover Telegram channels worth advertising EasySch in.

Logs in with YOUR Telegram account (Telethon / MTProto) and runs Telegram's
global search for a curated list of keywords describing our audience — private
tutors, coaches and service specialists in Ukraine, plus the communities where
they hang out. Collects public channels/groups, fetches subscriber counts and
descriptions, dedupes, and writes a CSV sorted by audience size.

────────────────────────────────────────────────────────────────────────────
SETUP (one-time)
  1. pip install -r scripts/requirements.txt        # just: telethon
  2. Get api_id + api_hash at https://my.telegram.org → "API development tools".
  3. Provide credentials via env vars (PowerShell):
        $env:TG_API_ID   = "123456"
        $env:TG_API_HASH = "abcdef0123456789abcdef0123456789"
        $env:TG_PHONE    = "+380XXXXXXXXX"
     (If unset, the script asks interactively.)
  4. The first run asks for the login code Telegram sends you (and your 2FA
     password if you have one). The session is cached in
     scripts/.tg_finder.session so later runs are silent.

USAGE
  python scripts/find_telegram_channels.py
  python scripts/find_telegram_channels.py --min-subs 500 --out channels.csv
  python scripts/find_telegram_channels.py --keywords "репетитор,коуч,фриланс"
  python scripts/find_telegram_channels.py --no-groups     # broadcast channels only

NOTES
  - Telegram's global search returns only a limited number of hits per query, so
    we cast a wide net with many keywords and dedupe across them.
  - Be gentle: the script sleeps between calls and honours FloodWait. A full run
    with the default keyword list takes a few minutes.
  - Results are CANDIDATES. Always eyeball each channel (real audience, topic,
    ad policy, geography) before paying for a post.
"""

import argparse
import asyncio
import csv
import os
import sys

try:
    from telethon import TelegramClient, functions, types, errors
except ImportError:
    sys.exit("Telethon is not installed. Run: pip install -r scripts/requirements.txt")


# ── Audience keywords ───────────────────────────────────────────────────────
# Who we want as teachers: people who schedule clients and take payments. So we
# look both for the specialists themselves and for the communities they read.
DEFAULT_KEYWORDS = [
    # Tutors / education
    "репетитор", "репетитори", "репетитор англійської", "репетитор математики",
    "викладач", "вчитель англійської", "вчителі україни", "онлайн школа",
    "онлайн навчання", "англійська мова", "польська мова", "німецька мова",
    "підготовка до НМТ", "підготовка до ЗНО", "освіта онлайн", "edtech",
    "репетитор онлайн", "уроки англійської",
    # Coaches / psychology / health
    "коуч", "коучинг", "психолог", "психолог онлайн", "психотерапевт",
    "логопед", "нутриціолог", "дієтолог", "фітнес тренер", "персональний тренер",
    "йога", "пілатес",
    # Beauty / crafts / services
    "майстер манікюру", "б'юті майстер", "майстер бровист", "косметолог",
    "масажист", "тату майстер", "перукар",
    # Arts / hobby teachers
    "музична школа", "уроки вокалу", "уроки гітари", "уроки малювання",
    "школа танців", "автоінструктор",
    # Freelancer / small-service-business communities
    "фріланс україна", "фрілансери", "приватні майстри", "самозайняті",
    "ФОП україна", "малий бізнес україна", "приватна практика",
    "спільнота репетиторів", "послуги україна",
]

SESSION_PATH = os.path.join(os.path.dirname(__file__), ".tg_finder")
DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "telegram_channels.csv")

UA_ONLY_CHARS = set("іїєґІЇЄҐ")


def detect_lang(text: str) -> str:
    """Rough language tag from the title/description."""
    if not text:
        return "?"
    if any(c in UA_ONLY_CHARS for c in text):
        return "uk"
    if any("Ѐ" <= c <= "ӿ" for c in text):
        return "ru/uk"
    return "other"


async def search_keyword(client, kw: str, limit: int):
    """Telegram global search for one keyword → list of Chat/Channel objects."""
    while True:
        try:
            res = await client(functions.contacts.SearchRequest(q=kw, limit=limit))
            return res.chats
        except errors.FloodWaitError as e:
            print(f"    ⏳ flood wait {e.seconds}s …")
            await asyncio.sleep(e.seconds + 1)
        except Exception as e:  # noqa: BLE001 — one bad query shouldn't kill the run
            print(f"    ⚠️  search '{kw}' failed: {e}")
            return []


async def fetch_full(client, channel):
    """Subscriber count + about text for a channel, with FloodWait handling."""
    while True:
        try:
            full = await client(functions.channels.GetFullChannelRequest(channel))
            return full.full_chat.participants_count, (full.full_chat.about or "")
        except errors.FloodWaitError as e:
            print(f"    ⏳ flood wait {e.seconds}s …")
            await asyncio.sleep(e.seconds + 1)
        except Exception:  # noqa: BLE001 — private/closed/deleted → skip gracefully
            return None, ""


async def run(args):
    api_id = os.environ.get("TG_API_ID") or input("api_id: ").strip()
    api_hash = os.environ.get("TG_API_HASH") or input("api_hash: ").strip()
    phone = os.environ.get("TG_PHONE") or input("phone (+380…): ").strip()

    keywords = (
        [k.strip() for k in args.keywords.split(",") if k.strip()]
        if args.keywords
        else DEFAULT_KEYWORDS
    )

    client = TelegramClient(SESSION_PATH, int(api_id), api_hash)
    await client.start(phone=lambda: phone)
    me = await client.get_me()
    print(f"✅ Logged in as {me.first_name} (@{me.username}). "
          f"Scanning {len(keywords)} keywords…\n")

    # id → candidate record
    found: dict[int, dict] = {}

    for i, kw in enumerate(keywords, 1):
        print(f"[{i}/{len(keywords)}] 🔎 {kw}")
        chats = await search_keyword(client, kw, args.limit)
        for chat in chats:
            if not isinstance(chat, types.Channel):
                continue  # skip basic groups / users
            if chat.megagroup and args.no_groups:
                continue
            if not chat.username:
                continue  # need a public @username to link / run ads
            rec = found.get(chat.id)
            if rec:
                rec["keywords"].add(kw)
            else:
                found[chat.id] = {
                    "entity": chat,
                    "title": chat.title or "",
                    "username": chat.username,
                    "type": "group" if chat.megagroup else "channel",
                    "keywords": {kw},
                }
        await asyncio.sleep(args.delay)

    print(f"\n📥 {len(found)} unique public candidates. Fetching subscriber counts…\n")

    rows = []
    for n, rec in enumerate(found.values(), 1):
        subs, about = await fetch_full(client, rec["entity"])
        lang = detect_lang(f"{rec['title']} {about}")
        rows.append({
            "title": rec["title"],
            "type": rec["type"],
            "username": rec["username"],
            "link": f"https://t.me/{rec['username']}",
            "subscribers": subs or 0,
            "lang": lang,
            "matched_keywords": ", ".join(sorted(rec["keywords"])),
            "about": " ".join(about.split())[:300],
        })
        if n % 20 == 0:
            print(f"    … {n}/{len(found)}")
        await asyncio.sleep(args.delay)

    await client.disconnect()

    # Filter + sort
    rows = [r for r in rows if r["subscribers"] >= args.min_subs]
    rows.sort(key=lambda r: r["subscribers"], reverse=True)

    with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "title", "type", "username", "link", "subscribers",
            "lang", "matched_keywords", "about",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n💾 Saved {len(rows)} channels → {args.out}\n")
    print(f"{'SUBS':>8}  {'TYPE':<7} {'LANG':<5} LINK / TITLE")
    print("─" * 70)
    for r in rows[:30]:
        print(f"{r['subscribers']:>8}  {r['type']:<7} {r['lang']:<5} "
              f"{r['link']}  —  {r['title']}")
    if len(rows) > 30:
        print(f"… and {len(rows) - 30} more in the CSV.")


def main():
    p = argparse.ArgumentParser(description="Find Telegram channels to advertise EasySch in.")
    p.add_argument("--keywords", help="Comma-separated keywords (overrides the default list).")
    p.add_argument("--min-subs", type=int, default=300, help="Skip channels below this many subscribers (default 300).")
    p.add_argument("--limit", type=int, default=50, help="Max results per keyword query (default 50).")
    p.add_argument("--delay", type=float, default=0.7, help="Seconds to sleep between API calls (default 0.7).")
    p.add_argument("--no-groups", action="store_true", help="Broadcast channels only (skip megagroups/communities).")
    p.add_argument("--out", default=DEFAULT_OUT, help=f"Output CSV path (default {DEFAULT_OUT}).")
    args = p.parse_args()

    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\nInterrupted.")


if __name__ == "__main__":
    main()
