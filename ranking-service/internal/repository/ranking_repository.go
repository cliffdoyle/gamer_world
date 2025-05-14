// internal/repository/ranking_repository.go
package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/cliffdoyle/ranking-service/internal/domain"
	"github.com/google/uuid"
)

type RankingRepository interface {
	// Upserts a user's score. If game_id is empty, defaults to 'global'.
	UpdateScore(ctx context.Context, userID uuid.UUID, gameID string, newScore int) error
	// Gets a user's current score. If game_id is empty, defaults to 'global'.
	GetScore(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error) // Returns score and last updated
	// Gets a paginated leaderboard. If game_id is empty, defaults to 'global'.
	GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error) // Returns entries and total players for that game
}

type rankingRepository struct {
	db *sql.DB
}

func NewRankingRepository(db *sql.DB) RankingRepository {
	return &rankingRepository{db: db}
}

const defaultGameID = "global"

func resolveGameID(gameID string) string {
	if gameID == "" {
		return defaultGameID
	}
	return gameID
}

func (r *rankingRepository) UpdateScore(ctx context.Context, userID uuid.UUID, gameID string, newScore int) error {
	effectiveGameID := resolveGameID(gameID)
	query := `
		INSERT INTO user_scores (user_id, game_id, score, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, game_id) DO UPDATE SET
			score = EXCLUDED.score,
			updated_at = EXCLUDED.updated_at;
	`
	_, err := r.db.ExecContext(ctx, query, userID, effectiveGameID, newScore, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update score for user %s, game %s: %w", userID, effectiveGameID, err)
	}
	return nil
}

func (r *rankingRepository) GetScore(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error) {
	effectiveGameID := resolveGameID(gameID)
	var ur domain.UserRanking
	ur.UserID = userID
	ur.GameID = effectiveGameID

	// To get the rank, we need to count users with a higher score for the same game
	// This query is slightly more complex if done in one go.
	// Simpler: Get score first, then calculate rank if needed (or in service layer).
	query := `SELECT score, updated_at FROM user_scores WHERE user_id = $1 AND game_id = $2`
	err := r.db.QueryRowContext(ctx, query, userID, effectiveGameID).Scan(&ur.Score, &ur.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			// User not found in scores table for this game, implies default score or unranked
			// You might want to return a default UserRanking struct or a specific error/nil
			log.Printf("No score entry found for user %s, game %s. Returning default.", userID, effectiveGameID)
			// Initialize with default score
			ur.Score = 1000            // Default starting score, align with table default
			ur.UpdatedAt = time.Time{} // Zero time
			// ur.Rank = 0 // Will be calculated if needed
			return &ur, nil // Return default, not an error. Or return domain.ErrUserNotFoundInRanking
		}
		return nil, fmt.Errorf("failed to get score for user %s, game %s: %w", userID, effectiveGameID, err)
	}
	// Rank would typically be calculated in the service layer by another query or GetLeaderboard logic
	return &ur, nil
}

func (r *rankingRepository) GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error) {
	effectiveGameID := resolveGameID(gameID)
	var entries []domain.LeaderboardEntry
	var totalPlayers int

	// Get total players for this game_id for pagination
	countQuery := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1`
	err := r.db.QueryRowContext(ctx, countQuery, effectiveGameID).Scan(&totalPlayers)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count players for leaderboard (game: %s): %w", effectiveGameID, err)
	}

	if totalPlayers == 0 {
		return entries, 0, nil // No players, empty leaderboard
	}

	// Get leaderboard with rank
	// DENSE_RANK() is good if multiple users can have the same score and thus same rank.
	// ROW_NUMBER() would give unique ranks even for ties.
	// query := `
	// 	SELECT 
	// 		rank, user_id, score
	// 	FROM (
	// 		SELECT
	// 			user_id,
	// 			score,
	// 			DENSE_RANK() OVER (PARTITION BY game_id ORDER BY score DESC) as rank
	// 		FROM user_scores
	// 		WHERE game_id = $1
	// 	) ranked_users
	// 	WHERE rank > $2 -- offset is page * pageSize, rank is effectively item number
	// 	ORDER BY rank ASC, user_id ASC -- user_id for stable sort among ties
	// 	LIMIT $3;
	// `
	// The WHERE rank > $2 is tricky if offset is 0 for the first page.
	// OFFSET in SQL is usually 0-indexed. DENSE_RANK is 1-indexed.
	// Let's use standard SQL OFFSET and calculate rank in service or client from order.

	queryWithRowNumber := `
        SELECT
            user_id,
            score
            -- The rank will be (offset + index_in_results + 1)
        FROM user_scores
        WHERE game_id = $1
        ORDER BY score DESC, user_id ASC -- user_id for stable sort among ties for deterministic pagination
        LIMIT $2 OFFSET $3;
    `

	rows, err := r.db.QueryContext(ctx, queryWithRowNumber, effectiveGameID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get leaderboard for game %s: %w", effectiveGameID, err)
	}
	defer rows.Close()

	rankCounter := offset + 1
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
