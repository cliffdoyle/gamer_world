package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/lib/pq"
	"strings"

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
	GetParticipantCount(ctx context.Context, id uuid.UUID) (int, error)
	GetByStatuses(ctx context.Context, statuses []domain.TournamentStatus, limit int, offset int) ([]*domain.Tournament, int, error)
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
	// Set timestamps
	now := time.Now()
	tournament.CreatedAt = now
	tournament.UpdatedAt = now

	if tournament.PrizePool == nil {
		tournament.PrizePool = json.RawMessage("null") // Or "{}", depending on DB default/preference
	}
	if tournament.CustomFields == nil {
		tournament.CustomFields = json.RawMessage("null") // Or "{}"
	}


	_, err := r.db.ExecContext(ctx, `
		INSERT INTO tournaments (
			id, name, description, game, format, status,
			max_participants, registration_deadline, start_time,
			end_time, created_by, created_at, updated_at,
			rules, prize_pool, custom_fields
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16
		)
	`,
		tournament.ID,
		tournament.Name,
		tournament.Description,
		tournament.Game,
		tournament.Format,
		tournament.Status,
		tournament.MaxParticipants,
		tournament.RegistrationDeadline, // This is *time.Time, handles NULL correctly
		tournament.StartTime,            // This is *time.Time
		tournament.EndTime,              // This is *time.Time
		tournament.CreatedBy,
		tournament.CreatedAt,           // This is time.Time (NOT NULL)
		tournament.UpdatedAt,           // This is time.Time (NOT NULL)
		tournament.Rules,
		tournament.PrizePool,    // Pass json.RawMessage directly
		tournament.CustomFields, // Pass json.RawMessage directly
	)


	return err
}


// scanTournament is a helper to scan a tournament row
func scanTournament(scanner interface {
	Scan(dest ...interface{}) error
}) (*domain.Tournament, error) {
	var t domain.Tournament
	// For json.RawMessage, scan into []byte or sql.RawBytes.
	// If the DB column can be NULL, use sql.Null[Type] for basic types,
	// or check for nil after scanning for []byte for JSON types.
	var prizePoolBytes, customFieldsBytes []byte
	var dbRegDeadline, dbStartTime, dbEndTime sql.NullTime

	err := scanner.Scan(
		&t.ID,
		&t.Name,
		&t.Description,
		&t.Game,
		&t.Format,
		&t.Status,
		&t.MaxParticipants,
		&dbRegDeadline,
		&dbStartTime,
		&dbEndTime,
		&t.CreatedBy,
		&t.CreatedAt, // Assuming this is NOT NULL in DB and time.Time in struct
		&t.UpdatedAt, // Assuming this is NOT NULL in DB and time.Time in struct
		&t.Rules,
		&prizePoolBytes,    // Scan directly into []byte
		&customFieldsBytes, // Scan directly into []byte
	)
	if err != nil {
		return nil, err
	}

	// Assign to struct pointers if DB value was not NULL
	if dbRegDeadline.Valid {
		t.RegistrationDeadline = &dbRegDeadline.Time
	}
	if dbStartTime.Valid {
		t.StartTime = &dbStartTime.Time
	}
	if dbEndTime.Valid {
		t.EndTime = &dbEndTime.Time
	}

	// Assign scanned bytes to json.RawMessage fields if not nil
	// json.RawMessage(nil) is valid and represents JSON null
	if prizePoolBytes != nil {
		t.PrizePool = json.RawMessage(prizePoolBytes)
	}
	if customFieldsBytes != nil {
		t.CustomFields = json.RawMessage(customFieldsBytes)
	}
	// If prizePoolBytes or customFieldsBytes are nil from the DB (SQL NULL),
	// t.PrizePool and t.CustomFields will remain nil (their zero value),
	// which marshals to JSON `null` if omitempty is not set or is set but field is non-nil.
    // With omitempty, if they are nil, they are omitted from JSON.

	return &t, nil
}

