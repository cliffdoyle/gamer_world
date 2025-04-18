package repository

import (
	"context"
	"database/sql"
	// "fmt"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

// MessageRepository defines methods for message database operations
type MessageRepository interface {
	Create(ctx context.Context, message *domain.Message) error
	ListByTournament(ctx context.Context, tournamentID uuid.UUID, limit, offset int) ([]*domain.Message, error)
}

// messageRepository implements MessageRepository interface
type messageRepository struct {
	db *sql.DB
}

// NewMessageRepository creates a new message repository
func NewMessageRepository(db *sql.DB) MessageRepository {
	return &messageRepository{db: db}
}

// Create inserts a new message into the database
func (r *messageRepository) Create(ctx context.Context, message *domain.Message) error {
	// Generate UUID if not provided
	if message.ID == uuid.Nil {
		message.ID = uuid.New()
	}

	// Set timestamp
	message.CreatedAt = time.Now()

	// Execute SQL insert
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO tournament_messages (
			id, tournament_id, user_id, message, created_at
		) VALUES (
			$1, $2, $3, $4, $5
		)
	`,
		message.ID,
		message.TournamentID,
		message.UserID,
		message.Message,
		message.CreatedAt,
	)

	return err
}

// ListByTournament retrieves messages for a tournament with pagination
func (r *messageRepository) ListByTournament(ctx context.Context, tournamentID uuid.UUID, limit, offset int) ([]*domain.Message, error) {
	// Use sensible defaults for pagination
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			id, tournament_id, user_id, message, created_at
		FROM tournament_messages
		WHERE tournament_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, tournamentID, limit, offset)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := []*domain.Message{}
	for rows.Next() {
		var message domain.Message

		err := rows.Scan(
			&message.ID,
			&message.TournamentID,
			&message.UserID,
			&message.Message,
			&message.CreatedAt,
		)

		if err != nil {
			return nil, err
		}

		messages = append(messages, &message)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return messages, nil
}