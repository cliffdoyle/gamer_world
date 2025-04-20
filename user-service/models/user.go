package models

import (
	"github.com/google/uuid"
)

type User struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Password string    `json:"password"`
}

// NewUser creates a new user with a generated UUID
func NewUser(username, password string) *User {
	return &User{
		ID:       uuid.New(),
		Username: username,
		Password: password,
	}
}
