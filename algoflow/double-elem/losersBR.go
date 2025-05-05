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
// generateLosersBracket creates the losers bracket portion of a double elimination tournament
func (g *DoubleEliminationGenerator) generateLosersBracket(ctx context.Context, tournamentID uuid.UUID, winnersBracketRounds [][]*domain.Match) ([]*domain.Match, *domain.Match, error) {
	// Add debugging
	fmt.Println("Starting losers bracket generation...")
	fmt.Printf("Winners bracket rounds: %d\n", len(winnersBracketRounds))
	
	matches := make([]*domain.Match, 0)
	matchCounter := 1000 // Start losers bracket with a different counter

	// Initialize losers bracket rounds
	losersBracketRounds := make([][]*domain.Match, 0)

	// Keep track of "waiting" losers that haven't been assigned to a match yet
	waitingLosers := make([]uuid.UUID, 0)

	// Process losers from each winners round
	for winnersRound := 1; winnersRound < len(winnersBracketRounds); winnersRound++ {
		fmt.Printf("Processing winners round %d\n", winnersRound)
		
		// Get losers from this winners round
		losersFromThisRound := make([]uuid.UUID, 0)

		// Make sure we're checking the previous round's matches
		previousRoundMatches := winnersBracketRounds[winnersRound-1]
		fmt.Printf("Previous round has %d matches\n", len(previousRoundMatches))
		
		for i, match := range previousRoundMatches {
			// Check if the match has BOTH players assigned
			// Adjust field names to match your actual struct
			if match.WinnerID != nil {
				if *match.WinnerID == *match.Participant1ID {
					losersFromThisRound = append(losersFromThisRound, *match.Participant2ID)
				} else {
					losersFromThisRound = append(losersFromThisRound, *match.Participant1ID)
				}
			} else {
				fmt.Printf("Match %d doesn't have a winner yet, skipping loser assignment\n", i)
			}
			
		}

		// Skip if no losers in this round
		if len(losersFromThisRound) == 0 {
			fmt.Println("No losers in this round, continuing")
			continue
		}

		// Add these losers to our waiting pool
		fmt.Printf("Adding %d losers to waiting pool\n", len(losersFromThisRound))
		waitingLosers = append(waitingLosers, losersFromThisRound...)

		// Create matches for losers according to the standard double elimination pattern
		currentRoundMatches := make([]*domain.Match, 0)

		if winnersRound == 1 {
			fmt.Println("Processing first round losers")
			// First round losers - pair them up, handling odd number of players
			for i := 0; i < len(waitingLosers); i += 2 {
				match := &domain.Match{
					ID:           uuid.New(),
					TournamentID: tournamentID,
					Round:        len(losersBracketRounds) + 1,
					MatchNumber:  matchCounter,
					Status:       domain.MatchPending,
				}

				// Connect first loser to this match
				winnerIndex := i / 2
				// Connect loser from winners bracket to this match
				if winnerIndex < len(previousRoundMatches) {
					fmt.Printf("Connecting loser from winners match %d to losers match %d\n", winnerIndex, matchCounter)
					previousRoundMatches[winnerIndex].LoserNextMatchID = &match.ID
				}

				// If we have a second loser for this match
				if i+1 < len(waitingLosers) {
					winnerIndex = (i+1) / 2
					if winnerIndex < len(previousRoundMatches) {
						fmt.Printf("Connecting second loser from winners match %d to losers match %d\n", winnerIndex, matchCounter)
						previousRoundMatches[winnerIndex].LoserNextMatchID = &match.ID
					}
				}

				currentRoundMatches = append(currentRoundMatches, match)
				matches = append(matches, match)
				matchCounter++
			}
			// Clear the waiting losers as they've been assigned
			waitingLosers = nil
		} else if len(losersBracketRounds) > 0 {
			fmt.Println("Processing subsequent round losers")
			// For subsequent rounds, losers play against winners from previous losers round
			prevLosersRound := losersBracketRounds[len(losersBracketRounds)-1]
			fmt.Printf("Previous losers round has %d matches\n", len(prevLosersRound))

			// Step 1: Match losers from winners bracket with winners from previous losers round
			matchesNeeded := min(len(waitingLosers), len(prevLosersRound))
			fmt.Printf("Creating %d matches for losers vs previous winners\n", matchesNeeded)
			
			for i := 0; i < matchesNeeded; i++ {
				match := &domain.Match{
					ID:           uuid.New(),
					TournamentID: tournamentID,
					Round:        len(losersBracketRounds) + 1,
					MatchNumber:  matchCounter,
					Status:       domain.MatchPending,
				}

				// Connect loser from winners bracket to this match
				// IMPORTANT: Fix the index here, use winnersRound-1
				if i < len(previousRoundMatches) {
					fmt.Printf("Connecting loser from winners match %d to losers match %d\n", i, matchCounter)
					previousRoundMatches[i].LoserNextMatchID = &match.ID
				}

				// Connect winner from previous losers round if available
				if i < len(prevLosersRound) {
					fmt.Printf("Connecting winner from previous losers match %d to losers match %d\n", i, matchCounter)
					prevLosersRound[i].NextMatchID = &match.ID
				}

				currentRoundMatches = append(currentRoundMatches, match)
				matches = append(matches, match)
				matchCounter++
			}

			// Remove the used losers
			if len(waitingLosers) > matchesNeeded {
				waitingLosers = waitingLosers[matchesNeeded:]
				fmt.Printf("%d losers remaining in waiting pool\n", len(waitingLosers))
			} else {
				waitingLosers = nil
				fmt.Println("All losers assigned, clearing waiting pool")
			}
		}
		
		// Add current round to losers bracket rounds
		if len(currentRoundMatches) > 0 {
			fmt.Printf("Adding round with %d matches to losers bracket\n", len(currentRoundMatches))
			losersBracketRounds = append(losersBracketRounds, currentRoundMatches)
		}

		// If we have more than one match in current round, create a consolidation round
		if len(currentRoundMatches) > 1 {
			fmt.Println("Creating consolidation round")
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
				fmt.Printf("Connecting winner from losers match %d to consolidation match %d\n", currentRoundMatches[i].MatchNumber, matchCounter)
				currentRoundMatches[i].NextMatchID = &match.ID

				// Connect second winner if available
				if i+1 < len(currentRoundMatches) {
					fmt.Printf("Connecting second winner from losers match %d to consolidation match %d\n", currentRoundMatches[i+1].MatchNumber, matchCounter)
					currentRoundMatches[i+1].NextMatchID = &match.ID
				}

				consolidationMatches = append(consolidationMatches, match)
				matches = append(matches, match)
				matchCounter++
			}
			
			if len(consolidationMatches) > 0 {
				fmt.Printf("Adding consolidation round with %d matches\n", len(consolidationMatches))
				losersBracketRounds = append(losersBracketRounds, consolidationMatches)
			}
		}
	}

	// Connect any remaining matches to form the losers bracket
	for i := 0; i < len(losersBracketRounds)-1; i++ {
		currentRound := losersBracketRounds[i]
		nextRound := losersBracketRounds[i+1]

		// Connect matches in the current round to the next round
		for j, match := range currentRound {
			if match.NextMatchID == nil && j/2 < len(nextRound) {
				fmt.Printf("Connecting match %d to next round match %d\n", match.MatchNumber, nextRound[j/2].MatchNumber)
				match.NextMatchID = &nextRound[j/2].ID
			}
		}
	}

	// Return the final match of losers bracket
	var losersFinalMatch *domain.Match
	if len(losersBracketRounds) > 0 && len(losersBracketRounds[len(losersBracketRounds)-1]) > 0 {
		losersFinalMatch = losersBracketRounds[len(losersBracketRounds)-1][0]
		fmt.Printf("Final losers match: %s (Match %d)\n", losersFinalMatch.ID, losersFinalMatch.MatchNumber)
	} else {
		fmt.Println("No final match in losers bracket")
	}

	fmt.Printf("Created %d total matches in losers bracket\n", len(matches))
	return matches, losersFinalMatch, nil
}

// Helper function to get the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
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
