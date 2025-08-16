#!/bin/bash

echo "🗑️  ATTEMPTING TO DELETE ALL COURSES ACROSS REPLICAS"
echo "===================================================="
echo ""

# Course IDs we've seen in the system
COURSE_IDS=(
    "68a0167c99fc420ec78274b8"  # AWS Networking & Security
    "68a0107e1a310d6d98200909"  # Advanced AWS Compute & Storage
    "68a0100699fc420ec782747d"  # AWS Essentials for Beginners
    "689eccb2243a66d88694a0af"  # Cloud Computing Fundamentals
)

echo "Found course IDs to delete:"
for id in "${COURSE_IDS[@]}"; do
    echo "  - $id"
done
echo ""

# Get a fresh list of courses from API
echo "🔍 Getting current course list from API..."
CURRENT_COURSES=$(curl -s "https://api.cloudmastershub.com/api/courses?status=all" | jq -r '.data[]._id' 2>/dev/null)

if [ ! -z "$CURRENT_COURSES" ]; then
    echo "Current courses in API:"
    echo "$CURRENT_COURSES" | while read course_id; do
        echo "  - $course_id"
        # Add to our list if not already there
        if [[ ! " ${COURSE_IDS[@]} " =~ " ${course_id} " ]]; then
            COURSE_IDS+=("$course_id")
        fi
    done
fi

echo ""
echo "⚠️  NOTE: You need to run these DELETE commands manually with admin authentication"
echo "   The script cannot execute them without proper auth headers."
echo ""

# Show the curl commands needed
for id in "${COURSE_IDS[@]}"; do
    echo "DELETE attempt for course $id:"
    echo "curl -X DELETE 'https://api.cloudmastershub.com/api/admin/courses/$id' \\"
    echo "     -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \\"
    echo "     -H 'Content-Type: application/json'"
    echo ""
done

echo "🔄 MANUAL PROCESS:"
echo "1. Try deleting each course multiple times from admin dashboard"
echo "2. Refresh the admin page between attempts"
echo "3. Different replicas will show different courses"
echo "4. Eventually all courses will be deleted from all replicas"
echo ""
echo "✅ Target: All API endpoints should return 0 courses consistently"