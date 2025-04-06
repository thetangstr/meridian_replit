#!/bin/bash

# Make script executable
chmod +x test.sh

# Set colors for pretty output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}📋 Running Meridian Test Suite${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Create test-data directory if it doesn't exist
mkdir -p __tests__/test-data

# Function to run tests
run_tests() {
  local pattern=$1
  local description=$2
  
  echo -e "\n${BLUE}=== Running $description ===${NC}\n"
  npx jest $pattern --colors
  
  if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ $description passed!${NC}\n"
    return 0
  else
    echo -e "\n${RED}❌ $description failed!${NC}\n"
    return 1
  fi
}

# Define test suites
declare -a test_suites=(
  "__tests__/api/auth.test.ts:Authentication API Tests"
  "__tests__/api/reviews.test.ts:Reviews API Tests"
  "__tests__/api/media.test.ts:Media API Tests"
  "__tests__/api/cuj-sync.test.ts:CUJ Sync API Tests"
  "__tests__/unit/scoring.test.ts:Scoring Unit Tests"
  "__tests__/e2e/login.test.ts:Login E2E Tests"
  "__tests__/e2e/review-workflow.test.ts:Review Workflow E2E Tests"
  "__tests__/e2e/media-capture.test.ts:Media Capture E2E Tests"
)

# Print test count
echo -e "Total test suites: ${#test_suites[@]}"

# Run all test suites and track results
passed_suites=0

for suite in "${test_suites[@]}"; do
  IFS=':' read -r pattern description <<< "$suite"
  run_tests "$pattern" "$description"
  if [ $? -eq 0 ]; then
    ((passed_suites++))
  fi
done

# Print final summary
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}📊 Test Summary: $passed_suites/${#test_suites[@]} suites passed${NC}"
echo -e "${BLUE}=====================================${NC}\n"

# Exit with appropriate code
if [ $passed_suites -eq ${#test_suites[@]} ]; then
  exit 0
else
  exit 1
fi