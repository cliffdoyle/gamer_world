package double

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/matt-west/algoflow/domain"
)

// calculateLosersBracketRounds determines the number of rounds in the losers bracket.
func calculateLosersBracketRounds(numParticipants int) int {
	if numParticipants < 2 {
		return 0
	}
	// Find the next power of 2 for bracket size
	bracketSize := 1
	for bracketSize < numParticipants {
		bracketSize *= 2
	}
	// Standard formula for double elimination losers bracket rounds
	// Number of rounds in Winners Bracket = log2(bracketSize)
	wbRounds := int(math.Log2(float64(bracketSize)))
	// Number of rounds in Losers Bracket = 2 * wbRounds - 2 (for standard structures, but might need adjustment)
	// Let's refine this slightly: LB has rounds corresponding to WB losers drop + consolidation rounds
	// It's often 2 * (wbRounds - 1)
	return 2 * (wbRounds - 1) // Common calculation, verify if edge cases need different logic
}

// generateLosersBracket creates the losers bracket part of a double elimination tournament
func (g *DoubleEliminationGenerator) generateLosersBracket(ctx context.Context, tournamentID uuid.UUID, winnersBracket []*domain.Match, winnersBracketMap map[int][]*domain.Match, numWinnersRounds int) ([]*domain.Match, error) {
	losersBracket := make([]*domain.Match, 0)
	matchCounter := len(winnersBracket) + 1

	// Initialize map to track losers bracket matches by round
	losersBracketMap := make(map[int][]*domain.Match)

	// Determine the expected number of losers bracket rounds based on initial participants might be better
	// We need the original number of participants passed to the generator or calculate bracket size from WB R1
	numParticipantsInWB := 0
	if round1WB, ok := winnersBracketMap[1]; ok {
		numParticipantsInWB = len(round1WB) * 2 // Assumes no byes in R1 representation, might need refinement
		// TODO: Handle Byes properly here if they affect participant count input to this func
	} else {
		// Cannot determine size if WB R1 is missing, maybe return error or use numWinnersRounds
		return nil, fmt.Errorf("cannot determine tournament size from winnersBracketMap")
	}
	numLosersRounds := calculateLosersBracketRounds(numParticipantsInWB)
	if numLosersRounds <= 0 {
		return losersBracket, nil // No losers bracket needed for < 3 participants
	}

	// Map to track matches by their position in each round (relative to that round)
	// We might not need positionMap if we just use slices per round directly

	// Start with round 1 of losers bracket (first drop-down from winners round 1)
	losersRound := 1
	winnersRound := 1

	// Phase 1: Create first drop-down round from winners bracket round 1
	winnersMatchesR1, ok := winnersBracketMap[winnersRound]
	if !ok || len(winnersMatchesR1) == 0 {
		// This shouldn't happen in a valid tournament structure > 1 participant
		return nil, fmt.Errorf("winners bracket round 1 is missing or empty")
	}

	firstRoundDropMatches := make([]*domain.Match, 0, len(winnersMatchesR1))
	losersBracketMap[losersRound] = make([]*domain.Match, 0, len(winnersMatchesR1))

	for _, winnerMatch := range winnersMatchesR1 {
		// Only create a losers match if the winners match actually occurred (wasn't a double bye, etc.)
		// For now, assume all matches in winnersBracketMap[1] represent potential losers
		loserMatch := &domain.Match{
			ID:               uuid.New(),
			TournamentID:     tournamentID,
			Round:            losersRound,
			MatchNumber:      matchCounter,
			Status:           domain.MatchPending,
			BracketType:      domain.LosersBracket,
			Participants:     make([]*domain.Participant, 0, 1), // Loser drops here
			PreviousMatchIDs: []uuid.UUID{winnerMatch.ID},
		}

		// Link this match as the loser's next match in the winners bracket
		winnerMatch.LoserNextMatchID = &loserMatch.ID

		losersBracket = append(losersBracket, loserMatch)
		firstRoundDropMatches = append(firstRoundDropMatches, loserMatch)
		losersBracketMap[losersRound] = append(losersBracketMap[losersRound], loserMatch)
		// positionMap[losersRound][position] = loserMatch // Use slice index if needed
		matchCounter++
	}

	// Phase 2: Create subsequent rounds dynamically
	currentLosersMatches := firstRoundDropMatches
	winnersRound++ // Advance WB round for potential next drop-down

	for losersRound = 2; losersRound <= numLosersRounds; losersRound++ {
		roundMatches := make([]*domain.Match, 0)
		losersBracketMap[losersRound] = make([]*domain.Match, 0)

		// Get potential losers from the corresponding winners bracket round
		wbLosersToProcess := []*domain.Match{}
		if wbMatchesForCurrentRound, ok := winnersBracketMap[winnersRound]; ok {
			wbLosersToProcess = wbMatchesForCurrentRound
		}

		// Determine round type based on inputs
		if len(wbLosersToProcess) > 0 {
			// --- Drop-down Round ---
			// Number of matches determined by winners from previous LB round
			numMatchesInRound := len(currentLosersMatches)
			if numMatchesInRound == 0 {
				// Should not happen if previous round existed, maybe break or log error
				fmt.Printf("Warning: LB Round %d has no preceding matches to feed into drop-down round.\n", losersRound)
				break
			}
			if numMatchesInRound != len(wbLosersToProcess) {
				// This condition is common in non-power-of-2 brackets.
				// The number of matches is determined by len(currentLosersMatches)
				// We pair them 1:1 with wbLosersToProcess, extra wbLosers might wait or implies structure error
				fmt.Printf("Info: LB Round %d mismatch: %d LB winners vs %d WB losers. Pairing based on LB winners.\n", losersRound, numMatchesInRound, len(wbLosersToProcess))
			}

			for i := 0; i < numMatchesInRound; i++ {
				loserMatch := &domain.Match{
					ID:               uuid.New(),
					TournamentID:     tournamentID,
					Round:            losersRound,
					MatchNumber:      matchCounter,
					Status:           domain.MatchPending,
					BracketType:      domain.LosersBracket,
					Participants:     make([]*domain.Participant, 0, 2),
					PreviousMatchIDs: make([]uuid.UUID, 0, 2),
				}

				// 1. Link previous losers bracket match winner
				prevLosersMatch := currentLosersMatches[i]
				prevLosersMatch.NextMatchID = &loserMatch.ID
				loserMatch.PreviousMatchIDs = append(loserMatch.PreviousMatchIDs, prevLosersMatch.ID)

				// 2. Link corresponding winners bracket match loser (if available)
				if i < len(wbLosersToProcess) {
					winnersMatch := wbLosersToProcess[i]
					winnersMatch.LoserNextMatchID = &loserMatch.ID
					loserMatch.PreviousMatchIDs = append(loserMatch.PreviousMatchIDs, winnersMatch.ID)
				} else {
					// This implies an uneven number of participants or structural issue upstream
					// How to handle this? Maybe the match waits for a participant?
					// For now, log it. The match will be created but might lack a second feeder.
					fmt.Printf("Warning: LB Round %d, Match %d: No corresponding WB loser found for previous LB match %s.\n", losersRound, matchCounter, prevLosersMatch.ID.String())
				}

				losersBracket = append(losersBracket, loserMatch)
				roundMatches = append(roundMatches, loserMatch)
				losersBracketMap[losersRound] = append(losersBracketMap[losersRound], loserMatch)
				matchCounter++
			}
			winnersRound++ // Advance WB round check for the *next* LB round

		} else {
			// --- Consolidation Round ---
			// Occurs if no losers are dropping from WB in this cycle.
			// Number of matches determined by pairing winners from previous LB round.
			numMatchesInRound := len(currentLosersMatches) / 2
			if len(currentLosersMatches)%2 != 0 {
				// Odd number of participants advancing - one gets a bye?
				// Standard DE brackets usually avoid this until the very final stages.
				// If this happens mid-bracket, it suggests an issue.
				// Let's assume standard structure implies even numbers here.
				// A single player advancing might just pass through?
				if len(currentLosersMatches) == 1 {
					// If only one player left, they advance without a match in this round.
					// This might mean the bracket is ending or needs the final match setup.
					// For the loop structure, we can potentially pass this player through.
					roundMatches = append(roundMatches, currentLosersMatches[0]) // Pass through
					fmt.Printf("Info: LB Round %d: Single participant %s advances (pass-through).\n", losersRound, currentLosersMatches[0].ID.String())
					// Do not increment matchCounter for a pass-through
				} else {
					fmt.Printf("Warning: LB Round %d consolidation has odd number of inputs (%d). Check bracket logic.\n", losersRound, len(currentLosersMatches))
					// Potentially create matches for floor(N/2) pairs and handle the odd one out?
					// For now, proceed with floor(N/2) matches.
				}

			}

			for i := 0; i < numMatchesInRound; i++ {
				loserMatch := &domain.Match{
					ID:               uuid.New(),
					TournamentID:     tournamentID,
					Round:            losersRound,
					MatchNumber:      matchCounter,
					Status:           domain.MatchPending,
					BracketType:      domain.LosersBracket,
					Participants:     make([]*domain.Participant, 0, 2),
					PreviousMatchIDs: make([]uuid.UUID, 0, 2),
				}

				// Link previous two losers bracket matches
				prevPos1 := i * 2
				prevPos2 := i*2 + 1

				// Bounds check just in case, though numMatchesInRound should guarantee this
				if prevPos1 < len(currentLosersMatches) {
					prevMatch1 := currentLosersMatches[prevPos1]
					prevMatch1.NextMatchID = &loserMatch.ID
					loserMatch.PreviousMatchIDs = append(loserMatch.PreviousMatchIDs, prevMatch1.ID)
				}

				if prevPos2 < len(currentLosersMatches) {
					prevMatch2 := currentLosersMatches[prevPos2]
					prevMatch2.NextMatchID = &loserMatch.ID
					loserMatch.PreviousMatchIDs = append(loserMatch.PreviousMatchIDs, prevMatch2.ID)
				}

				losersBracket = append(losersBracket, loserMatch)
				roundMatches = append(roundMatches, loserMatch)
				losersBracketMap[losersRound] = append(losersBracketMap[losersRound], loserMatch)
				matchCounter++
			}
			// If there was an odd player out, they might need to be added to roundMatches here
			// if len(currentLosersMatches)%2 != 0 && len(currentLosersMatches) > 1 {
			//     roundMatches = append(roundMatches, currentLosersMatches[len(currentLosersMatches)-1])
			// }
		}

		// Update matches for the next iteration
		currentLosersMatches = roundMatches
		if len(currentLosersMatches) <= 1 && losersRound >= numLosersRounds {
			// Bracket finished or only one player left for potential GF feed
			break
		}
		if len(currentLosersMatches) == 0 {
			// If a round produced no matches, something is wrong, terminate.
			fmt.Printf("Error: LB Round %d produced no advancing matches. Terminating generation.\n", losersRound)
			break
		}
	}

	// TODO: Consider adding the Grand Final setup logic here or in the calling function.
	// The final match(es) involving WB winner and LB winner.

	return losersBracket, nil
}

// Helper function (optional) to get bracket size
func getBracketSize(numParticipants int) int {
	if numParticipants <= 0 {
		return 0
	}
	size := 1
	for size < numParticipants {
		size *= 2
	}
	return size
}
