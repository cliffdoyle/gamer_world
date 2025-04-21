#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Base URL
BASE_URL="http://localhost:8082"

# Function to log in and get token
get_token() {
    local response=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "admin",
            "email": "admin@example.com",
            "password": "admin123"
        }')
    echo $(echo $response | jq -r '.token')
}

# Function to create tournament
create_tournament() {
    local token=$1
    local max_participants=$2
    local response=$(curl -s -X POST "${BASE_URL}/tournaments" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        -d "{
            \"name\": \"Test Tournament ${max_participants}\",
            \"game\": \"Test Game\",
            \"format\": \"SINGLE_ELIMINATION\",
            \"maxParticipants\": ${max_participants},
            \"registrationDeadline\": \"2024-12-31T23:59:59Z\",
            \"startTime\": \"2025-01-01T00:00:00Z\"
        }")
    echo $(echo $response | jq -r '.id')
}

# Function to update tournament status
update_tournament_status() {
    local token=$1
    local tournament_id=$2
    local status=$3
    curl -s -X PUT "${BASE_URL}/tournaments/${tournament_id}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        -d "{
            \"status\": \"${status}\"
        }"
}

# Function to register participants
register_participants() {
    local token=$1
    local tournament_id=$2
    local num_participants=$3
    
    for i in $(seq 1 $num_participants); do
        curl -s -X POST "${BASE_URL}/tournaments/${tournament_id}/participants" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${token}" \
            -d "{
                \"teamName\": \"Team ${i}\"
            }"
        echo "Registered Team ${i}"
    done
}

# Function to generate bracket
generate_bracket() {
    local token=$1
    local tournament_id=$2
    curl -s -X POST "${BASE_URL}/tournaments/${tournament_id}/bracket" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}"
}

# Function to get matches
get_matches() {
    local token=$1
    local tournament_id=$2
    curl -s -X GET "${BASE_URL}/tournaments/${tournament_id}/matches" \
        -H "Authorization: Bearer ${token}" | jq '.'
}

# Main test function
test_tournament() {
    local num_participants=$1
    echo -e "${GREEN}Testing tournament with ${num_participants} participants${NC}"
    
    # Get token
    TOKEN=$(get_token)
    if [ -z "$TOKEN" ]; then
        echo -e "${RED}Failed to get token${NC}"
        return 1
    fi
    echo "Got authentication token"
    
    # Create tournament
    TOURNAMENT_ID=$(create_tournament "$TOKEN" "$num_participants")
    if [ -z "$TOURNAMENT_ID" ]; then
        echo -e "${RED}Failed to create tournament${NC}"
        return 1
    fi
    echo "Created tournament with ID: $TOURNAMENT_ID"
    
    # Update status to REGISTRATION
    update_tournament_status "$TOKEN" "$TOURNAMENT_ID" "REGISTRATION"
    echo "Updated tournament status to REGISTRATION"
    
    # Register participants
    register_participants "$TOKEN" "$TOURNAMENT_ID" "$num_participants"
    echo "Registered $num_participants participants"
    
    # Generate bracket
    generate_bracket "$TOKEN" "$TOURNAMENT_ID"
    echo "Generated bracket"
    
    # Get and display matches
    echo "Tournament matches:"
    get_matches "$TOKEN" "$TOURNAMENT_ID"
    
    echo -e "${GREEN}Test completed successfully${NC}"
    echo "----------------------------------------"
}

# Run tests with different numbers of participants
test_tournament 4
test_tournament 8
test_tournament 16 