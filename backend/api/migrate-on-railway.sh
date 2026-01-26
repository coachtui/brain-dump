#!/bin/bash
# Script to run migrations on Railway after deployment

echo "🚀 Deploying to Railway..."
git add .
git commit -m "fix: update database connection to support DATABASE_URL" || true
git push origin main

echo "⏳ Waiting for deployment to complete (30 seconds)..."
sleep 30

echo "🔄 Running migrations on Railway..."
railway run --service brain-dump node run-migration.js

echo "✅ Migration complete!"
