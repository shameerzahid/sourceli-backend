#!/bin/bash

# Test script to check admin stats endpoint
# Usage: ./test-stats.sh YOUR_ACCESS_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-stats.sh YOUR_ACCESS_TOKEN"
  echo ""
  echo "To get a token:"
  echo "1. Login via the frontend"
  echo "2. Check browser localStorage for 'auth-storage'"
  echo "3. Copy the accessToken value"
  exit 1
fi

echo "Testing /api/admin/stats endpoint..."
echo "Token: ${TOKEN:0:20}..."
echo ""

curl -X GET http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -v 2>&1 | grep -E "(HTTP|success|error|message|data|Status|Time)"








