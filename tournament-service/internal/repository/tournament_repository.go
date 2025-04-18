package repository

import (
	"context"

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
