package domain

import (
	"time"

	"github.com/google/uuid"
)

type MatchStatus string

const (
	MatchPending    MatchStatus = "PENDING"
	MatchInProgress MatchStatus = "IN_PROGRESS"
	MatchCompleted  MatchStatus = "COMPLETED"
	MatchCancelled  MatchStatus = "CANCELLED"
)

type BracketType string

const (
	WinnersBracket BracketType = "WINNERS"
	LosersBracket  BracketType = "LOSERS"
	GrandFinals    BracketType = "GRAND_FINALS"
)

// Match represents a tournament match
type Match struct {
	ID                uuid.UUID      `json:"id"`
	TournamentID      uuid.UUID      `json:"tournament_id"`
	Round             int            `json:"round"`
	MatchNumber       int            `json:"match_number"`
	Participant1ID    *uuid.UUID     `json:"participant1_id,omitempty"`
	Participant2ID    *uuid.UUID     `json:"participant2_id,omitempty"`
	WinnerID          *uuid.UUID     `json:"winner_id,omitempty"`
	LoserID           *uuid.UUID     `json:"loser_id,omitempty"`
	Participants      []*Participant `json:"participants"`
	ScoreParticipant1 int            `json:"score_participant1"`
	ScoreParticipant2 int            `json:"score_participant2"`
	Status            MatchStatus    `json:"status"`
	ScheduledTime     *time.Time     `json:"scheduled_time,omitempty"`
	CompletedTime     *time.Time     `json:"completed_time,omitempty"`
	NextMatchID       *uuid.UUID     `json:"next_match_id,omitempty"`
	LoserNextMatchID  *uuid.UUID     `json:"loser_next_match_id,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	MatchNotes        string         `json:"match_notes,omitempty"`
	MatchProofs       []string       `json:"match_proofs,omitempty"`
	BracketType       BracketType    `json:"bracket_type"`       // WINNERS, LOSERS, GRAND_FINALS
	PreviousMatchIDs  []uuid.UUID    `json:"previous_match_ids"` // for traceability

}
