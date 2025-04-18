package domain

import (
	"time"
	
	"github.com/google/uuid"
)

// Message represents a chat message in a tournament
type Message struct {
	ID          uuid.UUID `json:"id"`
	TournamentID uuid.UUID `json:"tournament_id"`
	UserID      uuid.UUID `json:"user_id"`
	Message     string    `json:"message"`
	CreatedAt   time.Time `json:"created_at"`
}

// MessageRequest represents data for creating a new message
type MessageRequest struct {
	Message string `json:"message" binding:"required"`
}

// MessageResponse represents message data returned to clients
type MessageResponse struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Username  string    `json:"username"` // This would be populated from user service
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}