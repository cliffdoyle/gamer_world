// internal/repository/ranking_repository.go
package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log" // Added for logging
	"time"

	"github.com/cliffdoyle/ranking-service/internal/domain" // Adjust import path
	"github.com/google/uuid"
)

type UserScoreData struct {
	UserID            uuid.UUID
	GameID            string
	Score             int
	MatchesPlayed     int
	MatchesWon        int
	MatchesDrawn      int
	MatchesLost       int
	TournamentsPlayed int
	UpdatedAt         time.Time // Use sql.NullTime if it can truly be null from DB
}

type RankingRepository interface {
	// ProcessMatchOutcome increments scores and match counts, now within a transaction.
	ProcessMatchOutcome(ctx context.Context, tx *sql.Tx, userID uuid.UUID, gameID string, tournamentID uuid.UUID, outcome domain.ResultType) (*UserScoreData, error)
	GetUserScoreData(ctx context.Context, userID uuid.UUID, gameID string) (*UserScoreData, error)
	GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error)
	DB() *sql.DB // For direct DB access if needed (e.g., service layer transactions)

	// Methods for Idempotency
	IsMatchEventProcessed(ctx context.Context, tx *sql.Tx, matchID uuid.UUID) (bool, error)
	MarkMatchEventAsProcessed(ctx context.Context, tx *sql.Tx, matchID uuid.UUID, tournamentID uuid.UUID, gameID string) error
}

type rankingRepository struct{ db *sql.DB }

func NewRankingRepository(db *sql.DB) RankingRepository { return &rankingRepository{db: db} }

