// internal/repository/ranking_repository.go
package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/cliffdoyle/ranking-service/internal/domain" // Adjust import path
	"github.com/google/uuid"
)

type RankingRepository interface {
	UpdateUserPoints(ctx context.Context, userID uuid.UUID, gameID string, pointsToAdd int) (newTotalPoints int, err error)
	GetUserScoreAndRankData(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error) // Renamed for clarity
	GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error)
	DB() *sql.DB // For service layer custom queries (like rank calculation)
}

type rankingRepository struct {
	db *sql.DB
}

func NewRankingRepository(db *sql.DB) RankingRepository {
	return &rankingRepository{db: db}
}

// UpdateUserPoints adds points to a user's current score.
// It initializes the score if the user is not found.
func (r *rankingRepository) UpdateUserPoints(ctx context.Context, userID uuid.UUID, gameID string, pointsToAdd int) (int, error) {
	effectiveGameID := domain.ResolveGameID(gameID) // Use domain helper
	var currentPoints, newTotalPoints int

	// Use a transaction to ensure atomicity for read-then-write
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Rollback if not committed

	// Get current points or initialize
	querySelect := `SELECT score FROM user_scores WHERE user_id = $1 AND game_id = $2 FOR UPDATE` // FOR UPDATE to lock the row
	err = tx.QueryRowContext(ctx, querySelect, userID, effectiveGameID).Scan(currentPoints)
	if err != nil {
		if err == sql.ErrNoRows {
			// User not found, this is their first game/points for this gameID
			currentPoints = 0 // Start from 0 if not using default table score for new entries
			log.Printf("User %s new to game %s, starting points: %d", userID, effectiveGameID, currentPoints)
		} else {
			return 0, fmt.Errorf("failed to get current points for user %s, game %s: %w", userID, effectiveGameID, err)
		}
	}

	newTotalPoints = currentPoints + pointsToAdd

	// Upsert new total points
	queryUpsert := `
		INSERT INTO user_scores (user_id, game_id, score, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, game_id) DO UPDATE SET
			score = $3,  -- Directly set the new total
			updated_at = $4;
	`
	_, err = tx.ExecContext(ctx, queryUpsert, userID, effectiveGameID, newTotalPoints, time.Now())
	if err != nil {
		return 0, fmt.Errorf("failed to update points for user %s, game %s: %w", userID, effectiveGameID, err)
	}

	if err = tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return newTotalPoints, nil
}

// GetUserScoreAndRankData retrieves score and last update time. Rank will be calculated in service.
func (r *rankingRepository) GetUserScoreAndRankData(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	var ur domain.UserRanking
	ur.UserID = userID
	ur.GameID = effectiveGameID

	query := `SELECT score, updated_at FROM user_scores WHERE user_id = $1 AND game_id = $2`
	err := r.db.QueryRowContext(ctx, query, userID, effectiveGameID).Scan(&ur.Score, &ur.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			// User has no score entry yet. Return default "unranked" state.
			ur.Score = 0     // Default score for a user not yet in the table
			ur.Rank = 0      // Will indicate unranked or need calculation based on total players
			ur.UpdatedAt = time.Time{} // Zero time
			return &ur, nil
		}
		return nil, fmt.Errorf("failed to get score data for user %s, game %s: %w", userID, effectiveGameID, err)
	}
	// Rank will be calculated by the service.
	return &ur, nil
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