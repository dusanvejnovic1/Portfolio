#!/bin/bash

# Curriculum generation JSON fallback test script
# Tests the JSON endpoint for curriculum generation

set -e

BASE_URL=${BASE_URL:-"http://localhost:3000"}
ENDPOINT="$BASE_URL/api/modes/curriculum/generate"

echo "🧪 Testing Curriculum Generation JSON Fallback"
echo "Endpoint: $ENDPOINT"
echo

# Test payload
PAYLOAD='{
  "topic": "Docker Containerization",
  "level": "Beginner",
  "durationDays": 2,
  "goals": ["Understand Docker basics", "Create and run containers"]
}'

echo "📦 Test payload:"
echo "$PAYLOAD" | jq .
echo

echo "📄 Requesting JSON response (no SSE Accept header)..."
echo "---"

# Make the JSON request (no Accept: text/event-stream header)
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -s | jq .

echo
echo "✅ JSON response completed"