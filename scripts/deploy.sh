#!/bin/bash
set -e

APP_DIR="/home/stas/apps/easysch"
echo "=== EasySch deploy: $(date) ==="

cd $APP_DIR

echo "--- Pulling latest code..."
git pull origin master

echo "--- Generating Prisma client..."
npx prisma generate

echo "--- Pushing DB schema..."
npx prisma db push --accept-data-loss

echo "--- Building app..."
npm run build

echo "--- Reloading PM2..."
pm2 reload easysch --update-env

echo "=== Done ==="
