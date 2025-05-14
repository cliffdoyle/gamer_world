// internal/service/ranking_service.go
package service

import (
	"context"
	"database/sql" // Added for sql.ErrNoRows in GetUserRanking
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/cliffdoyle/ranking-service/internal/domain"
	"github.com/cliffdoyle/ranking-service/internal/repository"
)

type RankingService interface {
	ProcessMatchResults(ctx context.Context, event domain.MatchResultEvent) error
	GetUserRanking(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error)
	GetLeaderboard(ctx context.Context, gameID string, page int, pageSize int) ([]domain.LeaderboardEntry, int, error)
}

type rankingService struct {
	repo repository.RankingRepository
}

func NewRankingService(repo repository.RankingRepository) RankingService {
	return &rankingService{repo: repo}
}

const (
	pointsForWin  = 3
	pointsForDraw = 1
	pointsForLoss = 0
)

// defaultInitialScore can be used if you want new users to start at a value other than 0 before their first point-affecting game
// const defaultInitialScore = 0; // This is now handled by repo if user is not found (starts at 0 + pointsToAdd)

func (s *rankingService) ProcessMatchResults(ctx context.Context, event domain.MatchResultEvent) error {
	log.Printf("Service: Processing match results for game %s, match %s", event.GameID, event.MatchID)

	if len(event.Users) == 0 {
		return fmt.Errorf("no user outcomes provided in match result event for match %s", event.MatchID)
	}

	for _, userOutcome := range event.Users {
		var pointsToAdd int
		switch userOutcome.Outcome {
		case domain.Win:
			pointsToAdd = pointsForWin
		case domain.Draw:
			pointsToAdd = pointsForDraw
		case domain.Loss:
			pointsToAdd = pointsForLoss
		default:
			log.Printf("Warning: Unknown outcome '%s' for user %s in match %s. Awarding 0 points.",
				userOutcome.Outcome, userOutcome.UserID, event.MatchID)
			pointsToAdd = 0
		}

		_, err := s.repo.UpdateUserPoints(ctx, userOutcome.UserID, event.GameID, pointsToAdd)
		if err != nil {
			// Decide on error handling: continue processing others, or fail all?
			// For now, log and continue. Could collect errors.
			log.Printf("Error updating points for user %s in match %s (game %s): %v. Outcome: %s, Points: %d",
				userOutcome.UserID, event.MatchID, event.GameID, err, userOutcome.Outcome, pointsToAdd)
			// return fmt.Errorf("failed to update points for user %s: %w", userOutcome.UserID, err) // This would stop processing other users
		} else {
			log.Printf("Successfully processed outcome %s (+%d points) for user %s, game %s",
				userOutcome.Outcome, pointsToAdd, userOutcome.UserID, domain.ResolveGameID(event.GameID))
		}
	}
	return nil
}

func (s *rankingService) GetUserRanking(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserRanking, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	userRankingData, err := s.repo.GetUserScoreAndRankData(ctx, userID, effectiveGameID)
	if err != nil {
		return nil, err // Repository error
	}

	// If UserRankingData.UpdatedAt is zero, it means user was not found and repo returned defaults.
	// In this "unranked" scenario, their rank relative to others with actual scores could be considered last + 1 or 0.
	if userRankingData.UpdatedAt.IsZero() {
		// Query total number of ranked players in this game to determine the rank for a new/unranked player
		queryTotalRanked := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1`
		var totalRankedPlayers int
		err = s.repo.DB().QueryRowContext(ctx, queryTotalRanked, effectiveGameID).Scan(&totalRankedPlayers)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("Service: Error counting total ranked players for game %s: %v", effectiveGameID, err)
			userRankingData.Rank = 0 // Fallback if count fails
		} else {
			userRankingData.Rank = totalRankedPlayers + 1 // They are after all currently ranked players
			if totalRankedPlayers == 0 {
				userRankingData.Rank = 1
			} // If no one is ranked, they are first (once they play)
		}
		if userRankingData.Score == 0 {
			userRankingData.Rank = 0
		} // Truly unranked (0 points implies never played or only lost)

		log.Printf("Service: User %s is unranked (or new) in game %s. Score: %d, Calculated Rank: %d", userID, effectiveGameID, userRankingData.Score, userRankingData.Rank)
		return userRankingData, nil
	}

	// Calculate rank for an existing user
	// Rank = (number of players with score > myScore) + 1
	queryRank := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1 AND score > $2`
	var higherScoringPlayers int
	err = s.repo.DB().QueryRowContext(ctx, queryRank, effectiveGameID, userRankingData.Score).Scan(&higherScoringPlayers)
	if err != nil && err != sql.ErrNoRows { // sql.ErrNoRows means no one has a higher score
		log.Printf("Service: Error calculating rank for user %s in game %s: %v", userID, effectiveGameID, err)
		return nil, fmt.Errorf("failed to calculate rank for user %s: %w", userID, err)
	}

	userRankingData.Rank = higherScoringPlayers + 1
	log.Printf("Service: User %s, game %s, Score: %d, Calculated Rank: %d", userID, effectiveGameID, userRankingData.Score, userRankingData.Rank)
	return userRankingData, nil
}

// GetLeaderboard method remains the same.
func (s *rankingService) GetLeaderboard(ctx context.Context, gameID string, page int, pageSize int) ([]domain.LeaderboardEntry, int, error) {
	log.Printf("Service: Getting leaderboard for game %s, page %d, pageSize %d", gameID, page, pageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	entries, totalPlayers, err := s.repo.GetLeaderboard(ctx, gameID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get leaderboard from repository: %w", err)
	}
	// Optional enrichment of entries with user names from User Service could happen here
	return entries, totalPlayers, nil
}
