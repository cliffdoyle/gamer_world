package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// TournamentFormat defines the structure of a tournament
type TournamentFormat string

// Tournament formats
const (
	SingleElimination TournamentFormat = "SINGLE_ELIMINATION"
	DoubleElimination TournamentFormat = "DOUBLE_ELIMINATION"
	RoundRobin        TournamentFormat = "ROUND_ROBIN"
	Swiss             TournamentFormat = "SWISS"
)

// TournamentStatus defines the current state of a tournament
type TournamentStatus string

// Tournament statuses
const (
	Draft        TournamentStatus = "DRAFT"
	Registration TournamentStatus = "REGISTRATION"
	InProgress   TournamentStatus = "IN_PROGRESS"
	Completed    TournamentStatus = "COMPLETED"
	Cancelled    TournamentStatus = "CANCELLED"
)

// Tournament represents a gaming tournament
type Tournament struct {
	ID                   uuid.UUID              `json:"id"`
	Name                 string                 `json:"name"`
	Description          string                 `json:"description"`
	Game                 string                 `json:"game"`
	Format               TournamentFormat       `json:"format"`
	Status               TournamentStatus       `json:"status"`
	MaxParticipants      int                    `json:"max_participants"`
	RegistrationDeadline *time.Time             `json:"registration_deadline"`
	StartTime            *time.Time             `json:"start_time"`
	EndTime              *time.Time             `json:"end_time"`
	CreatedBy            uuid.UUID              `json:"created_by"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
	Rules                string                 `json:"rules"`
	PrizePool            json.RawMessage `json:"prize_pool,omitempty"` // <--- CHANGE THIS
    CustomFields         json.RawMessage `json:"custom_fields,omitempty"`// Assuming this is also flexible JSON
}


// CreateTournamentRequest represents the data needed to create a tournament
type CreateTournamentRequest struct {
	Name                string           `json:"name" binding:"required"`
	Description         string           `json:"description"`
	Game                string           `json:"game" binding:"required"`
	Format              TournamentFormat `json:"format"`
	MaxParticipants     int              `json:"max_participants"`
	RegistrationDeadline *time.Time      `json:"registration_deadline"`
	StartTime           *time.Time       `json:"start_time"`
	Rules               string           `json:"rules"`
	PrizePool            json.RawMessage `json:"prize_pool,omitempty"` // <--- CHANGE THIS
    CustomFields         json.RawMessage `json:"custom_fields,omitempty"`// Assuming this is also flexible JSON
}

// UpdateTournamentRequest represents the data for updating a tournament
type UpdateTournamentRequest struct {
	Name                string           `json:"name"`
	Description         string           `json:"description"`
	Game                string           `json:"game"`
	Format              TournamentFormat `json:"format"`
	MaxParticipants     int              `json:"max_participants"`
	RegistrationDeadline *time.Time      `json:"registration_deadline"`
	StartTime           *time.Time       `json:"start_time"`
	Rules               string           `json:"rules"`
	PrizePool            json.RawMessage `json:"prize_pool,omitempty"` // <--- CHANGE THIS
    CustomFields         json.RawMessage `json:"custom_fields,omitempty"`// Assuming this is also flexible JSON
}

// TournamentResponse represents the data returned to clients
type TournamentResponse struct {
	ID                  uuid.UUID        `json:"id"`
	Name                string           `json:"name"`
	Description         string           `json:"description"`
	Game                string           `json:"game"`
	Format              TournamentFormat `json:"format"`
	Status              TournamentStatus `json:"status"`
	MaxParticipants     int              `json:"max_participants"`
	CurrentParticipants int              `json:"currentParticipants"`
	RegistrationDeadline *time.Time      `json:"registrationDeadline"`
	StartTime           *time.Time       `json:"startTime"`
	EndTime             *time.Time       `json:"endTime"`
	CreatedAt           time.Time        `json:"createdAt"`
	Rules               string           `json:"rules"`
    PrizePool            json.RawMessage `json:"prizePool,omitempty"` // <--- CHANGE THIS
    CustomFields         json.RawMessage `json:"customFields,omitempty"`// Assuming this is also flexible JSON
}
