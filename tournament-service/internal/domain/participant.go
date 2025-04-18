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
