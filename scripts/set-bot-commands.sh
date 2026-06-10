#!/usr/bin/env bash
# Registers the bot's command menu (the "/" / Menu list shown in Telegram).
# Telegram stores this server-side until changed — re-run this whenever the
# command list changes. Reads TELEGRAM_BOT_TOKEN from the env files (Next.js
# precedence: .env.local overrides .env).
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN=$(cat .env.local .env .env.production 2>/dev/null | sed -n 's/^TELEGRAM_BOT_TOKEN=//p' | head -1 | tr -d '"' | tr -d "'" | xargs)
if [ -z "${TOKEN:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN not found in .env.local" >&2
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'JSON'
{
  "commands": [
    {"command": "start",      "description": "Підключити бот за кодом"},
    {"command": "help",       "description": "Усі команди"},
    {"command": "today",      "description": "Сьогоднішні заняття (спеціаліст)"},
    {"command": "week",       "description": "Заняття на 7 днів (спеціаліст)"},
    {"command": "debts",      "description": "Клієнти з боргом (спеціаліст)"},
    {"command": "mystudents", "description": "Список клієнтів (спеціаліст)"},
    {"command": "support",    "description": "Підтримка (спеціаліст)"},
    {"command": "next",       "description": "Найближче заняття (клієнт)"},
    {"command": "lessons",    "description": "Заняття на місяць (клієнт)"},
    {"command": "balance",    "description": "Ваш баланс (клієнт)"},
    {"command": "pay",        "description": "Реквізити для оплати (клієнт)"},
    {"command": "my",         "description": "Ваші спеціалісти (клієнт)"},
    {"command": "unlink",     "description": "Відписатися від спеціаліста (клієнт)"}
  ]
}
JSON
echo
