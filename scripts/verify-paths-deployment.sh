#!/bin/bash

echo "🚀 Verifying Learning Paths Deployment"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="https://api.cloudmastershub.com"
HEALTH_ENDPOINT="/api/admin/paths/health"

echo -e "${YELLOW}Testing backend health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" "${BASE_URL}${HEALTH_ENDPOINT}")
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed "s/HTTP_STATUS:[0-9]*//")

echo "URL: ${BASE_URL}${HEALTH_ENDPOINT}"
echo "HTTP Status: $HTTP_STATUS"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Health endpoint is working!${NC}"
    
    # Check if the response contains our debug message
    if echo "$RESPONSE_BODY" | grep -q "Admin paths endpoint is working"; then
        echo -e "${GREEN}✅ Updated code is deployed!${NC}"
    else
        echo -e "${YELLOW}⚠️  Endpoint working but may not have latest code${NC}"
    fi
else
    echo -e "${RED}❌ Health endpoint failed with status $HTTP_STATUS${NC}"
fi

echo ""
echo -e "${YELLOW}Testing main API Gateway health...${NC}"
GATEWAY_HEALTH=$(curl -s "${BASE_URL}/health")
echo "Gateway Health: $GATEWAY_HEALTH"

echo ""
echo -e "${YELLOW}Deployment checklist:${NC}"
echo "1. Check if Jenkins CI has built the latest commit"
echo "2. Update GitOps repo with new image tag"
echo "3. Verify ArgoCD has synced the changes"
echo "4. Check backend service logs for any startup errors"

echo ""
echo "🔗 Useful URLs:"
echo "- ArgoCD: http://argocd.elitessystems.com"
echo "- Frontend: https://cloudmastershub.com/admin/paths"
echo "- Backend Health: ${BASE_URL}/health"
echo "- Paths Health: ${BASE_URL}${HEALTH_ENDPOINT}"