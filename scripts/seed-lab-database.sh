#!/bin/bash

# Seed Lab Database Script
# This script populates the lab service MongoDB with sample data

set -e

echo "🌱 Starting lab database seeding..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend root directory."
    exit 1
fi

# Check if lab service exists
if [ ! -d "services/lab-service" ]; then
    echo "❌ Error: Lab service directory not found."
    exit 1
fi

echo "📦 Installing dependencies for lab service..."
cd services/lab-service
npm install

echo "🏗️  Building lab service..."
npm run build

echo "🌱 Running seed script..."
cd src/scripts
npx ts-node seedLabs.ts

echo "✅ Lab database seeding completed successfully!"
echo "🎯 Created 5 sample labs across different cloud providers"
echo "📊 Labs include: AWS EC2, Serverless, Azure VNet, GKE, Multi-cloud DR"

cd ../../../..
echo "🚀 Lab service is now ready with sample data!"