#!/bin/bash

# Grant Admin Privileges Script
# This script grants admin privileges to mbuaku@gmail.com

set -e

echo "🚀 Granting admin privileges to mbuaku@gmail.com..."
echo "⚠️  Make sure the databases are running!"
echo ""

# Change to user service directory
cd "$(dirname "$0")/../services/user-service"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the grant admin script
echo "🔑 Running admin grant script..."
npm run grant-admin

echo ""
echo "✅ Admin privileges granted successfully!"
echo ""
echo "Next steps:"
echo "1. Start the backend services: make dev (from BackEnd directory)"
echo "2. Visit the frontend application"
echo "3. Log in with mbuaku@gmail.com and your password"
echo "4. You should now have access to admin features at /admin"