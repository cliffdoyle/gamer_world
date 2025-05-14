// internal/repository/ranking_repository.go
package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"
	"log"

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
        points = 0 // No points for a loss, but match is still counted
        lostIncrement = 1
    default:
        log.Printf("Warning: Unknown outcome '%s' for user %s in ProcessMatchOutcome. Defaulting to loss.", outcome, userID)
        lostIncrement = 1 // Or handle as an error: return nil, fmt.Errorf("unknown outcome: %s", outcome)
    }

    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer func() {
        if p := recover(); p != nil {
            tx.Rollback()
            panic(p) // Re-throw panic after Rollback
        } else if err != nil {
            tx.Rollback() // err is non-nil; Rollback
        } else {
            err = tx.Commit() // err is nil; Commit
            if err != nil {
                log.Printf("Error committing transaction for user %s, game %s: %v", userID, effectiveGameID, err)
            }
        }
    }()

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
    var updatedData UserScoreData // This will be populated by the query
    err = tx.QueryRowContext(ctx, scoreUpdateQuery,
        userID, effectiveGameID, points, wonIncrement, drawnIncrement, lostIncrement, time.Now(),
    ).Scan(
        &updatedData.UserID, &updatedData.GameID, &updatedData.Score, &updatedData.MatchesPlayed,
        &updatedData.MatchesWon, &updatedData.MatchesDrawn, &updatedData.MatchesLost, &updatedData.UpdatedAt,
    )
    if err != nil {
        // Rollback will be handled by defer
        return nil, fmt.Errorf("failed to update user_scores for user %s, game %s: %w", userID, effectiveGameID, err)
    }

    // Record tournament participation if tournamentID is valid (not uuid.Nil)
    if tournamentID != uuid.Nil {
        participationQuery := `
            INSERT INTO user_tournament_participation (user_id, game_id, tournament_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, game_id, tournament_id) DO NOTHING;
        `
        _, err = tx.ExecContext(ctx, participationQuery, userID, effectiveGameID, tournamentID)
        if err != nil {
            // Rollback will be handled by defer
            return nil, fmt.Errorf("failed to record tournament participation for user %s, game %s, tournament %s: %w", userID, effectiveGameID, tournamentID, err)
        }
    }

    // The commit is handled by the defer block. If err is nil here, it will commit.
    // After successful commit, we need to fetch the tournaments_played count.
    // Or, we can return updatedData which doesn't have TournamentsPlayed yet, and GetUserScoreData will provide it.
    // For consistency, let's fetch it here too if the commit was successful.

    // This part runs *after* the defer has potentially committed.
    // We need to query tournaments_played separately if we want it in the return from this func.
    // For now, let's stick to GetUserScoreData fetching the complete picture.
    // So, updatedData returned here will not have TournamentsPlayed populated.
    return &updatedData, err // err will be nil if commit succeeds, or commit error
}

func (r *rankingRepository) GetUserScoreData(ctx context.Context, userID uuid.UUID, gameID string) (*UserScoreData, error) {
    effectiveGameID := domain.ResolveGameID(gameID)
    var data UserScoreData

    query := `
        SELECT
            us.user_id,
            us.game_id,
            COALESCE(us.score, 0) AS score,
            COALESCE(us.matches_played, 0) AS matches_played,
            COALESCE(us.matches_won, 0) AS matches_won,
            COALESCE(us.matches_drawn, 0) AS matches_drawn,
            COALESCE(us.matches_lost, 0) AS matches_lost,
            us.updated_at, -- Can be NULL if no record in user_scores
            (SELECT COUNT(DISTINCT utp.tournament_id)
                 FROM user_tournament_participation utp
                 WHERE utp.user_id = $1 AND utp.game_id = $2) AS tournaments_played
        FROM user_scores us
        WHERE us.user_id = $1 AND us.game_id = $2;
    `
    // This query assumes a record exists in user_scores.
    // If a user might only be in user_tournament_participation but not user_scores (unlikely with current flow),
    // or if a user has played no matches (no user_scores record), we need to handle that.

    // Revised query to handle users with no score entry yet (e.g. only participated)
    // Or, more simply, if user_scores entry doesn't exist, all score-related fields are 0.
    err := r.db.QueryRowContext(ctx, query, userID, effectiveGameID).Scan(
        &data.UserID, &data.GameID, &data.Score, &data.MatchesPlayed, &data.MatchesWon,
        &data.MatchesDrawn, &data.MatchesLost, &data.UpdatedAt, // UpdatedAt can be sql.NullTime
        &data.TournamentsPlayed,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            // User has no score record in user_scores. Check if they have participated in tournaments.
            var tournamentsPlayed int
            countQuery := `SELECT COUNT(DISTINCT utp.tournament_id)
                           FROM user_tournament_participation utp
                           WHERE utp.user_id = $1 AND utp.game_id = $2`
            errCount := r.db.QueryRowContext(ctx, countQuery, userID, effectiveGameID).Scan(&tournamentsPlayed)
            if errCount != nil && errCount != sql.ErrNoRows {
                 return nil, fmt.Errorf("failed to count tournaments for user %s, game %s: %w", userID, effectiveGameID, errCount)
            }
            // Return a default struct, UserID and GameID are important.
            return &UserScoreData{
                UserID:            userID,
                GameID:            effectiveGameID,
                TournamentsPlayed: tournamentsPlayed, // Could be > 0 even if no scores yet
                Score:             0, MatchesPlayed: 0, MatchesWon: 0, MatchesDrawn: 0, MatchesLost: 0,
            }, nil
        }
        return nil, fmt.Errorf("failed to get score data for user %s, game %s: %w", userID, effectiveGameID, err)
    }
    // If user_scores.updated_at was NULL (e.g. from a LEFT JOIN scenario not used here),
    // data.UpdatedAt would be zero time. Handle as needed.
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
