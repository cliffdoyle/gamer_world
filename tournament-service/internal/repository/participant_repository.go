package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

// ParticipantRepository defines methods for participant database operations
type ParticipantRepository interface {
	Create(ctx context.Context, participant *domain.Participant) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Participant, error)
	GetByTournamentAndUser(ctx context.Context, tournamentID, userID uuid.UUID) (*domain.Participant, error)
	ListByTournament(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Participant, error)
	Update(ctx context.Context, participant *domain.Participant) error
	UpdateSeed(ctx context.Context, id uuid.UUID, seed int) error
	CheckIn(ctx context.Context, id uuid.UUID) error
	Delete(ctx context.Context, id uuid.UUID) error
	 ExistsByTournamentIDAndUserID(ctx context.Context, tournamentID, userID uuid.UUID) (bool, error)
}

// participantRepository implements ParticipantRepository interface
type participantRepository struct {
	db *sql.DB
}

// NewParticipantRepository creates a new participant repository
func NewParticipantRepository(db *sql.DB) ParticipantRepository {
	return &participantRepository{db: db}
}

// Assuming your repository struct looks like this (note the type is *sql.DB):
// import (
//    "database/sql" // Standard SQL import
// )
// type ParticipantRepository struct {
//     db *sql.DB // This is a standard sql.DB pointer
// }


// In your ExistsByTournamentIDAndUserID implementation:
// Import necessary packages:
// import (
// 	"context"
// 	"database/sql" // Import the standard sql package
// 	"fmt"
// 	"github.com/google/uuid" // assuming uuid
// 	// Replace domain path with your actual domain package path
//     "your_project_path/internal/domain"
// )

func (r *participantRepository) ExistsByTournamentIDAndUserID(ctx context.Context, tournamentID, userID uuid.UUID) (bool, error) {
    // Use a COUNT query to efficiently check for existence
    query := `
        SELECT COUNT(*)
        FROM tournament_participants
        WHERE tournament_id = $1 AND user_id = $2
    ` // Use $1, $2 for PostgreSQL, or ?,? for MySQL/SQLite

    var count int
    // Use QueryRowContext for queries expected to return at most one row
    err := r.db.QueryRowContext(ctx, query, tournamentID, userID).Scan(&count)

    if err != nil {
        // sql.ErrNoRows specifically is NOT an error for COUNT(*),
        // COUNT(*) always returns a row, even if it's 0.
        // So any error here is a genuine database error.
        return false, fmt.Errorf("database query failed: %w", err)
    }

    // If count > 0, a record exists
    return count > 0, nil
}

// Create inserts a new participant into the database
func (r *participantRepository) Create(ctx context.Context, participant *domain.Participant) error {
	// Set timestamps
	now := time.Now()
	participant.CreatedAt = now
	participant.UpdatedAt = now

	// Execute SQL insert
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO tournament_participants (
			id, tournament_id, user_id, participant_name, seed,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`,
		participant.ID,
		participant.TournamentID,
		participant.UserID,
		participant.ParticipantName,
		participant.Seed,
		participant.CreatedAt,
		participant.UpdatedAt,
	)

	return err
}

// GetByID retrieves a participant by ID
func (r *participantRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Participant, error) {
	var participant domain.Participant

	err := r.db.QueryRowContext(ctx, `
		SELECT 
			id, tournament_id, user_id, COALESCE(participant_name, ''), seed,
			created_at, updated_at
		FROM tournament_participants
		WHERE id = $1
	`, id).Scan(
		&participant.ID,
		&participant.TournamentID,
		&participant.UserID,
		&participant.ParticipantName,
		&participant.Seed,
		&participant.CreatedAt,
		&participant.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Set default status if not set
	if participant.Status == "" {
		participant.Status = domain.ParticipantRegistered
	}

	return &participant, nil
}

// GetByTournamentAndUser retrieves a participant by tournament ID and user ID
func (r *participantRepository) GetByTournamentAndUser(ctx context.Context, tournamentID, userID uuid.UUID) (*domain.Participant, error) {
	var participant domain.Participant
	err := r.db.QueryRowContext(ctx, `
		SELECT 
			id, tournament_id, user_id, COALESCE(participant_name, ''), seed,
			created_at, updated_at
		FROM tournament_participants
		WHERE tournament_id = $1 AND user_id = $2
	`, tournamentID, userID).Scan(
		&participant.ID,
		&participant.TournamentID,
		&participant.UserID,
		&participant.ParticipantName,
		&participant.Seed,
		&participant.CreatedAt,
		&participant.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Set default status if not set
	if participant.Status == "" {
		participant.Status = domain.ParticipantRegistered
	}

	return &participant, nil
}

// ListByTournament retrieves all participants for a tournament
func (r *participantRepository) ListByTournament(ctx context.Context, tournamentID uuid.UUID) ([]*domain.Participant, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, user_id, COALESCE(participant_name, ''), seed,
			created_at, updated_at
		FROM tournament_participants
		WHERE tournament_id = $1
		ORDER BY seed, created_at
	`, tournamentID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var participants []*domain.Participant
	for rows.Next() {
		var participant domain.Participant

		err := rows.Scan(
			&participant.ID,
			&participant.TournamentID,
			&participant.UserID,
			&participant.ParticipantName,
			&participant.Seed,
			&participant.CreatedAt,
			&participant.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Set default status if not set
		if participant.Status == "" {
			participant.Status = domain.ParticipantRegistered
		}

		participants = append(participants, &participant)
	}

	return participants, nil
}

// Update updates a participant in the database
func (r *participantRepository) Update(ctx context.Context, participant *domain.Participant) error {
	query := `
		UPDATE tournament_participants 
		SET participant_name = $1, updated_at = $2
		WHERE id = $3
	`

	result, err := r.db.ExecContext(ctx, query,
		participant.ParticipantName,
		participant.UpdatedAt,
		participant.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update participant: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return errors.New("participant not found")
	}

	return nil
}

// UpdateSeed updates a participant's seed
func (r *participantRepository) UpdateSeed(ctx context.Context, id uuid.UUID, seed int) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE tournament_participants SET
			seed = $1
		WHERE id = $2
	`, seed, id)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("participant not found: %v", id)
	}

	return nil
}

// CheckIn marks a participant as checked in
func (r *participantRepository) CheckIn(ctx context.Context, id uuid.UUID) error {
	now := time.Now()

	result, err := r.db.ExecContext(ctx, `
		UPDATE tournament_participants SET
			check_in_time = $1,
			is_checked_in = true
		WHERE id = $2
	`, now, id)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("participant not found: %v", id)
	}

	return nil
}

// Delete removes a participant
func (r *participantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM tournament_participants
		WHERE id = $1
	`, id)
	return err
}
