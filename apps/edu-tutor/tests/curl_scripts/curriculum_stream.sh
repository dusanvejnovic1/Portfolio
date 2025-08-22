#!/bin/bash

# Curriculum generation streaming test script
# Tests the SSE endpoint for curriculum generation

set -e

BASE_URL=${BASE_URL:-"http://localhost:3000"}
ENDPOINT="$BASE_URL/api/modes/curriculum/generate"

echo "🧪 Testing Curriculum Generation SSE Stream"
echo "Endpoint: $ENDPOINT"
echo

# Test payload
PAYLOAD='{
  "topic": "Docker Containerization",
  "level": "Beginner",
  "durationDays": 3,
  "goals": ["Understand Docker basics", "Create and run containers", "Write Dockerfiles"]
}'

echo "📦 Test payload:"
echo "$PAYLOAD" | jq .
echo

echo "🔄 Starting SSE stream (press Ctrl+C to stop)..."
echo "Expected events: day, day, day, done"
echo "---"

# Make the SSE request
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d "$PAYLOAD" \
  --no-buffer \
  -s | while IFS= read -r line; do
    if [ -n "$line" ]; then
      # Try to parse and pretty-print JSON
      if echo "$line" | jq . >/dev/null 2>&1; then
        echo "📨 $(echo "$line" | jq -c .)"
      else
        echo "📄 $line"
      fi
    fi
  done

echo
echo "✅ Stream completed"