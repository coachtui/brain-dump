#!/bin/bash

# Test Data Creation Script for The Hub
# This creates atomic objects to test semantic search and embeddings

API_URL="https://brain-dump-production-895b.up.railway.app"

echo "🔐 Step 1: Login to get token"
echo "Enter your email:"
read EMAIL
echo "Enter your password:"
read -s PASSWORD

TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Please check your credentials."
  exit 1
fi

echo "✅ Logged in successfully!"
echo ""

# Function to create atomic object
create_object() {
  local content="$1"
  local category="$2"

  echo "📝 Creating: $content"

  RESPONSE=$(curl -s -X POST "$API_URL/api/v1/objects" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": \"$content\",
      \"category\": [\"$category\"],
      \"sourceType\": \"text\",
      \"confidence\": 0.95
    }")

  OBJECT_ID=$(echo $RESPONSE | jq -r '.object.id')

  if [ "$OBJECT_ID" != "null" ]; then
    echo "   ✅ Created object: $OBJECT_ID"
  else
    echo "   ❌ Failed: $(echo $RESPONSE | jq -r '.message')"
  fi
}

echo "🚀 Step 2: Creating test atomic objects..."
echo ""

# Fitness objects
create_object "I need to go to the gym 3 times this week and focus on upper body strength training" "Fitness"
create_object "My workout goal is to bench press 200 pounds by end of March" "Fitness"
create_object "Started a new running routine - 5K three times a week in the morning" "Fitness"

# Business objects
create_object "Schedule a meeting with the product team to discuss Q2 roadmap and priorities" "Business"
create_object "Need to finish the quarterly report by Friday and send it to stakeholders" "Business"
create_object "Interview candidates for the senior developer position next Tuesday at 2pm" "Business"

# Personal objects
create_object "Plan a weekend trip to the mountains for hiking and camping with friends" "Personal"
create_object "Call mom on Sunday to catch up and wish her happy birthday" "Personal"
create_object "Read the new sci-fi book that Sarah recommended, looks really interesting" "Personal"

# Health objects
create_object "Doctor appointment scheduled for next Monday at 10am for annual checkup" "Health"
create_object "Need to pick up prescription from pharmacy before they close" "Health"

# Family objects
create_object "Kids soccer game on Saturday morning at 9am, need to bring snacks" "Family"
create_object "Anniversary dinner reservation at the Italian restaurant downtown" "Family"

echo ""
echo "🎉 Step 3: Test data created successfully!"
echo ""
echo "🧪 Now you can test:"
echo "1. Open SearchScreen in mobile app"
echo "2. Search for 'workout' or 'gym' or 'meeting'"
echo "3. Try AI Query: 'What are my fitness goals?'"
echo "4. Try AI Query: 'What do I need to do this week?'"
echo ""
echo "✅ Embeddings will be generated automatically!"
