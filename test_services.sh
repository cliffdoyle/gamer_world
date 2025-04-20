#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BLUE='\033[0;34m'

# Test endpoints
USER_SERVICE="http://localhost:8081"
TOURNAMENT_SERVICE="http://localhost:8082"

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Function to check if a service is running
check_service() {
    if curl -s "$1/health" > /dev/null; then
        echo -e "${GREEN}✓ Service at $1 is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Service at $1 is not running${NC}"
        return 1
    fi
}

# Function to make HTTP requests and check responses
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local auth_header=$4
    local expected_status=$5
    local description=$6

    echo -e "\nTesting: $description"
    echo "Request: $method $url"
    if [ ! -z "$data" ]; then
        echo "Data: $data"
    fi

    local headers="-H 'Content-Type: application/json'"
    if [ ! -z "$auth_header" ]; then
        headers="$headers -H 'Authorization: Bearer $auth_header'"
    fi

    local response
    if [ "$method" = "GET" ]; then
        if [ -z "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" "$url")
        else
            response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $auth_header" "$url")
        fi
    else
        if [ -z "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_header" -d "$data" "$url")
        fi
    fi

    local status_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ Status code matches expected: $status_code${NC}"
        echo "Response: $body"
        echo "$body" # Return the response body
    else
        echo -e "${RED}✗ Status code $status_code does not match expected: $expected_status${NC}"
        echo "Response: $body"
        return 1
    fi
}

# Check if services are running
print_header "Checking Services"
check_service $USER_SERVICE || exit 1
check_service $TOURNAMENT_SERVICE || exit 1

# Test user registration
echo "Testing user registration..."
RESPONSE=$(curl -s -X POST $USER_SERVICE/register -H "Content-Type: application/json" -d '{"username": "testuser", "password": "testpass123"}')
TOKEN=$(echo $RESPONSE | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "Failed to get token from registration"
    exit 1
fi

echo "Got token: ${TOKEN:0:20}..."

# Test user profile operations
print_header "Testing User Service - Profile Operations"
test_endpoint "GET" "$USER_SERVICE/profile" "" "$TOKEN" 200 "Get User Profile"
test_endpoint "PUT" "$USER_SERVICE/profile" '{"username":"testuser2"}' "$TOKEN" 200 "Update User Profile"

# Test tournament creation
echo "Testing tournament creation..."
curl -s -X POST $TOURNAMENT_SERVICE/tournaments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name": "Test Tournament", "description": "A test tournament", "game": "Chess", "format": "SINGLE_ELIMINATION", "max_participants": 8}'

# Test tournament listing
echo -e "\nTesting tournament listing..."
curl -s $TOURNAMENT_SERVICE/tournaments | jq '.tournaments[]'

# Test tournament operations
print_header "Testing Tournament Service - Tournament Operations"
tournament_response=$(test_endpoint "GET" "$TOURNAMENT_SERVICE/tournaments/$tournament_id" "" "$TOKEN" 200 "Get Tournament Details")
tournament_id=$(echo "$tournament_response" | jq -r '.id')

if [ -z "$tournament_id" ] || [ "$tournament_id" = "null" ]; then
    echo -e "${RED}✗ Failed to get tournament ID${NC}"
    exit 1
fi

test_endpoint "POST" "$TOURNAMENT_SERVICE/tournaments/$tournament_id/participants" '{"seed": 1}' "$TOKEN" 201 "Register Participant"
test_endpoint "PUT" "$TOURNAMENT_SERVICE/tournaments/$tournament_id/status" '{"status":"REGISTRATION"}' "$TOKEN" 200 "Update Tournament Status"

# Cleanup
print_header "Testing Cleanup"
test_endpoint "DELETE" "$TOURNAMENT_SERVICE/tournaments/$tournament_id" "" "$TOKEN" 204 "Delete Tournament"
test_endpoint "DELETE" "$USER_SERVICE/profile" "" "$TOKEN" 200 "Delete User Account"

echo -e "\n${GREEN}All tests completed successfully!${NC}" 