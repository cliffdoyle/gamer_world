package domain

import (
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
	PrizePool            map[string]interface{} `json:"prize_pool"`
	CustomFields         map[string]interface{} `json:"custom_fields"`
}
