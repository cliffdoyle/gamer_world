package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io" // For io.ReadAll
	"log"
	"net/http"
	"os"
	"time" // For client timeout

	"github.com/google/uuid"
)

// UserService handles communication with the User Service.
type UserService struct {
	BaseURL string
	client  *http.Client
}

// UserProfileData matches the structure of the "user" object returned by User Service's /user/profile.
// This struct will be used to decode the nested "user" object.
type UserProfileData struct {
	ID          uuid.UUID `json:"id"` // User Service returns UUID as string, json unmarshal handles it
	Username    string    `json:"username"`
	Email       string    `json:"email,omitempty"`
	DisplayName string    `json:"display_name,omitempty"`
	// Add any other fields from the User Service's /user/profile response that you might need
}

// ValidateTokenResponse is used to unmarshal the full response from /user/profile,
// which has the UserProfileData nested under a "user" key.
type ValidateTokenResponse struct {
	User UserProfileData `json:"user"`
}

// NewUserService creates a new client for the User Service.
func NewUserService() *UserService {
	baseURL := os.Getenv("USER_SERVICE_URL")
	if baseURL == "" {
		log.Println("Warning: USER_SERVICE_URL environment variable is not set. User service client might not function correctly.")
		// You might want to return an error or have a default for local dev
		// return nil, fmt.Errorf("USER_SERVICE_URL is not set")
	}
	return &UserService{
		BaseURL: baseURL,
		client:  &http.Client{Timeout: 10 * time.Second}, // Added a timeout
	}
}

// ValidateToken validates a JWT token by calling the User Service's /user/profile endpoint.
// It now returns the UserProfileData which includes the correct uuid.UUID.
func (s *UserService) ValidateToken(token string) (*UserProfileData, error) {
	if s.BaseURL == "" {
		return nil, fmt.Errorf("user service BaseURL is not configured")
	}

	// The "test-token-123" logic is problematic because it returns a numeric ID,
	// while the real flow should return UUIDs. It's better to remove it or make it
	// also return a UserProfileData with a known test UUID if truly needed for isolated tests.
	// For now, let's assume we always call the actual service.
	/*
		if token == "test-token-123" {
			// This part is inconsistent with the actual /user/profile response.
			// If you need a test mode, it should mock UserProfileData.
			log.Println("ValidateToken: Using hardcoded test-token-123. This is for development only.")
			testUUID := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("user-1")) // ffbe...
			return &UserProfileData{
				ID:       testUUID,
				Username: "test-user",
			}, nil
		}
	*/

	profileURL := fmt.Sprintf("%s/user/profile", s.BaseURL)
	req, err := http.NewRequest("GET", profileURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request to %s: %w", profileURL, err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Content-Type", "application/json") // Good practice, though GET might not need it

	log.Printf("[client.UserService.ValidateToken] Sending GET to %s", profileURL)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call %s: %w", profileURL, err)
	}
	defer resp.Body.Close()

	log.Printf("[client.UserService.ValidateToken] Received status %d from %s", resp.StatusCode, profileURL)

	bodyBytes, _ := io.ReadAll(resp.Body) // Read body for logging in case of error
	// Restore body for json.NewDecoder
	resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))


	if resp.StatusCode != http.StatusOK {
		log.Printf("[client.UserService.ValidateToken] Error: User service returned status %d. Body: %s", resp.StatusCode, string(bodyBytes))
		return nil, fmt.Errorf("user service token validation failed with status %d", resp.StatusCode)
	}

	var validationResponse ValidateTokenResponse // To decode the {"user": {...}} structure
	if err := json.NewDecoder(resp.Body).Decode(&validationResponse); err != nil {
		log.Printf("[client.UserService.ValidateToken] Error decoding response body: %v. Body: %s", err, string(bodyBytes))
		return nil, fmt.Errorf("failed to decode user profile response: %w", err)
	}

	// The actual user data is in validationResponse.User
	log.Printf("[client.UserService.ValidateToken] Successfully validated token, UserID: %s, Username: %s",
		validationResponse.User.ID, validationResponse.User.Username)

	return &validationResponse.User, nil
}

// GetUserUUID is now a method of UserProfileData if needed, or just use .ID directly.
// Since ValidateToken now returns *UserProfileData which contains the uuid.UUID,
// the old GetUserUUID method on the old UserResponse is no longer directly applicable
// in the same way. The caller of ValidateToken will get the UUID directly from result.ID.

// Example: If you still need a GetUserUUID method on UserProfileData for some reason:
func (u *UserProfileData) GetUserUUID() uuid.UUID {
	return u.ID // The ID is already a UUID
}

// GetUserByID is likely not needed in tournament-service if ValidateToken serves the purpose
// for getting the authenticated user's details. If you *do* need a generic GetUserByID,
// it should also be updated to expect UserProfileData.
/*
func (s *UserService) GetUserByID(userID uuid.UUID) (*UserProfileData, error) {
    if s.BaseURL == "" {
        return nil, fmt.Errorf("user service BaseURL is not configured")
    }
    // Assuming user-service has an endpoint like /users/{uuid}
    url := fmt.Sprintf("%s/users/%s", s.BaseURL, userID.String())
    req, err := http.NewRequest("GET", url, nil)
    // ... (similar HTTP request logic as ValidateToken) ...
    // ... decode into UserProfileData ...
}
*/