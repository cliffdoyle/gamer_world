// file: internal/repository/activity_repository.go
package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

type UserActivityRepository interface {
	Create(ctx context.Context, activity *domain.UserActivity) error
	GetByUserID(ctx context.Context, userID uuid.UUID, limit int, offset int) ([]*domain.UserActivity, int, error)
}

type userActivityRepository struct {
	db *sql.DB
}

func NewUserActivityRepository(db *sql.DB) UserActivityRepository {
	return &userActivityRepository{db: db}
}

func (r *userActivityRepository) Create(ctx context.Context, activity *domain.UserActivity) error {
	activity.ID = uuid.New() // Generate ID if not already set
	// CreatedAt will be set by DB default if schema has it, or set here:
	// if activity.CreatedAt.IsZero() { activity.CreatedAt = time.Now() }

	query := `INSERT INTO user_activities 
                (id, user_id, activity_type, description, related_entity_id, related_entity_type, context_url, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query,
		activity.ID, activity.UserID, activity.ActivityType, activity.Description,
		activity.RelatedEntityID, activity.RelatedEntityType, activity.ContextURL, activity.CreatedAt, // Ensure CreatedAt is set
	)
	if err != nil {
		return fmt.Errorf("failed to create user activity: %w", err)
	}
	return nil
}

func (r *userActivityRepository) GetByUserID(ctx context.Context, userID uuid.UUID, limit int, offset int) ([]*domain.UserActivity, int, error) {
	var activities []*domain.UserActivity
	var total int

	countQuery := "SELECT COUNT(*) FROM user_activities WHERE user_id = $1"
	err := r.db.QueryRowContext(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count user activities: %w", err)
	}

	query := `SELECT id, user_id, activity_type, description, 
	                 related_entity_id, related_entity_type, context_url, created_at 
	          FROM user_activities
	          WHERE user_id = $1
	          ORDER BY created_at DESC
	          LIMIT $2 OFFSET $3`
	rows, err := r.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query user activities: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var act domain.UserActivity
		// Nullable fields from DB need to be scanned into sql.Null... types first
		var relatedEntityID sql.NullString // Using sql.NullString for UUID here as it might be NULL
		var relatedEntityType sql.NullString
		var contextURL sql.NullString

		err := rows.Scan(
			&act.ID, &act.UserID, &act.ActivityType, &act.Description,
			&relatedEntityID, &relatedEntityType, &contextURL, &act.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan user activity row: %w", err)
		}

		if relatedEntityID.Valid {
			parsedUUID, parseErr := uuid.Parse(relatedEntityID.String)
			if parseErr == nil {
				act.RelatedEntityID = &parsedUUID
			}
		}
		if relatedEntityType.Valid {
			val := domain.RelatedEntityType(relatedEntityType.String)
			act.RelatedEntityType = &val
		}
		if contextURL.Valid {
			act.ContextURL = &contextURL.String
		}

		activities = append(activities, &act)
	}
	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating user activity rows: %w", err)
	}

	return activities, total, nil
}