// ProcessMatchOutcome now accepts a transaction
func (r *rankingRepository) ProcessMatchOutcome(ctx context.Context, tx *sql.Tx, userID uuid.UUID, gameID string, tournamentID uuid.UUID, outcome domain.ResultType) (*UserScoreData, error) {
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
	default:
		log.Printf("Warning: Unknown outcome '%s' for user %s in ProcessMatchOutcome. Defaulting to loss.", outcome, userID)
		lostIncrement = 1 // Or return an error: return nil, fmt.Errorf("unknown outcome: %s", outcome)
	}

	scoreUpdateQuery := `
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
	var updatedData UserScoreData
	err := tx.QueryRowContext(ctx, scoreUpdateQuery,
		userID, effectiveGameID, points, wonIncrement, drawnIncrement, lostIncrement, time.Now(),
	).Scan(
		&updatedData.UserID, &updatedData.GameID, &updatedData.Score, &updatedData.MatchesPlayed,
		&updatedData.MatchesWon, &updatedData.MatchesDrawn, &updatedData.MatchesLost, &updatedData.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update user_scores for user %s, game %s: %w", userID, effectiveGameID, err)
	}

	if tournamentID != uuid.Nil {
		participationQuery := `
			INSERT INTO user_tournament_participation (user_id, game_id, tournament_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, game_id, tournament_id) DO NOTHING;
		`
		_, err = tx.ExecContext(ctx, participationQuery, userID, effectiveGameID, tournamentID)
		if err != nil {
			return nil, fmt.Errorf("failed to record tournament participation for user %s, game %s, tournament %s: %w", userID, effectiveGameID, tournamentID, err)
		}
	}
	return &updatedData, nil // TournamentsPlayed will be fetched by GetUserScoreData
}

func (r *rankingRepository) GetUserScoreData(ctx context.Context, userID uuid.UUID, gameID string) (*UserScoreData, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	data := UserScoreData{
		UserID: userID, // Pre-fill in case of no rows
		GameID: effectiveGameID,
	}
	var updatedAt sql.NullTime // To handle potential NULL from user_scores

	// Query to get score data and tournament count
	query := `
		SELECT
			COALESCE(us.score, 0),
			COALESCE(us.matches_played, 0),
			COALESCE(us.matches_won, 0),
			COALESCE(us.matches_drawn, 0),
			COALESCE(us.matches_lost, 0),
			us.updated_at,
			(SELECT COUNT(DISTINCT utp.tournament_id)
			 FROM user_tournament_participation utp
			 WHERE utp.user_id = $1 AND utp.game_id = $2)
		FROM user_scores us
		WHERE us.user_id = $1 AND us.game_id = $2;
	`
	// This query will return sql.ErrNoRows if the user_id/game_id combo doesn't exist in user_scores
	err := r.db.QueryRowContext(ctx, query, userID, effectiveGameID).Scan(
		&data.Score,
		&data.MatchesPlayed,
		&data.MatchesWon,
		&data.MatchesDrawn,
		&data.MatchesLost,
		&updatedAt,
		&data.TournamentsPlayed,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// User has no record in user_scores. Check participation separately.
			// (The subquery for tournaments_played would not have run if main FROM failed)
			var tournamentsPlayed int
			countQuery := `SELECT COUNT(DISTINCT utp.tournament_id)
                           FROM user_tournament_participation utp
                           WHERE utp.user_id = $1 AND utp.game_id = $2`
			errCount := r.db.QueryRowContext(ctx, countQuery, userID, effectiveGameID).Scan(&tournamentsPlayed)
			if errCount != nil && errCount != sql.ErrNoRows {
				return nil, fmt.Errorf("failed to count tournaments for user %s (no score record), game %s: %w", userID, effectiveGameID, errCount)
			}
			data.TournamentsPlayed = tournamentsPlayed
			// All other fields (score, matches) remain 0 as initialized. UpdatedAt remains zero time.
			return &data, nil // Not an error, user just has no score entry
		}
		return nil, fmt.Errorf("failed to get score data for user %s, game %s: %w", userID, effectiveGameID, err)
	}

	if updatedAt.Valid {
		data.UpdatedAt = updatedAt.Time
	} // else it remains zero time

	return &data, nil
}

func (r *rankingRepository) GetLeaderboard(ctx context.Context, gameID string, limit int, offset int) ([]domain.LeaderboardEntry, int, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	var entries []domain.LeaderboardEntry
	var totalPlayers int

	countQuery := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1 AND matches_played > 0` // Only count active players
	err := r.db.QueryRowContext(ctx, countQuery, effectiveGameID).Scan(&totalPlayers)
	if err != nil {
		// No ErrNoRows check here, COUNT always returns a row
		return nil, 0, fmt.Errorf("failed to count players for leaderboard (game: %s): %w", effectiveGameID, err)
	}

	if totalPlayers == 0 {
		return entries, 0, nil
	}

	query := `
        SELECT user_id, score
        FROM user_scores
        WHERE game_id = $1 AND matches_played > 0 -- Only list active players
        ORDER BY score DESC, updated_at ASC -- Tie-breaking: higher score wins, then earlier update (more stable)
        LIMIT $2 OFFSET $3;
    `
	rows, err := r.db.QueryContext(ctx, query, effectiveGameID, limit, offset)
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

func (r *rankingRepository) DB() *sql.DB {
	return r.db
}

// IsMatchEventProcessed checks if a match event has already been processed.
func (r *rankingRepository) IsMatchEventProcessed(ctx context.Context, tx *sql.Tx, matchID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM processed_match_events WHERE match_id = $1)`
	var err error
	if tx != nil {
		err = tx.QueryRowContext(ctx, query, matchID).Scan(&exists)
	} else {
		err = r.db.QueryRowContext(ctx, query, matchID).Scan(&exists)
	}

	if err != nil {
		return false, fmt.Errorf("failed to check if match event %s is processed: %w", matchID, err)
	}
	return exists, nil
}

// MarkMatchEventAsProcessed records that a match event has been processed.
func (r *rankingRepository) MarkMatchEventAsProcessed(ctx context.Context, tx *sql.Tx, matchID uuid.UUID, tournamentID uuid.UUID, gameID string) error {
	query := `INSERT INTO processed_match_events (match_id, tournament_id, game_id, processed_at) VALUES ($1, $2, $3, $4)`
	effectiveGameID := domain.ResolveGameID(gameID) // Ensure gameID is resolved
	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query, matchID, tournamentID, effectiveGameID, time.Now())
	} else {
		_, err = r.db.ExecContext(ctx, query, matchID, tournamentID, effectiveGameID, time.Now())
	}

	if err != nil {
		return fmt.Errorf("failed to mark match event %s as processed: %w", matchID, err)
	}
	return nil
}