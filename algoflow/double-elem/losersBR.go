package doubleelem

import (
	"context"
	"fmt"

	"algoflow/domain"

	"github.com/google/uuid"
)

// DoubleEliminationGenerator implements the Generator interface for double elimination tournaments
type DoubleEliminationGenerator struct{}

// NewDoubleEliminationGenerator creates a new double elimination bracket generator
func NewDoubleEliminationGenerator() *DoubleEliminationGenerator {
	return &DoubleEliminationGenerator{}
}

// Generate implements the Generator interface
func (g *DoubleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, format Format, winnersBracketRounds [][]*domain.Match, options map[string]interface{}) ([]*domain.Match, *domain.Match, error) {
	// if len(participants) < 2 {
	// 	return nil, nil, errors.New("at least 2 participants are required for a tournament")
	// }

	switch format {
	case DoubleElimination:
		return g.generateLosersBracket(ctx, tournamentID, winnersBracketRounds)
	default:
		return nil, nil, fmt.Errorf("unsupported tournament format: %s", format)
	}
}

// generateLosersBracket creates the losers bracket portion of a double elimination tournament
func (g *DoubleEliminationGenerator) generateLosersBracket(ctx context.Context, tournamentID uuid.UUID, winnersBracketRounds [][]*domain.Match) ([]*domain.Match, *domain.Match, error) {
	matches := make([]*domain.Match, 0)
	matchCounter := 1000 // Start losers bracket with a different counter

	// Initialize losers bracket rounds
	losersBracketRounds := make([][]*domain.Match, 0)

	// Process losers from each winners round
	for winnersRound := 1; winnersRound < len(winnersBracketRounds); winnersRound++ {
		// Get losers from this winners round
		losersFromThisRound := len(winnersBracketRounds[winnersRound])

		// Skip if no matches in this round
		if losersFromThisRound == 0 {
			continue
		}

		// Create matches for losers from this round
		currentRoundMatches := make([]*domain.Match, 0)

		if winnersRound == 1 {
			// First round losers - handle odd number of players
			for i := 0; i < losersFromThisRound; i += 2 {
				match := &domain.Match{
					ID:           uuid.New(),
					TournamentID: tournamentID,
					Round:        len(losersBracketRounds) + 1,
					MatchNumber:  matchCounter,
					Status:       domain.MatchPending,
				}

				// Connect loser from winners bracket to this match
				winnersBracketRounds[winnersRound][i].LoserNextMatchID = &match.ID

				// If we have a second loser for this match
				if i+1 < losersFromThisRound {
					winnersBracketRounds[winnersRound][i+1].LoserNextMatchID = &match.ID
				}

				currentRoundMatches = append(currentRoundMatches, match)
				matches = append(matches, match)
				matchCounter++
			}
		} else {
			// For subsequent rounds, losers play against winners from previous losers round
			prevLosersRound := losersBracketRounds[len(losersBracketRounds)-1]

			// Create matches pairing winners bracket losers with previous losers round winners
			for i := 0; i < losersFromThisRound; i++ {
				match := &domain.Match{
					ID:           uuid.New(),
					TournamentID: tournamentID,
					Round:        len(losersBracketRounds) + 1,
					MatchNumber:  matchCounter,
					Status:       domain.MatchPending,
				}

				// Connect loser from winners bracket to this match
				winnersBracketRounds[winnersRound][i].LoserNextMatchID = &match.ID

				// Connect winner from previous losers round if available
				if i < len(prevLosersRound) {
					prevLosersRound[i].NextMatchID = &match.ID
				}

				currentRoundMatches = append(currentRoundMatches, match)
				matches = append(matches, match)
				matchCounter++
			}
		}

		losersBracketRounds = append(losersBracketRounds, currentRoundMatches)

		// If we have more than one match in current round, create a consolidation round
		if len(currentRoundMatches) > 1 {
			consolidationMatches := make([]*domain.Match, 0)

			// Create matches between winners of current round
			for i := 0; i < len(currentRoundMatches); i += 2 {
				match := &domain.Match{
					ID:           uuid.New(),
					TournamentID: tournamentID,
					Round:        len(losersBracketRounds) + 1,
					MatchNumber:  matchCounter,
					Status:       domain.MatchPending,
				}

				// Connect winners from current round
				currentRoundMatches[i].NextMatchID = &match.ID
				if i+1 < len(currentRoundMatches) {
					currentRoundMatches[i+1].NextMatchID = &match.ID
				}

				consolidationMatches = append(consolidationMatches, match)
				matches = append(matches, match)
				matchCounter++
			}

			losersBracketRounds = append(losersBracketRounds, consolidationMatches)
		}
	}

	// Return the final match of losers bracket
	var losersFinalMatch *domain.Match
	if len(losersBracketRounds) > 0 && len(losersBracketRounds[len(losersBracketRounds)-1]) > 0 {
		losersFinalMatch = losersBracketRounds[len(losersBracketRounds)-1][0]
	}

	return matches, losersFinalMatch, nil
}

