package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// MatchRepository defines methods for match database operations
type MatchRepository interface {
	Create(ctx context.Context, match *domain.Match) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Match, error)
	GetByTournamentID(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Match, error)
	GetByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.Match, error)
	GetByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.Match, error)
	Update(ctx context.Context, match *domain.Match) error
	Delete(ctx context.Context, tournamentID uuid.UUID) error
}

// matchRepository implements MatchRepository interface
type matchRepository struct {
	db *sql.DB
}

// NewMatchRepository creates a new match repository
func NewMatchRepository(db *sql.DB) MatchRepository {
	return &matchRepository{db: db}
}

// Create inserts a new match into the database
func (r *matchRepository) Create(ctx context.Context, match *domain.Match) error {
	// Set timestamps
	now := time.Now()
	match.CreatedAt = now
	match.UpdatedAt = now

	// Convert match proofs to JSON
	proofsJSON, err := json.Marshal(match.MatchProofs)
	if err != nil {
		return err
	}

	// Convert PreviousMatchIDs to an array
	// var prevMatchIDsArray pq.StringArray
	// if match.PreviousMatchIDs != nil {
	// 	for _, id := range match.PreviousMatchIDs {
	// 		prevMatchIDsArray = append(prevMatchIDsArray, id.String())
	// 	}
	// }

	// Execute SQL insert
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO matches (
			id, tournament_id, round, match_number,
			participant1_id, participant2_id,
			winner_id, loser_id,
			score_participant1, score_participant2,
			status, scheduled_time, completed_time,
			next_match_id, loser_next_match_id, created_at, updated_at,
			match_notes, match_proofs, bracket_type
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
	`,
		match.ID,
		match.TournamentID,
		match.Round,
		match.MatchNumber,
		match.Participant1ID,
		match.Participant2ID,
		match.WinnerID,
		match.LoserID,
		match.ScoreParticipant1,
		match.ScoreParticipant2,
		match.Status,
		match.ScheduledTime,
		match.CompletedTime,
		match.NextMatchID,
		match.LoserNextMatchID,
		match.CreatedAt,
		match.UpdatedAt,
		match.MatchNotes,
		proofsJSON,
		match.BracketType,
		// prevMatchIDsArray,
	)

	return err
}

// GetByID retrieves a match by ID
func (r *matchRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Match, error) {
	var (
		match      domain.Match
		proofsJSON []byte
		// prevMatchIDsArray []string
	)

	err := r.db.QueryRowContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number,
			participant1_id, participant2_id,
			winner_id, loser_id,
			score_participant1, score_participant2,
			status, scheduled_time, completed_time,
			next_match_id, loser_next_match_id, created_at, updated_at,
			match_notes, match_proofs, bracket_type
		FROM matches
		WHERE id = $1
	`, id).Scan(
		&match.ID,
		&match.TournamentID,
		&match.Round,
		&match.MatchNumber,
		&match.Participant1ID,
		&match.Participant2ID,
		&match.WinnerID,
		&match.LoserID,
		&match.ScoreParticipant1,
		&match.ScoreParticipant2,
		&match.Status,
		&match.ScheduledTime,
		&match.CompletedTime,
		&match.NextMatchID,
		&match.LoserNextMatchID,
		&match.CreatedAt,
		&match.UpdatedAt,
		&match.MatchNotes,
		&proofsJSON,
		&match.BracketType,
		// &prevMatchIDsArray,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("match not found: %v", id)
	}
	if err != nil {
		return nil, err
	}

	// Parse match proofs JSON
	if len(proofsJSON) > 0 {
		if err := json.Unmarshal(proofsJSON, &match.MatchProofs); err != nil {
			return nil, err
		}
	}

	// Convert previous match IDs from array of strings to UUIDs
	// for _, strID := range prevMatchIDsArray {
	// 	id, err := uuid.Parse(strID)
	// 	if err != nil {
	// 		return nil, err
	// 	}
	// 	match.PreviousMatchIDs = append(match.PreviousMatchIDs, id)
	// }

	return &match, nil
}

// GetByTournamentID retrieves all matches for a tournament
func (r *matchRepository) GetByTournamentID(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number,
			participant1_id, participant2_id,
			winner_id, loser_id,
			score_participant1, score_participant2,
			status, scheduled_time, completed_time,
			next_match_id, loser_next_match_id, created_at, updated_at,
			match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1
		ORDER BY round, match_number
	`, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	matches := []*domain.Match{}
	for rows.Next() {
		var (
			match      domain.Match
			proofsJSON []byte
		)

		err := rows.Scan(
			&match.ID,
			&match.TournamentID,
			&match.Round,
			&match.MatchNumber,
			&match.Participant1ID,
			&match.Participant2ID,
			&match.WinnerID,
			&match.LoserID,
			&match.ScoreParticipant1,
			&match.ScoreParticipant2,
			&match.Status,
			&match.ScheduledTime,
			&match.CompletedTime,
			&match.NextMatchID,
			&match.LoserNextMatchID,
			&match.CreatedAt,
			&match.UpdatedAt,
			&match.MatchNotes,
			&proofsJSON,
		)
		if err != nil {
			return nil, err
		}

		// Parse match proofs JSON
		if len(proofsJSON) > 0 {
			if err := json.Unmarshal(proofsJSON, &match.MatchProofs); err != nil {
				return nil, err
			}
		}

		matches = append(matches, &match)
	}

	return matches, nil
}

// GetByRound retrieves matches for a specific round
func (r *matchRepository) GetByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number,
			participant1_id, participant2_id,
			winner_id, loser_id,
			score_participant1, score_participant2,
			status, scheduled_time, completed_time,
			next_match_id, loser_next_match_id, created_at, updated_at,
			match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1 AND round = $2
		ORDER BY match_number
	`, tournamentID, round)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	matches := []*domain.Match{}
	for rows.Next() {
		var (
			match      domain.Match
			proofsJSON []byte
		)

		err := rows.Scan(
			&match.ID,
			&match.TournamentID,
			&match.Round,
			&match.MatchNumber,
			&match.Participant1ID,
			&match.Participant2ID,
			&match.WinnerID,
			&match.LoserID,
			&match.ScoreParticipant1,
			&match.ScoreParticipant2,
			&match.Status,
			&match.ScheduledTime,
			&match.CompletedTime,
			&match.NextMatchID,
			&match.LoserNextMatchID,
			&match.CreatedAt,
			&match.UpdatedAt,
			&match.MatchNotes,
			&proofsJSON,
		)
		if err != nil {
			return nil, err
		}

		// Parse match proofs JSON
		if len(proofsJSON) > 0 {
			if err := json.Unmarshal(proofsJSON, &match.MatchProofs); err != nil {
				return nil, err
			}
		}

		matches = append(matches, &match)
	}

	return matches, nil
}

