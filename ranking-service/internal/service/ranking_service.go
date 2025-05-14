// ranking-service/internal/service/ranking_service.go
package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sort" // For sorting user IDs for batch fetching

	"github.com/cliffdoyle/ranking-service/internal/client" // Assuming client package
	"github.com/cliffdoyle/ranking-service/internal/domain"
	"github.com/cliffdoyle/ranking-service/internal/repository"
	"github.com/google/uuid"
)

type RankingService interface {
	ProcessMatchResults(ctx context.Context, event domain.MatchResultEvent) error
	GetUserRanking(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserOverallStats, error)
	GetLeaderboard(ctx context.Context, gameID string, page int, pageSize int) ([]domain.LeaderboardEntry, int, error)
}

type rankingService struct {
	repo              repository.RankingRepository
	userServiceClient client.UserServiceClient // Added UserServiceClient
}

// NewRankingService updated to accept UserServiceClient
func NewRankingService(repo repository.RankingRepository, userServiceClient client.UserServiceClient) RankingService {
	return &rankingService{
		repo:              repo,
		userServiceClient: userServiceClient,
	}
}

func (s *rankingService) ProcessMatchResults(ctx context.Context, event domain.MatchResultEvent) error {
	log.Printf("Service: Processing match results for game '%s', tournament '%s', match '%s'",
		event.GameID, event.TournamentID, event.MatchID)

	if event.MatchID == uuid.Nil {
		return fmt.Errorf("matchID cannot be nil for processing results")
	}
	if len(event.Users) == 0 {
		return fmt.Errorf("no user outcomes provided in match result event for match %s", event.MatchID)
	}

	// Begin transaction
	tx, err := s.repo.DB().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction for match %s: %w", event.MatchID, err)
	}
	// Defer rollback/commit
	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p) // re-throw panic after Rollback
		} else if err != nil {
			log.Printf("Rolling back transaction for match %s due to error: %v", event.MatchID, err)
			tx.Rollback()
		} else {
			log.Printf("Committing transaction for match %s", event.MatchID)
			err = tx.Commit()
			if err != nil {
				log.Printf("Failed to commit transaction for match %s: %v", event.MatchID, err)
			}
		}
	}()

	// 1. Check for Idempotency
	isProcessed, err := s.repo.IsMatchEventProcessed(ctx, tx, event.MatchID)
	if err != nil {
		// err will be set, causing rollback by defer
		return fmt.Errorf("error checking if match event %s was processed: %w", event.MatchID, err)
	}
	if isProcessed {
		log.Printf("Match event %s (tournament %s) already processed. Skipping.", event.MatchID, event.TournamentID)
		err = nil // Ensure commit of empty transaction
		return nil // Successfully skipped
	}

	// 2. Process each user's outcome
	var processingErrors []error
	for _, userOutcome := range event.Users {
		_, outcomeErr := s.repo.ProcessMatchOutcome(ctx, tx, userOutcome.UserID, event.GameID, event.TournamentID, userOutcome.Outcome)
		if outcomeErr != nil {
			log.Printf("Error processing outcome for user %s in match %s (game '%s', tournament '%s'): %v. Outcome: %s",
				userOutcome.UserID, event.MatchID, event.GameID, event.TournamentID, outcomeErr, userOutcome.Outcome)
			processingErrors = append(processingErrors, outcomeErr)
		} else {
			log.Printf("Successfully processed outcome %s for user %s (game '%s', tournament '%s') within transaction",
				userOutcome.Outcome, userOutcome.UserID, domain.ResolveGameID(event.GameID), event.TournamentID)
		}
	}

	if len(processingErrors) > 0 {
		err = fmt.Errorf("one or more errors occurred while processing user outcomes for match %s: %v", event.MatchID, processingErrors)
		return err // This will trigger rollback in defer
	}

	// 3. Mark Event as Processed
	err = s.repo.MarkMatchEventAsProcessed(ctx, tx, event.MatchID, event.TournamentID, event.GameID)
	if err != nil {
		return fmt.Errorf("failed to mark match event %s as processed: %w", event.MatchID, err)
	}

	return nil
}

