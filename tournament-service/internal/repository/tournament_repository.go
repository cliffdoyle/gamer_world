package repository

import (
	"context"
	"fmt"
	"time"
	"database/sql"
	"encoding/json"
	// "github.com/lib/pq"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

// TournamentRepository defines methods for tournament database operations
type TournamentRepository interface {
	Create(ctx context.Context, tournament *domain.Tournament) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Tournament, error)
	List(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*domain.Tournament, int, error)
	Update(ctx context.Context, tournament *domain.Tournament) error
	Delete(ctx context.Context, id uuid.UUID) error
	UpdateStatus(ctx context.Context, id uuid.UUID, status domain.TournamentStatus) error
	GetParticipantCount(ctx context.Context, tournamentID uuid.UUID) (int, error)
}


// tournamentRepository implements TournamentRepository interface
type tournamentRepository struct {
	db *sql.DB
}

// NewTournamentRepository creates a new tournament repository
func NewTournamentRepository(db *sql.DB) TournamentRepository {
	return &tournamentRepository{db: db}
}

// Create inserts a new tournament into the database
func (r *tournamentRepository) Create(ctx context.Context, tournament *domain.Tournament) error {
	// Generate UUID if not provided
	if tournament.ID == uuid.Nil {
		tournament.ID = uuid.New()
	}
	
	// Set timestamps
	now := time.Now()
	tournament.CreatedAt = now
	tournament.UpdatedAt = now
	
	// Set default status if not provided
	if tournament.Status == "" {
		tournament.Status = domain.Draft
	}
	
	// Convert maps to JSONB
	prizePoolJSON, err := json.Marshal(tournament.PrizePool)
	if err != nil {
		return err
	}
	
	customFieldsJSON, err := json.Marshal(tournament.CustomFields)
	if err != nil {
		return err
	}
	
	// Execute SQL insert
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO tournaments (
			id, name, description, game, format, status, max_participants,
			registration_deadline, start_time, end_time, created_by,
			created_at, updated_at, rules, prize_pool, custom_fields
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
	`,
		tournament.ID,
		tournament.Name,
		tournament.Description,
		tournament.Game,
		tournament.Format,
		tournament.Status,
		tournament.MaxParticipants,
		tournament.RegistrationDeadline,
		tournament.StartTime,
		tournament.EndTime,
		tournament.CreatedBy,
		tournament.CreatedAt,
		tournament.UpdatedAt,
		tournament.Rules,
		prizePoolJSON,
		customFieldsJSON,
	)
	
	return err
}

// GetByID retrieves a tournament by its ID
func (r *tournamentRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tournament, error) {
	var (
		tournament    domain.Tournament
		prizePoolJSON []byte
		customFieldsJSON []byte
	)
	
	err := r.db.QueryRowContext(ctx, `
		SELECT 
			id, name, description, game, format, status, max_participants,
			registration_deadline, start_time, end_time, created_by,
			created_at, updated_at, rules, prize_pool, custom_fields
		FROM tournaments
		WHERE id = $1
	`, id).Scan(
		&tournament.ID,
		&tournament.Name,
		&tournament.Description,
		&tournament.Game,
		&tournament.Format,
		&tournament.Status,
		&tournament.MaxParticipants,
		&tournament.RegistrationDeadline,
		&tournament.StartTime,
		&tournament.EndTime,
		&tournament.CreatedBy,
		&tournament.CreatedAt,
		&tournament.UpdatedAt,
		&tournament.Rules,
		&prizePoolJSON,
		&customFieldsJSON,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tournament not found: %v", id)
		}
		return nil, err
	}
	
	// Parse JSONB fields
	if len(prizePoolJSON) > 0 {
		if err := json.Unmarshal(prizePoolJSON, &tournament.PrizePool); err != nil {
			return nil, err
		}
	}
	
	if len(customFieldsJSON) > 0 {
		if err := json.Unmarshal(customFieldsJSON, &tournament.CustomFields); err != nil {
			return nil, err
		}
	}
	
	return &tournament, nil
}

// List retrieves tournaments based on filters with pagination
func (r *tournamentRepository) List(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*domain.Tournament, int, error) {
	// Start with base query
	query := `
		SELECT 
			id, name, description, game, format, status, max_participants,
			registration_deadline, start_time, end_time, created_by,
			created_at, updated_at, rules, prize_pool, custom_fields
		FROM tournaments
		WHERE 1=1
	`
	
	// Build where clause and args based on filters
	args := []interface{}{}
	argIndex := 1
	
	if v, ok := filters["status"]; ok {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, v)
		argIndex++
	}
	
	if v, ok := filters["game"]; ok {
		query += fmt.Sprintf(" AND game = $%d", argIndex)
		args = append(args, v)
		argIndex++
	}
	
	if v, ok := filters["created_by"]; ok {
		query += fmt.Sprintf(" AND created_by = $%d", argIndex)
		args = append(args, v)
		argIndex++
	}
	
	// Count total before pagination
	countQuery := "SELECT COUNT(*) FROM (" + query + ") AS count_query"
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}
	
	// Add pagination
	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", argIndex) + " OFFSET $" + fmt.Sprintf("%d", argIndex+1)
	args = append(args, pageSize, (page-1)*pageSize)
	
	// Execute the query
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	
	// Process results
	tournaments := []*domain.Tournament{}
	for rows.Next() {
		var (
			tournament    domain.Tournament
			prizePoolJSON []byte
			customFieldsJSON []byte
		)
		
		err := rows.Scan(
			&tournament.ID,
			&tournament.Name,
			&tournament.Description,
			&tournament.Game,
			&tournament.Format,
			&tournament.Status,
			&tournament.MaxParticipants,
			&tournament.RegistrationDeadline,
			&tournament.StartTime,
			&tournament.EndTime,
			&tournament.CreatedBy,
			&tournament.CreatedAt,
			&tournament.UpdatedAt,
			&tournament.Rules,
			&prizePoolJSON,
			&customFieldsJSON,
		)
		
		if err != nil {
			return nil, 0, err
		}
		
		// Parse JSONB fields
		if len(prizePoolJSON) > 0 {
			if err := json.Unmarshal(prizePoolJSON, &tournament.PrizePool); err != nil {
				return nil, 0, err
			}
		}
		
		if len(customFieldsJSON) > 0 {
			if err := json.Unmarshal(customFieldsJSON, &tournament.CustomFields); err != nil {
				return nil, 0, err
			}
		}
		
		tournaments = append(tournaments, &tournament)
	}
	
	if err = rows.Err(); err != nil {
		return nil, 0, err
	}
	
	return tournaments, total, nil
}

// Update updates an existing tournament
func (r *tournamentRepository) Update(ctx context.Context, tournament *domain.Tournament) error {
	// Update timestamp
	tournament.UpdatedAt = time.Now()
	
	// Convert maps to JSONB
	prizePoolJSON, err := json.Marshal(tournament.PrizePool)
	if err != nil {
		return err
	}
	
	customFieldsJSON, err := json.Marshal(tournament.CustomFields)
	if err != nil {
		return err
	}
	
	// Execute SQL update
	result, err := r.db.ExecContext(ctx, `
		UPDATE tournaments SET
			name = $1,
			description = $2,
			game = $3,
			format = $4,
			max_participants = $5,
			registration_deadline = $6,
			start_time = $7,
			end_time = $8,
			updated_at = $9,
			rules = $10,
			prize_pool = $11,
			custom_fields = $12
		WHERE id = $13
	`,
		tournament.Name,
		tournament.Description,
		tournament.Game,
		tournament.Format,
		tournament.MaxParticipants,
		tournament.RegistrationDeadline,
		tournament.StartTime,
		tournament.EndTime,
		tournament.UpdatedAt,
		tournament.Rules,
		prizePoolJSON,
		customFieldsJSON,
		tournament.ID,
	)
	
	if err != nil {
		return err
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	
	if rowsAffected == 0 {
		return fmt.Errorf("tournament not found: %v", tournament.ID)
	}
	
	return nil
}

// Delete removes a tournament
func (r *tournamentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM tournaments WHERE id = $1", id)
	if err != nil {
		return err
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	
	if rowsAffected == 0 {
		return fmt.Errorf("tournament not found: %v", id)
	}
	
	return nil
}

// UpdateStatus updates the status of a tournament
func (r *tournamentRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.TournamentStatus) error {
	now := time.Now()
	
	result, err := r.db.ExecContext(ctx, `
		UPDATE tournaments SET
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
		return fmt.Errorf("tournament not found: %v", id)
	}
	
	return nil
}

// GetParticipantCount returns the number of participants in a tournament
func (r *tournamentRepository) GetParticipantCount(ctx context.Context, tournamentID uuid.UUID) (int, error) {
	var count int
	
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1
	`, tournamentID).Scan(&count)
	
	if err != nil {
		return 0, err
	}
	
	return count, nil
}
