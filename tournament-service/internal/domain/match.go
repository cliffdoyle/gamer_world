package domain

import (
	"time"

	"github.com/google/uuid"
)

// MatchStatus defines the current state of a match
type MatchStatus string

// Match statuses
const (
	MatchPending    MatchStatus = "PENDING"
	MatchInProgress MatchStatus = "IN_PROGRESS"
	MatchCompleted  MatchStatus = "COMPLETED"
	MatchDisputed   MatchStatus = "DISPUTED"
)

// Match represents a single match in a tournament
type Match struct {
	ID                uuid.UUID              `json:"id"`
	TournamentID      uuid.UUID              `json:"tournament_id"`
	Round             int                    `json:"round"`
	MatchNumber       int                    `json:"match_number"`
	Participant1ID    *uuid.UUID             `json:"participant1_id"`
	Participant2ID    *uuid.UUID             `json:"participant2_id"`
	WinnerID          *uuid.UUID             `json:"winner_id"`
	LoserID           *uuid.UUID             `json:"loser_id"`
	ScoreParticipant1 int                    `json:"score_participant1"`
	ScoreParticipant2 int                    `json:"score_participant2"`
	Status            MatchStatus            `json:"status"`
	ScheduledTime     *time.Time             `json:"scheduled_time"`
	CompletedTime     *time.Time             `json:"completed_time"`
	NextMatchID       *uuid.UUID             `json:"next_match_id"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
	MatchNotes        string                 `json:"match_notes"`
	MatchProofs       map[string]interface{} `json:"match_proofs"`
}

// ScoreUpdateRequest represents the data for reporting a match score
type ScoreUpdateRequest struct {
	ScoreParticipant1 int                    `json:"score_participant1" binding:"required"`
	ScoreParticipant2 int                    `json:"score_participant2" binding:"required"`
	MatchNotes        string                 `json:"match_notes"`
	MatchProofs       map[string]interface{} `json:"match_proofs"`
}

// MatchResponse represents match data returned to clients
type MatchResponse struct {
	ID                uuid.UUID              `json:"id"`
	TournamentID      uuid.UUID              `json:"tournament_id"`
	Round             int                    `json:"round"`
	MatchNumber       int                    `json:"match_number"`
	Participant1ID    *uuid.UUID             `json:"participant1_id"`
	Participant2ID    *uuid.UUID             `json:"participant2_id"`
	WinnerID          *uuid.UUID             `json:"winner_id"`
	LoserID           *uuid.UUID             `json:"loser_id"`
	ScoreParticipant1 int                    `json:"score_participant1"`
	ScoreParticipant2 int                    `json:"score_participant2"`
	Status            MatchStatus            `json:"status"`
	ScheduledTime     *time.Time             `json:"scheduled_time"`
	CompletedTime     *time.Time             `json:"completed_time"`
	NextMatchID       *uuid.UUID             `json:"next_match_id"`
	CreatedAt         time.Time              `json:"created_at"`
	MatchNotes        string                 `json:"match_notes"`
	MatchProofs       map[string]interface{} `json:"match_proofs"`
}
