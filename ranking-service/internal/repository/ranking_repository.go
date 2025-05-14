// internal/repository/ranking_repository.go
package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/cliffdoyle/ranking-service/internal/domain" // Adjust import path
	"github.com/google/uuid"
)

// type RankingRepository interface {
// 	UpdateUserPoints(ctx context.Context, userID uuid.UUID, gameID string, pointsToAdd int) (newTotalPoints int, err error)
// 	GetUserScoreAndRankData(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error) // Renamed for clarity
// 	GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error)
// 	DB() *sql.DB // For service layer custom queries (like rank calculation)
// }

// type rankingRepository struct {
// 	db *sql.DB
// }

// func NewRankingRepository(db *sql.DB) RankingRepository {
// 	return &rankingRepository{db: db}
// }

type UserScoreData struct { // Helper struct for reading from DB
	UserID            uuid.UUID
	GameID            string
	Score             int
	MatchesPlayed     int
	MatchesWon        int
	MatchesDrawn      int
	MatchesLost       int // We can calculate this, or store it if preferred
	TournamentsPlayed int // This will store count of distinct (user_id, tournament_id) processed for ranking
	UpdatedAt         time.Time
}

type RankingRepository interface {
	// ProcessMatchOutcome increments scores and match counts.
	ProcessMatchOutcome(ctx context.Context, userID uuid.UUID, gameID string, tournamentID uuid.UUID, outcome domain.ResultType) (*UserScoreData, error)
	// GetUserScoreData retrieves all stored data for a user in a game.
	GetUserScoreData(ctx context.Context, userID uuid.UUID, gameID string) (*UserScoreData, error)
	GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error)
	DB() *sql.DB
}

type rankingRepository struct{ db *sql.DB }

func NewRankingRepository(db *sql.DB) RankingRepository { return &rankingRepository{db: db} }

func (r *rankingRepository) ProcessMatchOutcome(ctx context.Context, userID uuid.UUID, gameID string, tournamentID uuid.UUID, outcome domain.ResultType) (*UserScoreData, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	points := 0
	wonIncrement := 0
	drawnIncrement := 0
	lostIncrement := 0

	switch outcome {
	case domain.Win:
		points = 3
		wonIncrement = 1
	case domain.Draw:
		points = 1
		drawnIncrement = 1
	case domain.Loss:
		points = 0
		lostIncrement = 1
	}

	query := `
		INSERT INTO user_scores (
			user_id, game_id, score, matches_played, matches_won, matches_drawn, matches_lost, updated_at
		)
		VALUES ($1, $2, $3, 1, $4, $5, $6, $7)
		ON CONFLICT (user_id, game_id) DO UPDATE SET
			score = user_scores.score + EXCLUDED.score,
			matches_played = user_scores.matches_played + 1,
			matches_won = user_scores.matches_won + EXCLUDED.matches_won,
			matches_drawn = user_scores.matches_drawn + EXCLUDED.matches_drawn,
			matches_lost = user_scores.matches_lost + EXCLUDED.matches_lost,
			updated_at = EXCLUDED.updated_at
		RETURNING user_id, game_id, score, matches_played, matches_won, matches_drawn, matches_lost, updated_at;
	`
	// Note: tournaments_played needs a different update strategy
	// For now, this method does not update tournaments_played directly based on a single match outcome.

	var updatedData UserScoreData
	err := r.db.QueryRowContext(ctx, query,
		userID, effectiveGameID, points, wonIncrement, drawnIncrement, lostIncrement, time.Now(),
	).Scan(
		&updatedData.UserID, &updatedData.GameID, &updatedData.Score, &updatedData.MatchesPlayed,
		&updatedData.MatchesWon, &updatedData.MatchesDrawn, &updatedData.MatchesLost, &updatedData.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to process match outcome for user %s, game %s: %w", userID, effectiveGameID, err)
	}

	// Separately, ensure this (user_id, tournament_id) contributes to tournaments_played count
	// This requires a table to track distinct (user_id, tournament_id) or similar
	// For simplicity now, we will update/query tournaments_played elsewhere or use a proxy.
	// If we had a separate tournaments_participated_ranking table:
	// INSERT INTO tournaments_participated_ranking (user_id, game_id, tournament_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;
	// And then COUNT from that table.
	// Or, update user_scores.tournaments_played if this is a *new* tournament for this user for this game_id
	// This makes UpdateMatchOutcome more complex.

	return &updatedData, nil
}

func (r *rankingRepository) GetUserScoreData(ctx context.Context, userID uuid.UUID, gameID string) (*UserScoreData, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	var data UserScoreData
	// We still need a way to get `tournaments_played`. For now, assuming it's 0 or derived in service.
	query := `SELECT user_id, game_id, score, matches_played, matches_won, matches_drawn, matches_lost, updated_at
              FROM user_scores WHERE user_id = $1 AND game_id = $2`
	err := r.db.QueryRowContext(ctx, query, userID, effectiveGameID).Scan(
		&data.UserID, &data.GameID, &data.Score, &data.MatchesPlayed, &data.MatchesWon,
		&data.MatchesDrawn, &data.MatchesLost, &data.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Return zero-value struct with UserID and GameID set, indicates not found / default state
			return &UserScoreData{UserID: userID, GameID: effectiveGameID}, nil
		}
		return nil, fmt.Errorf("failed to get score data for user %s, game %s: %w", userID, effectiveGameID, err)
	}
	return &data, nil
}

// GetLeaderboard remains the same as points are just scores.
func (r *rankingRepository) GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	var entries []domain.LeaderboardEntry
	var totalPlayers int

	countQuery := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1`
	err := r.db.QueryRowContext(ctx, countQuery, effectiveGameID).Scan(&totalPlayers)
	if err != nil {
		if err == sql.ErrNoRows { // No players for this game, not an error for count.
			return entries, 0, nil
		}
		return nil, 0, fmt.Errorf("failed to count players for leaderboard (game: %s): %w", effectiveGameID, err)
	}

	if totalPlayers == 0 {
		return entries, 0, nil
	}

	query := `
        SELECT user_id, score
        FROM user_scores
        WHERE game_id = $1
        ORDER BY score DESC, user_id ASC -- user_id for tie-breaking in pagination, updated_at DESC could also be used
        LIMIT $2 OFFSET $3;
    `
	rows, err := r.db.QueryContext(ctx, query, effectiveGameID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get leaderboard for game %s: %w", effectiveGameID, err)
	}
	defer rows.Close()

	rankCounter := offset + 1 // Rank starts from offset + 1
	for rows.Next() {
		var entry domain.LeaderboardEntry
		err := rows.Scan(&entry.UserID, &entry.Score)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan leaderboard entry: %w", err)
		}
		entry.Rank = rankCounter
		entries = append(entries, entry)
		rankCounter++
	}
	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating leaderboard rows: %w", err)
	}
	return entries, totalPlayers, nil
}

func (r *rankingRepository) DB() *sql.DB {
	return r.db
}