// GetByID retrieves a tournament by ID
func (r *tournamentRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tournament, error) {
	var (
		tournament       domain.Tournament
		prizePoolJSON    []byte
		customFieldsJSON []byte
	)

	err := r.db.QueryRowContext(ctx, `
		SELECT 
			id, name, description, game, format, status,
			max_participants, registration_deadline, start_time,
			end_time, created_by, created_at, updated_at,
			rules, prize_pool, custom_fields
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

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("tournament not found: %v", id)
	}
	if err != nil {
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
	// Build query
	query := `
		SELECT 
			id, name, description, game, format, status,
			max_participants, registration_deadline, start_time,
			end_time, created_by, created_at, updated_at,
			rules, prize_pool, custom_fields
		FROM tournaments
		WHERE 1=1
	`
	countQuery := `SELECT COUNT(*) FROM tournaments WHERE 1=1`
	args := []interface{}{}
	argNum := 1

	// Add filters
	if status, ok := filters["status"]; ok {
		query += fmt.Sprintf(" AND status = $%d", argNum)
		countQuery += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, status)
		argNum++
	}
	if game, ok := filters["game"]; ok {
		query += fmt.Sprintf(" AND game = $%d", argNum)
		countQuery += fmt.Sprintf(" AND game = $%d", argNum)
		args = append(args, game)
		argNum++
	}

	// Add pagination
	offset := (page - 1) * pageSize
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, pageSize, offset)

	// Get total count
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args[:argNum-1]...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Execute query
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	// Scan results
	tournaments := []*domain.Tournament{}
	for rows.Next() {
		var (
			tournament       domain.Tournament
			prizePoolJSON    []byte
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

	return tournaments, total, nil
}

// Update updates a tournament in the database
func (r *tournamentRepository) Update(ctx context.Context, tournament *domain.Tournament) error {
	// Update timestamp
	tournament.UpdatedAt = time.Now()

	    // Ensure nil json.RawMessage becomes JSON null if necessary for DB, or specific default like "{}"
		if tournament.PrizePool == nil {
			tournament.PrizePool = json.RawMessage("null")
		}
		if tournament.CustomFields == nil {
			tournament.CustomFields = json.RawMessage("null")
		}

	// Execute SQL update
	result, err := r.db.ExecContext(ctx, `
		UPDATE tournaments SET
			name = $1,
			description = $2,
			game = $3,
			format = $4,
			status = $5,
			max_participants = $6,
			registration_deadline = $7,
			start_time = $8,
			end_time = $9,
			updated_at = $10,
			rules = $11,
			prize_pool = $12,
			custom_fields = $13
		WHERE id = $14
	`,
		tournament.Name,
		tournament.Description,
		tournament.Game,
		tournament.Format,
		tournament.Status,
		tournament.MaxParticipants,
		tournament.RegistrationDeadline,
		tournament.StartTime,
		tournament.EndTime,
		tournament.UpdatedAt,
		tournament.Rules,
		tournament.PrizePool,
		tournament.CustomFields,
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

// Delete removes a tournament by ID
func (r *tournamentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM tournaments
		WHERE id = $1
	`, id)
	return err
}

// GetParticipantCount returns the number of participants in a tournament
func (r *tournamentRepository) GetParticipantCount(ctx context.Context, id uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM tournament_participants
		WHERE tournament_id = $1
	`, id).Scan(&count)
	return count, err
}


// type tournamentRepository struct { db *sql.DB }
// func NewTournamentRepository(db *sql.DB) TournamentRepository { return &tournamentRepository{db: db} }
// GetByStatuses retrieves tournaments by specific statuses
func (r *tournamentRepository) GetByStatuses(ctx context.Context, statuses []domain.TournamentStatus, limit int, offset int) ([]*domain.Tournament, int, error) {
	var tournaments []*domain.Tournament
	var total int

	queryBuilder := strings.Builder{}
	queryBuilder.WriteString(`
		SELECT id, name, description, game, format, status, max_participants, 
		       registration_deadline, start_time, end_time, created_by, 
		       created_at, updated_at, rules, prize_pool, custom_fields 
		FROM tournaments 
	`)
	args := []interface{}{}
	paramIndex := 1

	if len(statuses) > 0 {
		queryBuilder.WriteString(fmt.Sprintf("WHERE status = ANY($%d) ", paramIndex))
		statusStrings := make([]string, len(statuses))
		for i, s := range statuses {
			statusStrings[i] = string(s)
		}
		args = append(args, pq.Array(statusStrings))
		paramIndex++
	}

	countQueryBuilder := strings.Builder{}
	countQueryBuilder.WriteString("SELECT COUNT(*) FROM tournaments ")
	var countArgs []interface{}
	if len(statuses) > 0 {
		countQueryBuilder.WriteString("WHERE status = ANY($1)")
        statusStringsForCount := make([]string, len(statuses)) // Rebuild for countArgs
		for i, s := range statuses {
			statusStringsForCount[i] = string(s)
		}
		countArgs = append(countArgs, pq.Array(statusStringsForCount))
	}
	
	err := r.db.QueryRowContext(ctx, countQueryBuilder.String(), countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count tournaments by status: %w", err)
	}

	queryBuilder.WriteString(fmt.Sprintf("ORDER BY COALESCE(start_time, '9999-12-31') ASC, created_at DESC LIMIT $%d OFFSET $%d", paramIndex, paramIndex+1))
	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query tournaments by status: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		tournament, err := scanTournament(rows) // Use the helper
		if err != nil {
			return nil, 0, err // scanTournament already formats error
		}
		tournaments = append(tournaments, tournament)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating tournament rows by status: %w", err)
	}

	return tournaments, total, nil
}