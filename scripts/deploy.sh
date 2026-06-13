#!/bin/bash
set -e

APP_DIR="/home/stas/apps/easysch"
BACKUP_DIR="/home/stas/backups"
DB="$APP_DIR/data/prod.db"
STAMP=$(date +%Y%m%d-%H%M%S)

echo "=== EasySch deploy: $(date) ==="
cd "$APP_DIR"

echo "--- Pulling latest code..."
git pull origin master

echo "--- Generating Prisma client..."
npx prisma generate

# Build BEFORE touching the DB: a compile error must abort the deploy while the
# old build is still serving and the schema is untouched.
echo "--- Building app..."
npm run build

# Snapshot the DB right before any schema change. `db push --accept-data-loss`
# can drop columns/data, and the daily backup may be up to ~24h old — this gives
# an immediate restore point. .backup is WAL-safe.
if [ -f "$DB" ]; then
  echo "--- Backing up DB before migration..."
  mkdir -p "$BACKUP_DIR"
  SNAP="$BACKUP_DIR/prod-predeploy-$STAMP.db"
  sqlite3 "$DB" ".backup '$SNAP'"
  echo "    saved $SNAP"
  # keep only the last 10 pre-deploy snapshots
  ls -1t "$BACKUP_DIR"/prod-predeploy-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
fi

echo "--- Pushing DB schema..."
npx prisma db push --accept-data-loss

echo "--- Reloading PM2..."
pm2 reload easysch --update-env

# Health check — if the app doesn't answer, surface it loudly with the restore
# point so a rollback is one command away.
echo "--- Health check..."
sleep 3
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || echo "000")
if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "308" ]; then
  echo "    OK ($CODE)"
else
  echo "    ⚠️  HEALTH CHECK FAILED ($CODE) — inspect: pm2 logs easysch --lines 50"
  [ -n "$SNAP" ] && echo "    DB restore point: $SNAP"
  echo "    Rollback code: git reset --hard HEAD~1 && npm run build && pm2 reload easysch --update-env"
fi

# Tag this deploy for an obvious rollback target.
git tag "deploy-$STAMP" >/dev/null 2>&1 || true

echo "=== Done ==="