func (s *rankingService) GetUserRanking(ctx context.Context, userID uuid.UUID, gameID string) (*domain.UserOverallStats, error) {
	effectiveGameID := domain.ResolveGameID(gameID)
	scoreData, err := s.repo.GetUserScoreData(ctx, userID, effectiveGameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user score data for user %s, game %s: %w", userID, effectiveGameID, err)
	}

	var calculatedRank int
	if scoreData.MatchesPlayed > 0 || scoreData.Score > 0 {
		queryRank := `SELECT COUNT(*) + 1 FROM user_scores WHERE game_id = $1 AND score > $2`
		dbErr := s.repo.DB().QueryRowContext(ctx, queryRank, effectiveGameID, scoreData.Score).Scan(&calculatedRank)
		if dbErr != nil {
			if dbErr == sql.ErrNoRows {
				calculatedRank = 1
			} else {
				log.Printf("Service: Error calculating rank for user %s in game %s (score %d): %v", userID, effectiveGameID, scoreData.Score, dbErr)
				calculatedRank = 0 // Indicate rank calculation issue or unranked
			}
		}
	} else {
		calculatedRank = 0
	}

	winRate := 0.0
	if scoreData.MatchesPlayed > 0 {
		winRate = float64(scoreData.MatchesWon) / float64(scoreData.MatchesPlayed)
	}

	rankTitle := "Unranked"
	level := 1
	// CORRECTED: Use scoreData.Score instead of scoreData.Points
	if calculatedRank > 0 && scoreData.Score > 0 { // User is ranked and has points (score)
		switch {
		case scoreData.Score >= 200:
			rankTitle = "Diamond"
			level = 5
		case scoreData.Score >= 150:
			rankTitle = "Platinum"
			level = 4
		case scoreData.Score >= 100:
			rankTitle = "Gold"
			level = 3
		case scoreData.Score >= 50:
			rankTitle = "Silver"
			level = 2
		default: // scoreData.Score > 0
			rankTitle = "Bronze"
			level = 1
		}
	} else if scoreData.MatchesPlayed > 0 && scoreData.Score == 0 { // Played matches but 0 points
		rankTitle = "Participant"
		level = 1
	}
	// If calculatedRank is 0 (unranked), title remains "Unranked" and level 1

	stats := &domain.UserOverallStats{
		UserID:            scoreData.UserID,
		GameID:            effectiveGameID,
		Points:            scoreData.Score, // domain.UserOverallStats uses "Points", maps from scoreData.Score
		GlobalRank:        calculatedRank,
		WinRate:           winRate,
		TotalGamesPlayed:  scoreData.MatchesPlayed,
		MatchesWon:        scoreData.MatchesWon,
		MatchesDrawn:      scoreData.MatchesDrawn,
		MatchesLost:       scoreData.MatchesLost,
		TournamentsPlayed: scoreData.TournamentsPlayed,
		UpdatedAt:         scoreData.UpdatedAt,
		Level:             level,
		RankTitle:         rankTitle,
	}
	return stats, nil
}

func (s *rankingService) GetLeaderboard(ctx context.Context, gameID string, page int, pageSize int) ([]domain.LeaderboardEntry, int, error) {
	log.Printf("Service: Getting leaderboard for game %s, page %d, pageSize %d", gameID, page, pageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20 // Default
	} else if pageSize > 100 {
		pageSize = 100 // Max
	}
	offset := (page - 1) * pageSize

	entries, totalPlayers, err := s.repo.GetLeaderboard(ctx, gameID, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get leaderboard from repository: %w", err)
	}

	if s.userServiceClient != nil && len(entries) > 0 {
		userIDs := make([]uuid.UUID, 0, len(entries))
		for _, entry := range entries {
			userIDs = append(userIDs, entry.UserID)
		}

		sort.Slice(userIDs, func(i, j int) bool {
			return userIDs[i].String() < userIDs[j].String()
		})

		userDetailsMap, err := s.userServiceClient.GetMultipleUserDetails(ctx, userIDs)
		if err != nil {
			log.Printf("Warning: Failed to get multiple user details for leaderboard: %v. Usernames will be missing/default.", err)
			for i := range entries {
				if entries[i].UserName == "" {
					entries[i].UserName = "Player"
				}
			}
		} else {
			for i := range entries {
				if details, ok := userDetailsMap[entries[i].UserID]; ok {
					entries[i].UserName = details.Username
				} else {
					log.Printf("Warning: User details not found for UserID %s in batch response.", entries[i].UserID)
					if entries[i].UserName == "" {
						entries[i].UserName = "Player"
					}
				}
			}
		}
	} else if len(entries) > 0 {
		for i := range entries {
			if entries[i].UserName == "" {
				entries[i].UserName = "Player"
			}
		}
	}

	return entries, totalPlayers, nil
}