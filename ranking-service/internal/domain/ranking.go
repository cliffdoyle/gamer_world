package domain

import (
	"time"
	"github.com/google/uuid"
)

type UserOverallStats struct {
	UserID            uuid.UUID `json:"userId"`
	GameID            string    `json:"gameId"` // e.g., "global" or a specific game
	Level             int       `json:"level"`
	RankTitle         string    `json:"rankTitle"`     // "Bronze", "Gold", etc.
	Points            int       `json:"points"`          // Current points from 3-1-0 system
	GlobalRank        int       `json:"globalRank"`      // Numerical position in leaderboard
	WinRate           float64   `json:"winRate"`         // 0.0 to 1.0
	TotalGamesPlayed  int       `json:"totalGamesPlayed"`
	MatchesWon        int       `json:"matchesWon"`
	MatchesDrawn      int       `json:"matchesDrawn"`
	MatchesLost       int       `json:"matchesLost"`
	TournamentsPlayed int       `json:"tournamentsPlayed"` // Count of distinct game_ids they have a score in, or more accurately from User Service
	UpdatedAt         time.Time `json:"updatedAt"`
}

type LeaderboardEntry struct {
    Rank      int       `json:"rank"`
    UserID    uuid.UUID `json:"userId"`
    UserName  string    `json:"userName,omitempty"` // Optional, if fetched from User Service
    Score     int       `json:"score"`            // Total points
}

type ResultType string
const ( Win ResultType = "WIN"; Draw ResultType = "DRAW"; Loss ResultType = "LOSS" )

type MatchResultEvent struct {
	GameID    string             `json:"gameId,omitempty"`
	Users     []UserMatchOutcome `json:"users" binding:"required,dive"`
	MatchID   uuid.UUID          `json:"matchId,omitempty"`
	TournamentID uuid.UUID   `json:"tournamentId,omitempty"` // ADDED: Useful for tracking tournament participation
	Timestamp time.Time          `json:"timestamp"`
}
type UserMatchOutcome struct {
	UserID  uuid.UUID  `json:"userId" binding:"required"`
	Outcome ResultType `json:"outcome" binding:"required"`
}

const defaultGameID = "global"
func ResolveGameID(gameID string) string { /* ... same as before ... */ }