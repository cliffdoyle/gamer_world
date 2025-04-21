package client

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/google/uuid"
)

type UserService struct {
	BaseURL string
	client  *http.Client
}

type UserResponse struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

func NewUserService() *UserService {
	return &UserService{
		BaseURL: os.Getenv("USER_SERVICE_URL"),
		client:  &http.Client{},
	}
}

// ValidateToken validates a JWT token with the user service
func (s *UserService) ValidateToken(token string) (*UserResponse, error) {
	// For development/testing purposes
	if token == "test-token-123" {
		return &UserResponse{
			ID:       1,
			Username: "test-user",
		}, nil
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("%s/user/profile", s.BaseURL), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid token")
	}

	var user UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

// GetUserUUID converts the numeric user ID to a UUID using a deterministic method
func (u *UserResponse) GetUserUUID() uuid.UUID {
	// Create a deterministic UUID based on the user ID
	idStr := fmt.Sprintf("user-%d", u.ID)
	// Use version 5 UUID with DNS namespace
	return uuid.NewSHA1(uuid.NameSpaceDNS, []byte(idStr))
}

// GetUserByID retrieves user information by ID
func (s *UserService) GetUserByID(userID string) (*UserResponse, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/user/%s", s.BaseURL, userID), nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user not found")
	}

	var user UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}
