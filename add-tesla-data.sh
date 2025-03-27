#!/bin/bash

# Set the API base URL
API_BASE="http://localhost:3000/api"

# Login first to get session cookie
echo "Logging in as reviewer..."
COOKIE_JAR="cookies.txt"
curl -s -c "$COOKIE_JAR" -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "reviewer",
    "password": "review123"
  }'

# Function to make authenticated API calls
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  
  if [ -n "$data" ]; then
    curl -s -b "$COOKIE_JAR" -X "$method" "$API_BASE$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -b "$COOKIE_JAR" -X "$method" "$API_BASE$endpoint" \
      -H "Content-Type: application/json"
  fi
}

# Add Tesla Model 3 car
echo "Adding Tesla Model 3 car..."
CAR_DATA='{
  "make": "Tesla",
  "model": "Model 3",
  "year": 2023,
  "androidVersion": "12",
  "buildFingerprint": "tesla/model3/autopilot:12/TM3V.2023.44.25.2/factory-keys",
  "location": "Fremont, CA",
  "imageUrl": "https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Mega-Menu-Vehicles-Model-3.png"
}'
CAR_RESPONSE=$(api_call "POST" "/cars" "$CAR_DATA")

# Extract car ID from response
CAR_ID=$(echo $CAR_RESPONSE | sed -n 's/.*"id":\([0-9]*\).*/\1/p')

if [ -z "$CAR_ID" ]; then
  echo "Failed to create car or get car ID."
  echo "API Response: $CAR_RESPONSE"
  exit 1
fi

echo "Created Tesla Model 3 with ID: $CAR_ID"

# Create a review for the car
echo "Creating review for Tesla Model 3..."
# Get current date and one week later for endDate
CURRENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
END_DATE=$(date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%S.000Z")

REVIEW_DATA="{
  \"carId\": $CAR_ID,
  \"reviewerId\": 2,
  \"status\": \"in_progress\"
}"
REVIEW_RESPONSE=$(api_call "POST" "/reviews" "$REVIEW_DATA")

# Extract review ID from response
REVIEW_ID=$(echo $REVIEW_RESPONSE | sed -n 's/.*"id":\([0-9]*\).*/\1/p')

if [ -z "$REVIEW_ID" ]; then
  echo "Failed to create review or get review ID."
  echo "API Response: $REVIEW_RESPONSE"
  exit 1
fi

echo "Created review with ID: $REVIEW_ID"

# Get tasks for this review
echo "Getting tasks for review..."
TASKS_RESPONSE=$(api_call "GET" "/reviews/$REVIEW_ID/tasks")

# Create a few task evaluations
echo "Creating task evaluations..."
for TASK_ID in $(echo $TASKS_RESPONSE | grep -o '"id":[0-9]*' | head -10 | cut -d':' -f2); do
  # Generate random scores between 3-5
  USABILITY_SCORE=$((RANDOM % 3 + 3))
  VISUALS_SCORE=$((RANDOM % 3 + 3))
  
  EVAL_DATA="{
    \"doable\": true,
    \"undoableReason\": null,
    \"usabilityScore\": $USABILITY_SCORE,
    \"usabilityFeedback\": \"Interface is very intuitive and responsive\",
    \"visualsScore\": $VISUALS_SCORE,
    \"visualsFeedback\": \"Clean design with good contrast and readability\"
  }"
  EVAL_RESPONSE=$(api_call "POST" "/reviews/$REVIEW_ID/tasks/$TASK_ID/evaluations" "$EVAL_DATA")
  
  echo "Created evaluation for task $TASK_ID"
done

# Create category evaluations
echo "Creating category evaluations..."
for CATEGORY_ID in 1 2 3 4; do
  # Generate random scores between 3-4
  RESP_SCORE=$((RANDOM % 2 + 3))
  WRITING_SCORE=$((RANDOM % 2 + 3))
  EMOTIONAL_SCORE=$((RANDOM % 2 + 3))
  
  CAT_EVAL_DATA="{
    \"responsivenessScore\": $RESP_SCORE,
    \"responsivenessFeedback\": \"System responds quickly to user input with minimal lag\",
    \"writingScore\": $WRITING_SCORE,
    \"writingFeedback\": \"Text is clear and easy to understand\",
    \"emotionalScore\": $EMOTIONAL_SCORE,
    \"emotionalFeedback\": \"Interface feels premium and consistent with Tesla brand\"
  }"
  CAT_EVAL_RESPONSE=$(api_call "POST" "/reviews/$REVIEW_ID/categories/$CATEGORY_ID/evaluations" "$CAT_EVAL_DATA")
  
  echo "Created evaluation for category $CATEGORY_ID"
done

echo "Tesla Model 3 data population complete. Review ID: $REVIEW_ID"