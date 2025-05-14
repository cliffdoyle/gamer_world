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
// Let's assume you want to build UserOverallStats.
func (s *rankingService) GetUserRanking(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserOverallStats, error) { // Changed return type
    effectiveGameID := domain.ResolveGameID(gameID)
    scoreData, err := s.repo.GetUserScoreData(ctx, userID, effectiveGameID)
    if err != nil {
        return nil, fmt.Errorf("failed to get user score data: %w", err)
    }

    // Calculate Rank (number of players with score > myScore) + 1
    var higherScoringPlayers int
    if scoreData.MatchesPlayed > 0 { // Only calculate rank if they've played
        queryRank := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1 AND score > $2`
        err = s.repo.DB().QueryRowContext(ctx, queryRank, effectiveGameID, scoreData.Score).Scan(&higherScoringPlayers)
        if err != nil && err != sql.ErrNoRows {
            log.Printf("Service: Error calculating rank for user %s in game %s: %v", userID, effectiveGameID, err)
            // Don't fail the whole request, just set rank to 0 or a special value
            higherScoringPlayers = -1 // Indicate rank calculation error
        }
    } else {
        // User hasn't played any matches for this game, or no score record
        // How to rank users with 0 matches played? Typically unranked or at the bottom.
        // Let's count total players with score > 0 to place them after.
        queryTotalRanked := `SELECT COUNT(*) FROM user_scores WHERE game_id = $1 AND score > 0` // Or matches_played > 0
        var totalRankedPlayers int
        errDb := s.repo.DB().QueryRowContext(ctx, queryTotalRanked, effectiveGameID).Scan(&totalRankedPlayers)
        if errDb != nil && errDb != sql.ErrNoRows {
            log.Printf("Service: Error counting total ranked players for %s: %v", effectiveGameID, errDb)
            higherScoringPlayers = -1
        } else {
             higherScoringPlayers = totalRankedPlayers // They are after all these players
        }
    }


    rank := 0
    if higherScoringPlayers >= 0 {
        rank = higherScoringPlayers + 1
    }
    if scoreData.MatchesPlayed == 0 { // If no matches played, consider them unranked explicitly
        rank = 0
    }


    winRate := 0.0
    if scoreData.MatchesPlayed > 0 {
        winRate = float64(scoreData.MatchesWon) / float64(scoreData.MatchesPlayed)
    }

    // Construct UserOverallStats
    stats := &domain.UserOverallStats{
        UserID:            scoreData.UserID,
        GameID:            scoreData.GameID,
        Points:            scoreData.Score,
        GlobalRank:        rank,
        WinRate:           winRate,
        TotalGamesPlayed:  scoreData.MatchesPlayed, // Assuming "games" here means matches in this context
        MatchesWon:        scoreData.MatchesWon,
        MatchesDrawn:      scoreData.MatchesDrawn,
        MatchesLost:       scoreData.MatchesLost,
        TournamentsPlayed: scoreData.TournamentsPlayed,
        UpdatedAt:         scoreData.UpdatedAt,
        // Level and RankTitle would require more complex logic (e.g., thresholds)
        Level:     1,                // Placeholder
        RankTitle: "Bronze", // Placeholder
    }
    // Your previous GetUserRanking returned domain.UserRanking, which had fewer fields.
    // Ensure the handler is updated if you change the return type here.
    // For now, I've mapped to UserOverallStats as it's more comprehensive.
    return stats, nil
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
