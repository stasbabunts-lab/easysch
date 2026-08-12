#!/usr/bin/env bash
# Registers the bot's DEFAULT command menu (the "/" / Menu list in Telegram).
#
# This list is only the fallback for chats we have not seen yet, so it holds the
# common + client commands — a fresh chat is almost always a client about to
# enter their code, and specialist commands would just be noise they cannot use.
# Linked chats get a role-matched list pushed per chat by syncChatCommands()
# in src/lib/bot/commands.ts (both blocks at once for a specialist who is also
# somebody's client).
#
# Telegram stores this server-side until changed — re-run this whenever the
# command list changes. Reads TELEGRAM_BOT_TOKEN from the env files (Next.js
# precedence: .env.local overrides .env).
set -eu
cd "$(dirname "$0")/.."

TOKEN=$(for f in .env.local .env .env.production; do [ -f "$f" ] && cat "$f"; done \
  | sed -n 's/^TELEGRAM_BOT_TOKEN=//p' | head -1 | tr -d '"' | tr -d "'" | xargs)
if [ -z "${TOKEN:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN not found in .env.local" >&2
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "scope": {"type": "default"},
  "commands": [
    {"command": "start",      "description": "Підключити бот за кодом"},
    {"command": "help",       "description": "Усі команди"},
    {"command": "support",    "description": "Зв'язатися з підтримкою"},
    {"command": "next",       "description": "Найближче заняття"},
    {"command": "lessons",    "description": "Заняття на місяць"},
    {"command": "balance",    "description": "Ваш баланс"},
    {"command": "pay",        "description": "Реквізити для оплати"},
    {"command": "my",         "description": "Ваші спеціалісти"},
    {"command": "unlink",     "description": "Відписатися від спеціаліста"}
  ]
}
JSON
echo
