#!/bin/bash

echo "🔍 TESTING COURSE API CONSISTENCY"
echo "=================================="
echo ""

echo "Testing multiple requests to detect inconsistent responses..."
echo ""

for i in {1..10}; do
    echo "Request $i:"
    echo "  Regular: $(curl -s 'https://api.cloudmastershub.com/api/courses' | jq '.pagination.total')"
    echo "  Status=all: $(curl -s 'https://api.cloudmastershub.com/api/courses?status=all' | jq '.pagination.total')"
    echo ""
    sleep 1
done

echo ""
echo "🔍 TESTING COURSE TITLES CONSISTENCY"
echo "===================================="
echo ""

for i in {1..5}; do
    echo "Request $i - Course titles:"
    curl -s 'https://api.cloudmastershub.com/api/courses?status=all' | jq -r '.data[] | .title'
    echo "---"
    sleep 2
done

echo ""
echo "✅ Test completed. Check for any inconsistencies above."