// generateGrandFinals creates the grand finals match(es) for a double elimination tournament
func (g *DoubleEliminationGenerator) generateGrandFinals(ctx context.Context, tournamentID uuid.UUID, winnersFinalMatch *domain.Match, losersFinalMatch *domain.Match, resetBracket bool) ([]*domain.Match, error) {
	matches := make([]*domain.Match, 0)
	matchCounter := 2000 // Start grand finals with a different counter

	// First grand finals match
	grandFinals := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        1, // Grand finals round 1
		MatchNumber:  matchCounter,
		Status:       domain.MatchPending,
	}

	// Connect winners bracket final to grand finals
	winnersFinalMatch.NextMatchID = &grandFinals.ID

	// Connect losers bracket final to grand finals
	losersFinalMatch.NextMatchID = &grandFinals.ID

	matches = append(matches, grandFinals)
	matchCounter++

	// If reset bracket is enabled, create a potential second grand finals match
	if resetBracket {
		resetMatch := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        2, // Grand finals round 2 (reset)
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
		}

		// Connect first grand finals to reset match
		// Note: This match only happens if the losers bracket winner wins the first grand finals
		grandFinals.NextMatchID = &resetMatch.ID

		matches = append(matches, resetMatch)
	}

	return matches, nil
}

// Helper function to demonstrate match tracking
func (g *DoubleEliminationGenerator) trackMatchProgression(match *domain.Match) {
	// When a match is completed:
	if match.Status == domain.MatchCompleted {
		// 1. Winner is stored in WinnerID
		// 2. Loser is stored in LoserID
		// 3. Winner advances to match specified by NextMatchID
		// 4. Loser goes to losers bracket match specified by LoserNextMatchID
	}
}

// Example of how we process winners bracket rounds
func (g *DoubleEliminationGenerator) processWinnersBracket(roundMatches [][]*domain.Match) {
	// Loop through each round
	for round := 1; round < len(roundMatches); round++ {
		fmt.Printf("Round %d has %d matches\n", round, len(roundMatches[round]))

		// Loop through matches in this round
		for _, match := range roundMatches[round] {
			if match.Status == domain.MatchCompleted {
				// Winner advances to next winners bracket match
				if match.NextMatchID != nil {
					fmt.Printf("Winner of match %s advances to match %s\n",
						match.ID, *match.NextMatchID)
				}

				// Loser drops to losers bracket
				if match.LoserNextMatchID != nil {
					fmt.Printf("Loser of match %s drops to losers match %s\n",
						match.ID, *match.LoserNextMatchID)
				}
			}
		}
	}
}

// Example of a match in Round 1 with 7 players:
/*
Round 1 (3 matches + 1 bye):
Match1: Player1 vs Player2 -> Winner to Match4, Loser to LMatch1
Match2: Player3 vs Player4 -> Winner to Match4, Loser to LMatch1
Match3: Player5 vs Player6 -> Winner to Match5, Loser to LMatch2
Player7: Gets bye -> Advances to Match5

Round 2 (2 matches):
Match4: Winner(Match1) vs Winner(Match2) -> Winner to Match6, Loser to LMatch3
Match5: Winner(Match3) vs Player7 -> Winner to Match6, Loser to LMatch3

Round 3 (1 match - finals):
Match6: Winner(Match4) vs Winner(Match5) -> Winner to GrandFinals, Loser to LMatch4
*/
