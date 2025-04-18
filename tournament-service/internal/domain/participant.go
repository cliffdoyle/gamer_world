package domain

import (
	"time"

	"github.com/google/uuid"
)

// Participant represents a user registered in a tournament
type Participant struct {
	ID           uuid.UUID  `json:"id"`
	TournamentID uuid.UUID  `json:"tournament_id"`
	UserID       uuid.UUID  `json:"user_id"`
	TeamName     string     `json:"team_name"`
	Seed         int        `json:"seed"`
	CheckInTime  *time.Time `json:"check_in_time"`
	IsCheckedIn  bool       `json:"is_checked_in"`
	CreatedAt    time.Time  `json:"created_at"`
}

// ParticipantRequest represents the data needed to register for a tournament
type ParticipantRequest struct {
	UserID   uuid.UUID `json:"user_id" binding:"required"`
	TeamName string    `json:"team_name"`
}

// ParticipantResponse represents participant data returned to clients
type ParticipantResponse struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"` // This would be populated from user service
	TeamName    string    `json:"team_name"`
	IsCheckedIn bool      `json:"is_checked_in"`
	Seed        int       `json:"seed"`
}
