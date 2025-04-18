package domain

import (
	"time"

	"github.com/google/uuid"
)

// ParticipantStatus defines the current state of a participant
type ParticipantStatus string

// Participant statuses
const (
	ParticipantRegistered ParticipantStatus = "REGISTERED"
	ParticipantWaitlisted ParticipantStatus = "WAITLISTED"
	ParticipantCheckedIn  ParticipantStatus = "CHECKED_IN"
	ParticipantEliminated ParticipantStatus = "ELIMINATED"
)

// Participant represents a tournament participant
type Participant struct {
	ID           uuid.UUID         `json:"id"`
	TournamentID uuid.UUID         `json:"tournament_id"`
	UserID       uuid.UUID         `json:"user_id"`
	Seed         int               `json:"seed"`
	Status       ParticipantStatus `json:"status"`
	IsWaitlisted bool              `json:"is_waitlisted"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// ParticipantRequest represents the data needed to register a participant
type ParticipantRequest struct {
	UserID uuid.UUID `json:"user_id" binding:"required"`
	Seed   int       `json:"seed"`
}

// ParticipantResponse represents the data returned to clients
type ParticipantResponse struct {
	ID           uuid.UUID         `json:"id"`
	TournamentID uuid.UUID         `json:"tournament_id"`
	UserID       uuid.UUID         `json:"user_id"`
	Seed         int               `json:"seed"`
	Status       ParticipantStatus `json:"status"`
	IsWaitlisted bool              `json:"is_waitlisted"`
	CreatedAt    time.Time         `json:"created_at"`
}
