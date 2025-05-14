// internal/domain/ranking.go
package domain

import (
	"time"
	"github.com/google/uuid"
)

// UserRanking represents a user's position and score in a leaderboard.
// This might be specific to a game, season, or overall.
type UserRanking struct {
	UserID    uuid.UUID `json:"userId"`
	GameID    string    `json:"gameId,omitempty"` // Optional: For game-specific leaderboards
	Score     int       `json:"score"`          // Could be ELO, points, etc.
	Rank      int       `json:"rank"`           // Overall or game-specific rank
	UpdatedAt time.Time `json:"updatedAt"`
	// UserName  string    `json:"userName,omitempty"`  // Optional: denormalized for easier display, but can lead to stale data
	// UserAvatar string   `json:"userAvatar,omitempty"` // Optional
}

// LeaderboardEntry is what we typically show on a leaderboard
type LeaderboardEntry struct {
    Rank      int       `json:"rank"`
    UserID    uuid.UUID `json:"userId"`
    // UserName  string    `json:"userName"` // To display this, Ranking Service might need to call User Service
    Score     int       `json:"score"`
}

// ResultType indicates the outcome for a user in a match
type ResultType string
const (
    Win  ResultType = "WIN"
    Draw ResultType = "DRAW"
    Loss ResultType = "LOSS" // Though loss gives 0 points, useful for tracking
)

// MatchResultEvent represents the outcome of a match for one or more users
// Tournament Service will send this to Ranking Service.
type MatchResultEvent struct {
    GameID    string           `json:"gameId,omitempty"` // For game-specific rankings
    Users     []UserMatchOutcome `json:"users" binding:"required,dive"` // Slice for players involved
    MatchID   uuid.UUID        `json:"matchId,omitempty"` // For idempotency or reference
    Timestamp time.Time        `json:"timestamp"`
}


type UserMatchOutcome struct {
    UserID uuid.UUID  `json:"userId" binding:"required"`
    Outcome ResultType `json:"outcome" binding:"required"` // "WIN", "DRAW", "LOSS"
}

// ScoreUpdateEvent could be a DTO for updating scores.
// This might come from Tournament Service after a match concludes.
type ScoreUpdateEvent struct {
    UserID    uuid.UUID `json:"userId"`
    GameID    string    `json:"gameId,omitempty"` // If game-specific
    ScoreChan    int       `json:"scoreChange"`    // e.g., +10 for win, -5 for loss, or new ELO
    MatchID   uuid.UUID `json:"matchId,omitempty"`// Optional: for idempotency or tracking
    Timestamp time.Time `json:"timestamp"`
}

const defaultGameID = "global"

func ResolveGameID(gameID string) string {
	if gameID == "" {
		return defaultGameID
	}
	return gameID
}