package domain

import (
	"time"

	"github.com/google/uuid"
)

// MatchStatus represents the current state of a match
type MatchStatus string

const (
	MatchPending    MatchStatus = "PENDING"
	MatchInProgress MatchStatus = "IN_PROGRESS"
	MatchCompleted  MatchStatus = "COMPLETED"
	MatchCancelled  MatchStatus = "CANCELLED"
)

// Match represents a tournament match
type Match struct {
	ID                uuid.UUID   `json:"id"`
	TournamentID      uuid.UUID   `json:"tournament_id"`
	Round             int         `json:"round"`
	MatchNumber       int         `json:"match_number"`
	Participant1ID    *uuid.UUID  `json:"participant1_id,omitempty"`
	Participant2ID    *uuid.UUID  `json:"participant2_id,omitempty"`
	WinnerID          *uuid.UUID  `json:"winner_id,omitempty"`
	LoserID           *uuid.UUID  `json:"loser_id,omitempty"`
	ScoreParticipant1 int         `json:"score_participant1"`
	ScoreParticipant2 int         `json:"score_participant2"`
	Status            MatchStatus `json:"status"`
	ScheduledTime     *time.Time  `json:"scheduled_time,omitempty"`
	CompletedTime     *time.Time  `json:"completed_time,omitempty"`
	NextMatchID       *uuid.UUID  `json:"next_match_id,omitempty"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
	MatchNotes        string      `json:"match_notes,omitempty"`
	MatchProofs       []string    `json:"match_proofs,omitempty"`
}

// MatchResponse represents the API response for a match
type MatchResponse struct {
	ID                uuid.UUID   `json:"id"`
	TournamentID      uuid.UUID   `json:"tournament_id"`
	Round             int         `json:"round"`
	MatchNumber       int         `json:"match_number"`
	Participant1ID    *uuid.UUID  `json:"participant1_id,omitempty"`
	Participant2ID    *uuid.UUID  `json:"participant2_id,omitempty"`
	WinnerID          *uuid.UUID  `json:"winner_id,omitempty"`
	LoserID           *uuid.UUID  `json:"loser_id,omitempty"`
	ScoreParticipant1 int         `json:"score_participant1"`
	ScoreParticipant2 int         `json:"score_participant2"`
	Status            MatchStatus `json:"status"`
	ScheduledTime     *time.Time  `json:"scheduled_time,omitempty"`
	CompletedTime     *time.Time  `json:"completed_time,omitempty"`
	NextMatchID       *uuid.UUID  `json:"next_match_id,omitempty"`
	CreatedAt         time.Time   `json:"created_at"`
	MatchNotes        string      `json:"match_notes,omitempty"`
	MatchProofs       []string    `json:"match_proofs,omitempty"`
}

// ScoreUpdateRequest represents a request to update match scores
type ScoreUpdateRequest struct {
	ScoreParticipant1 int      `json:"score_participant1"`
	ScoreParticipant2 int      `json:"score_participant2"`
	MatchNotes        string   `json:"match_notes,omitempty"`
	MatchProofs       []string `json:"match_proofs,omitempty"`
}
