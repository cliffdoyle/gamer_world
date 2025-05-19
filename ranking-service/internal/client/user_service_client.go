package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url" // For robust URL joining
	"time"

	"github.com/google/uuid"
)

// UserDetails defines the structure we expect back from the User Service
// for each user when fetching batch details.
type UserDetails struct {
	ID          uuid.UUID `json:"id"` // User Service returns UUID as string, json unmarshal handles it
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name,omitempty"` // Add DisplayName
}

// UserServiceClient defines the interface for interacting with an external User Service.
type UserServiceClient interface {
	// GetUserDetails is removed as we are focusing on batch for leaderboard.
	// If you need single user lookup from ranking to user service, you can add it back.
	GetMultipleUserDetails(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]UserDetails, error)
}

// httpUserServiceClient implements UserServiceClient using HTTP.
type httpUserServiceClient struct {
	baseURL *url.URL // Store as parsed URL
	client  *http.Client
	// interServiceKey string
}

// NewHTTPUserServiceClient creates a new HTTP client for the User Service.
// It now returns an error if the baseURL is invalid.
func NewHTTPUserServiceClient(baseURLStr string /*, interServiceKey string */) (UserServiceClient, error) {
	if baseURLStr == "" {
		// Return an error instead of just logging, so the calling code knows initialization failed.
		return nil, fmt.Errorf("USER_SERVICE_URL is not set for HTTPUserServiceClient")
	}
	parsedBaseURL, err := url.Parse(baseURLStr)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL '%s' for user service client: %w", baseURLStr, err)
	}

	return &httpUserServiceClient{
		baseURL: parsedBaseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		// interServiceKey: interServiceKey,
	}, nil
}

// GetMultipleUserDetails fetches details for multiple users from the User Service.
func (c *httpUserServiceClient) GetMultipleUserDetails(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]UserDetails, error) {
	if c.baseURL == nil { // Check if client was properly initialized
		return nil, fmt.Errorf("user service client not properly initialized (baseURL is nil)")
	}
	if len(userIDs) == 0 {
		return make(map[uuid.UUID]UserDetails), nil
	}

	// The User Service endpoint expects UUIDs as strings in the JSON payload
	userIDStrings := make([]string, len(userIDs))
	for i, id := range userIDs {
		userIDStrings[i] = id.String()
	}

	requestBodyPayload := struct {
		UserIDs []string `json:"user_ids"` // Send UUIDs as strings
	}{UserIDs: userIDStrings}

	payloadBytes, err := json.Marshal(requestBodyPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal user IDs for batch request: %w", err)
	}

	// Construct the target URL robustly
	endpointPath := "/users/batch" // This is the path your User Service is listening on
	targetURL := c.baseURL.ResolveReference(&url.URL{Path: endpointPath})

	log.Printf("[UserServiceClient] Sending batch user details request to: %s with %d userIDs", targetURL.String(), len(userIDStrings))

	req, err := http.NewRequestWithContext(ctx, "POST", targetURL.String(), bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create batch request to user service (%s): %w", targetURL.String(), err)
	}
	req.Header.Set("Content-Type", "application/json")
	// req.Header.Set("X-Internal-Service-Key", c.interServiceKey) // If using inter-service auth

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call user service for batch user details (%s): %w", targetURL.String(), err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[UserServiceClient] Error response from User Service (%s) - Status: %d, Body: %s", targetURL.String(), resp.StatusCode, string(bodyBytes))
		return nil, fmt.Errorf("user service returned error for batch request: status %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	// Expecting response like: {"users": {"uuid1_str": {"id":"uuid1_str", "username":"u1", "display_name":"dn1"}, ...}}
	var serviceResponse struct {
		Users map[string]UserDetails `json:"users"` // Keys are UUID strings, values are UserDetails
	}

	if err := json.NewDecoder(resp.Body).Decode(&serviceResponse); err != nil {
		return nil, fmt.Errorf("failed to decode batch user service response: %w", err)
	}

	// Convert the map[string]UserDetails to map[uuid.UUID]UserDetails
	results := make(map[uuid.UUID]UserDetails, len(serviceResponse.Users))
	for userIDStr, userDetail := range serviceResponse.Users {
		parsedUUID, parseErr := uuid.Parse(userIDStr)
		if parseErr != nil {
			log.Printf("[UserServiceClient] Warning: Could not parse UUID string key '%s' from user service response: %v", userIDStr, parseErr)
			continue // Skip this entry
		}
		// Ensure the ID within the UserDetails struct also matches the key, or trust the User Service's structure
        if userDetail.ID == uuid.Nil || userDetail.ID != parsedUUID { // Optional: Validate/Assign ID from key if needed
            userDetail.ID = parsedUUID
        }
		results[parsedUUID] = userDetail
	}

	log.Printf("[UserServiceClient] Successfully received and decoded %d user details from User Service.", len(results))
	return results, nil
}