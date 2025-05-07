package doubleelem

import (
	"context"
	"errors"
	"time"

	"algoflow/domain"

	"github.com/google/uuid"
)

type DoubleElimGenerator struct {
	SingleElim *SingleEliminationGenerator
}

func (g *DoubleElimGenerator) GenerateDouble(ctx context.Context, tournaID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, [][]*domain.Match, [][]*domain.Match, error) {
	// Step 1: Generate winners bracket
	winnersMatches, winnerRounds, err := g.SingleElim.generateSingleElimination(ctx, tournaID, participants)
	if err != nil {
		return nil, nil, nil, err
	}
	loserRounds := make([][]*domain.Match, 0)

	allMatches := make([]*domain.Match, 0)
	allMatches = append(allMatches, winnersMatches...)

	return allMatches, winnerRounds, loserRounds, nil
}

func (g *SingleEliminationGenerator) GenerateLosers(ctx context.Context, tournamentID uuid.UUID, winnerRounds [][]*domain.Match) ([][]*domain.Match, error) {
	if len(winnerRounds) < 2 {
		return nil, errors.New("cannot generate loser's bracket with less than 2 winner rounds")
	}

	losersRounds := make([][]*domain.Match, 0)
	matchCounter := 1000

	// Step 1: Process WB Round 1 losers for LB Round 1
	firstRoundLosers := []*uuid.UUID{}
	for _, match := range winnerRounds[0] {
		if match.LoserID != nil {
			firstRoundLosers = append(firstRoundLosers, match.LoserID)
		}
	}

	// Step 2: Create LB Round 1
	lbFirstRound := []*domain.Match{}
	byePlayers := []*uuid.UUID{}

	for i := 0; i < len(firstRoundLosers); i += 2 {
		if i+1 < len(firstRoundLosers) {
			match := &domain.Match{
				TournamentID:   tournamentID,
				MatchNumber:    matchCounter,
				Round:          1,
				Participant1ID: firstRoundLosers[i],
				Participant2ID: firstRoundLosers[i+1],
				BracketType:    domain.LosersBracket,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}
			lbFirstRound = append(lbFirstRound, match)
			matchCounter++
		} else {
			byePlayers = append(byePlayers, firstRoundLosers[i])
		}
	}

	losersRounds = append(losersRounds, lbFirstRound)

	// Step 3: Generate LB rounds starting from Round 2
	prevRound := lbFirstRound
	currentByes := byePlayers

	for roundIndex := 1; roundIndex < len(winnerRounds); roundIndex++ {
		currentPlayers := []*uuid.UUID{}

		// 1. Add winners from previous LB round (placeholders now, filled later)
		for _, match := range prevRound {
			if match.WinnerID != nil {
				currentPlayers = append(currentPlayers, match.WinnerID)
			}
		}

		// 2. Add bye players from previous round
		currentPlayers = append(currentPlayers, currentByes...)

		// 3. Add new losers from the corresponding WB round
		for _, match := range winnerRounds[roundIndex] {
			if match.LoserID != nil {
				currentPlayers = append(currentPlayers, match.LoserID)
			}
		}

		// Build current LB round
		currentRound := []*domain.Match{}
		nextRoundByes := []*uuid.UUID{}

		for i := 0; i < len(currentPlayers); i += 2 {
			if i+1 < len(currentPlayers) {
				match := &domain.Match{
					TournamentID:   tournamentID,
					MatchNumber:    matchCounter,
					Round:          roundIndex + 1,
					Participant1ID: currentPlayers[i],
					Participant2ID: currentPlayers[i+1],
					BracketType:    domain.LosersBracket,
					CreatedAt:      time.Now(),
					UpdatedAt:      time.Now(),
				}
				currentRound = append(currentRound, match)
				matchCounter++
			} else {
				nextRoundByes = append(nextRoundByes, currentPlayers[i])
			}
		}

		losersRounds = append(losersRounds, currentRound)
		prevRound = currentRound
		currentByes = nextRoundByes
	}

	return losersRounds, nil
}
