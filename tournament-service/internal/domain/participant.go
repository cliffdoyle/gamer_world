package domain

import (
	"time"
	"errors"

	"github.com/google/uuid"
)

// internal/domain/errors.go (or similar)
var ErrAlreadyParticipant = errors.New("user is already a participant in this tournament")

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
	ID              uuid.UUID         `json:"id"`
	TournamentID    uuid.UUID         `json:"tournament_id"`
	UserID          *uuid.UUID        `json:"user_id,omitempty"`
	ParticipantName string            `json:"participant_name"`
	Seed            int               `json:"seed"`
	Status          ParticipantStatus `json:"status"`
	IsWaitlisted    bool              `json:"is_waitlisted"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

// ParticipantRequest represents the data needed to register a participant
type ParticipantRequest struct {
	UserID          *uuid.UUID `json:"user_id,omitempty"`
	ParticipantName string     `json:"participant_name" binding:"required"`
	Seed            *int       `json:"seed,omitempty"`
}

// ParticipantResponse represents the data returned to clients
type ParticipantResponse struct {
	ID              uuid.UUID         `json:"id"`
	TournamentID    uuid.UUID         `json:"tournament_id"`
	UserID          *uuid.UUID        `json:"user_id,omitempty"`
	ParticipantName string            `json:"participant_name"`
	Seed            int               `json:"seed"`
	Status          ParticipantStatus `json:"status"`
	IsWaitlisted    bool              `json:"is_waitlisted"`
	CreatedAt       time.Time         `json:"created_at"`
}