// GetByParticipant retrieves matches for a specific participant
func (r *matchRepository) GetByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number,
			participant1_id, participant2_id,
			winner_id, loser_id,
			score_participant1, score_participant2,
			status, scheduled_time, completed_time,
			next_match_id, loser_next_match_id, created_at, updated_at,
			match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1 
		AND (participant1_id = $2 OR participant2_id = $2)
		ORDER BY round, match_number
	`, tournamentID, participantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	matches := []*domain.Match{}
	for rows.Next() {
		var (
			match      domain.Match
			proofsJSON []byte
		)

		err := rows.Scan(
			&match.ID,
			&match.TournamentID,
			&match.Round,
			&match.MatchNumber,
			&match.Participant1ID,
			&match.Participant2ID,
			&match.WinnerID,
			&match.LoserID,
			&match.ScoreParticipant1,
			&match.ScoreParticipant2,
			&match.Status,
			&match.ScheduledTime,
			&match.CompletedTime,
			&match.NextMatchID,
			&match.LoserNextMatchID,
			&match.CreatedAt,
			&match.UpdatedAt,
			&match.MatchNotes,
			&proofsJSON,
		)
		if err != nil {
			return nil, err
		}

		// Parse match proofs JSON
		if len(proofsJSON) > 0 {
			if err := json.Unmarshal(proofsJSON, &match.MatchProofs); err != nil {
				return nil, err
			}
		}

		matches = append(matches, &match)
	}

	return matches, nil
}

// Update updates a match in the database
// Update updates a match in the database
func (r *matchRepository) Update(ctx context.Context, match *domain.Match) error {
	// Update timestamp
	match.UpdatedAt = time.Now()

	// Convert match proofs to JSON
	proofsJSON, err := json.Marshal(match.MatchProofs)
	if err != nil {
		return fmt.Errorf("failed to marshal match proofs for update: %w", err)
	}

	// Execute SQL update
	result, err := r.db.ExecContext(ctx, `
		UPDATE matches SET
			participant1_id = $1,
			participant2_id = $2,
			winner_id = $3,
			loser_id = $4,
			score_participant1 = $5,
			score_participant2 = $6,
			status = $7,
			scheduled_time = $8,
			completed_time = $9,
			next_match_id = $10,
			loser_next_match_id = $11,
			updated_at = $12,
			match_notes = $13,
			match_proofs = $14,
			bracket_type = $15 
			-- If you add previous_match_ids here, adjust placeholders below too
		WHERE id = $16 -- Corrected placeholder for id
	`,
		match.Participant1ID,    // $1
		match.Participant2ID,    // $2
		match.WinnerID,          // $3
		match.LoserID,           // $4
		match.ScoreParticipant1, // $5
		match.ScoreParticipant2, // $6
		match.Status,            // $7
		match.ScheduledTime,     // $8
		match.CompletedTime,     // $9
		match.NextMatchID,       // $10
		match.LoserNextMatchID,  // $11
		match.UpdatedAt,         // $12
		match.MatchNotes,        // $13
		proofsJSON,              // $14
		match.BracketType,       // $15
		// prevMatchIDsArray,    // If used, this would be $16, and id would be $17
		match.ID, // $16 (for WHERE clause)
	)
	if err != nil {
		// Check for specific pq error if it helps
		if pqErr, ok := err.(*pq.Error); ok {
			return fmt.Errorf("failed to update match SQL error (%s: %s): %w", pqErr.Code, pqErr.Message, err)
		}
		return fmt.Errorf("failed to update match: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected after update: %w", err)
	}

	if rowsAffected == 0 {
		// It's possible that an update affects 0 rows if the data hasn't actually changed
		// and the DB optimizes it, or if the WHERE condition isn't met.
		// For an ID based update, this usually means "not found".
		return fmt.Errorf("match not found for update (or no changes made): %v", match.ID)
	}

	return nil
}

// Delete removes all matches for a tournament
func (r *matchRepository) Delete(ctx context.Context, tournamentID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM matches
		WHERE tournament_id = $1
	`, tournamentID)
	return err
}
