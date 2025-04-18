package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

// MatchRepository defines methods for match database operations
type MatchRepository interface {
	Create(ctx context.Context, match *domain.Match) error
	CreateBatch(ctx context.Context, matches []*domain.Match) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Match, error)
	GetByTournamentID(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Match, error)
	GetByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.Match, error)
	GetByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.Match, error)
	ListByTournament(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Match, error)
	ListByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.Match, error)
	ListByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.Match, error)
	UpdateScore(ctx context.Context, id uuid.UUID, p1Score, p2Score int, winnerID, loserID *uuid.UUID, notes string, proofs map[string]interface{}) error
	UpdateStatus(ctx context.Context, id uuid.UUID, status domain.MatchStatus) error
	Update(ctx context.Context, match *domain.Match) error
	Delete(ctx context.Context, id uuid.UUID) error
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
	// Generate UUID if not provided
	if match.ID == uuid.Nil {
		match.ID = uuid.New()
	}

	// Set timestamps
	now := time.Now()
	match.CreatedAt = now
	match.UpdatedAt = now

	// Convert map to JSONB
	proofsJSON, err := json.Marshal(match.MatchProofs)
	if err != nil {
		return err
	}

	// Execute SQL insert
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO matches (
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
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
		match.CreatedAt,
		match.UpdatedAt,
		match.MatchNotes,
		proofsJSON,
	)

	return err
}

// CreateBatch inserts multiple matches in a transaction
func (r *matchRepository) CreateBatch(ctx context.Context, matches []*domain.Match) error {
	// Start transaction
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Prepare statement for reuse
	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO matches (
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
		)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	// Insert each match
	now := time.Now()
	for _, match := range matches {
		// Generate UUID if not provided
		if match.ID == uuid.Nil {
			match.ID = uuid.New()
		}

		// Set timestamps
		match.CreatedAt = now
		match.UpdatedAt = now

		// Convert map to JSONB
		proofsJSON, err := json.Marshal(match.MatchProofs)
		if err != nil {
			return err
		}

		// Execute statement
		_, err = stmt.ExecContext(ctx,
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
			match.CreatedAt,
			match.UpdatedAt,
			match.MatchNotes,
			proofsJSON,
		)
		if err != nil {
			return err
		}
	}

	// Commit transaction
	return tx.Commit()
}

// GetByID retrieves a match by ID
func (r *matchRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Match, error) {
	var (
		match      domain.Match
		proofsJSON []byte
	)

	err := r.db.QueryRowContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
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
		&match.CreatedAt,
		&match.UpdatedAt,
		&match.MatchNotes,
		&proofsJSON,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("match not found: %v", id)
		}
		return nil, err
	}

	// Parse JSONB field
	if len(proofsJSON) > 0 {
		if err := json.Unmarshal(proofsJSON, &match.MatchProofs); err != nil {
			return nil, err
		}
	}

	return &match, nil
}

// GetByTournamentID retrieves all matches for a tournament
func (r *matchRepository) GetByTournamentID(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1
		ORDER BY round, match_number
	`, tournamentID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMatches(rows)
}

// GetByRound retrieves all matches for a specific round in a tournament
func (r *matchRepository) GetByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1 AND round = $2
		ORDER BY match_number
	`, tournamentID, round)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMatches(rows)
}

// GetByParticipant retrieves all matches for a participant in a tournament
func (r *matchRepository) GetByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1 AND (participant1_id = $2 OR participant2_id = $2)
		ORDER BY round, match_number
	`, tournamentID, participantID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMatches(rows)
}

// ListByTournament retrieves all matches for a tournament
func (r *matchRepository) ListByTournament(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1
		ORDER BY round, match_number
	`, tournamentID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMatches(rows)
}

// ListByRound retrieves all matches for a specific round in a tournament
func (r *matchRepository) ListByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1 AND round = $2
		ORDER BY match_number
	`, tournamentID, round)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMatches(rows)
}

// ListByParticipant retrieves all matches for a participant in a tournament
func (r *matchRepository) ListByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.Match, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, round, match_number, participant1_id,
			participant2_id, winner_id, loser_id, score_participant1,
			score_participant2, status, scheduled_time, completed_time,
			next_match_id, created_at, updated_at, match_notes, match_proofs
		FROM matches
		WHERE tournament_id = $1 AND (participant1_id = $2 OR participant2_id = $2)
		ORDER BY round, match_number
	`, tournamentID, participantID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanMatches(rows)
}

// UpdateScore updates a match's score and winner/loser
func (r *matchRepository) UpdateScore(ctx context.Context, id uuid.UUID, p1Score, p2Score int, winnerID, loserID *uuid.UUID, notes string, proofs map[string]interface{}) error {
	now := time.Now()
	status := domain.MatchCompleted

	// Convert map to JSONB
	proofsJSON, err := json.Marshal(proofs)
	if err != nil {
		return err
	}

	result, err := r.db.ExecContext(ctx, `
		UPDATE matches SET
			score_participant1 = $1,
			score_participant2 = $2,
			winner_id = $3,
			loser_id = $4,
			status = $5,
			completed_time = $6,
			updated_at = $7,
			match_notes = $8,
			match_proofs = $9
		WHERE id = $10
	`,
		p1Score,
		p2Score,
		winnerID,
		loserID,
		status,
		now,
		now,
		notes,
		proofsJSON,
		id,
	)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("match not found: %v", id)
	}

	return nil
}

// UpdateStatus updates a match's status
func (r *matchRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.MatchStatus) error {
	now := time.Now()

	result, err := r.db.ExecContext(ctx, `
		UPDATE matches SET
			status = $1,
			updated_at = $2
		WHERE id = $3
	`,
		status,
		now,
		id,
	)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("match not found: %v", id)
	}

	return nil
}

// Update updates a match in the database
func (r *matchRepository) Update(ctx context.Context, match *domain.Match) error {
	// Generate UUID if not provided
	if match.ID == uuid.Nil {
		match.ID = uuid.New()
	}

	// Set timestamps
	now := time.Now()
	match.CreatedAt = now
	match.UpdatedAt = now

	// Convert map to JSONB
	proofsJSON, err := json.Marshal(match.MatchProofs)
	if err != nil {
		return err
	}

	// Execute SQL update
	_, err = r.db.ExecContext(ctx, `
		UPDATE matches SET
			tournament_id = $1,
			round = $2,
			match_number = $3,
			participant1_id = $4,
			participant2_id = $5,
			winner_id = $6,
			loser_id = $7,
			score_participant1 = $8,
			score_participant2 = $9,
			status = $10,
			scheduled_time = $11,
			completed_time = $12,
			next_match_id = $13,
			created_at = $14,
			updated_at = $15,
			match_notes = $16,
			match_proofs = $17
		WHERE id = $18
	`,
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
		match.CreatedAt,
		match.UpdatedAt,
		match.MatchNotes,
		proofsJSON,
		match.ID,
	)

	return err
}

// Delete removes a match by ID
func (r *matchRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM matches
		WHERE id = $1
	`, id)
	return err
}

// scanMatches is a helper function to scan rows into matches
func scanMatches(rows *sql.Rows) ([]*domain.Match, error) {
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
			&match.CreatedAt,
			&match.UpdatedAt,
			&match.MatchNotes,
			&proofsJSON,
		)

		if err != nil {
			return nil, err
		}

		// Parse JSONB field
		if len(proofsJSON) > 0 {
			if err := json.Unmarshal(proofsJSON, &match.MatchProofs); err != nil {
				return nil, err
			}
		}

		matches = append(matches, &match)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return matches, nil
}
