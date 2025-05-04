package bracket

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

// DoubleEliminationGenerator implements the Generator interface for double elimination tournaments
type DoubleEliminationGenerator struct{}

// NewDoubleEliminationGenerator creates a new double elimination bracket generator
func NewDoubleEliminationGenerator() *DoubleEliminationGenerator {
	return &DoubleEliminationGenerator{}
}

// Generate implements the Generator interface for double elimination format
func (g *DoubleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, format Format, participants []*domain.Participant, options map[string]interface{}) ([]*domain.Match, error) {
	if len(participants) < 2 {
		return nil, errors.New("at least 2 participants are required for a tournament")
	}

	// Default to true if not specified
	resetBracket := true
	if val, ok := options["resetBracket"].(bool); ok {
		resetBracket = val
	}

	return g.generateDoubleElimination(ctx, tournamentID, participants, resetBracket)
}

// generateDoubleElimination creates a double elimination bracket
func (g *DoubleEliminationGenerator) generateDoubleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant, resetBracket bool) ([]*domain.Match, error) {
	// Generate winners bracket using SingleEliminationGenerator
	singleElimGenerator := NewSingleEliminationGenerator()
	winnersBracketMatches, roundMatches, err := g.generateWinnersBracket(ctx, tournamentID, participants)
	if err != nil {
		return nil, err
	}

	// Generate losers bracket based on winners bracket
	losersBracketMatches, losersFinalMatch, err := g.generateLosersBracket(ctx, tournamentID, roundMatches)
	if err != nil {
		return nil, err
	}

	// Generate grand finals
	grandFinalsMatches, err := g.generateGrandFinals(ctx, tournamentID, winnersBracketMatches[len(winnersBracketMatches)-1], losersFinalMatch, resetBracket)
	if err != nil {
		return nil, err
	}

	// Combine all matches
	allMatches := make([]*domain.Match, 0)
	allMatches = append(allMatches, winnersBracketMatches...)
	allMatches = append(allMatches, losersBracketMatches...)
	allMatches = append(allMatches, grandFinalsMatches...)

	return allMatches, nil
}

// generateWinnersBracket creates the winners bracket portion of a double elimination tournament
// Returns the list of all matches, and a 2D slice of matches organized by round
func (g *DoubleEliminationGenerator) generateWinnersBracket(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, [][]*domain.Match, error) {
	if len(participants) < 2 {
		return nil, nil, errors.New("at least 2 participants are required for a tournament")
	}

	// Make a copy of participants to avoid modifying the original slice
	participantsCopy := make([]*domain.Participant, len(participants))
	copy(participantsCopy, participants)

	// Sort participants by seed
	sort.Slice(participantsCopy, func(i, j int) bool {
		return participantsCopy[i].Seed < participantsCopy[j].Seed
	})

	// Calculate the number of rounds needed
	numParticipants := len(participantsCopy)
	numRounds := int(math.Ceil(math.Log2(float64(numParticipants))))
	participantsPowerOfTwo := nextPowerOfTwo(numParticipants)

	// Create matches list
	matches := make([]*domain.Match, 0)
	matchCounter := 1

	// Apply Challonge-style seeding
	seededParticipants := applyChallongeSeeding(participantsCopy, participantsPowerOfTwo)

	// Initialize arrays to track matches in each round
	roundMatches := make([][]*domain.Match, numRounds+1)
	for i := 0; i <= numRounds; i++ {
		roundMatches[i] = make([]*domain.Match, 0)
	}

	// Calculate byes
	byeCount := participantsPowerOfTwo - numParticipants

	// Process participants who get byes first (no first round match)
	byeParticipants := make([]*domain.Participant, 0, byeCount)
	for i := 0; i < byeCount*2; i += 2 {
		if i < len(seededParticipants) && seededParticipants[i] != nil {
			byeParticipants = append(byeParticipants, seededParticipants[i])
		}
	}

	// Create first round matches for remaining participants
	participantsWithMatches := make([]*domain.Participant, 0, numParticipants-byeCount)
	for i := 0; i < len(seededParticipants); i++ {
		if !isInByes(seededParticipants[i], byeParticipants) && seededParticipants[i] != nil {
			participantsWithMatches = append(participantsWithMatches, seededParticipants[i])
		}
	}

	// Create matches for those who don't have byes
	for i := 0; i < len(participantsWithMatches); i += 2 {
		match := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        1,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
		}

		if i < len(participantsWithMatches) {
			participant1 := participantsWithMatches[i]
			match.Participant1ID = &participant1.ID
		}

		if i+1 < len(participantsWithMatches) {
			participant2 := participantsWithMatches[i+1]
			match.Participant2ID = &participant2.ID
		}

		roundMatches[1] = append(roundMatches[1], match)
		matches = append(matches, match)
		matchCounter++
	}

	// Round 2
	// Add byes participant already in round 2 and the winners of round 1
	var round2Participants []interface{}

	// Add the byes participants to the interface
	for _, p := range byeParticipants {
		round2Participants = append(round2Participants, p)
	}

	// Now we add round 1 winners
	for i := range roundMatches[1] {
		round2Participants = append(round2Participants, roundMatches[1][i])
	}

	// Generate matches for round 2
	for i := 0; i < len(round2Participants); i += 2 {
		m := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        2,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
		}

		// Get player 1
		switch v := round2Participants[i].(type) {
		case *domain.Participant:
			m.Participant1ID = &v.ID
		case *domain.Match:
			v.NextMatchID = &m.ID
		}

		// Getting player 2 now
		if i+1 < len(round2Participants) {
			switch v := round2Participants[i+1].(type) {
			case *domain.Participant:
				m.Participant2ID = &v.ID
			case *domain.Match:
				v.NextMatchID = &m.ID
			}
		}
		roundMatches[2] = append(roundMatches[2], m)
		matches = append(matches, m)
		matchCounter++
	}

	// Subsequent matches after round 2
	for round := 3; round <= numRounds; round++ {
		prevRoundMatches := roundMatches[round-1]
		currentRound := make([]*domain.Match, 0)

		for i := 0; i < len(prevRoundMatches); i += 2 {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchCounter,
				Status:       domain.MatchPending,
			}

			// Set forward links in previous matches
			if i < len(prevRoundMatches) {
				prevRoundMatches[i].NextMatchID = &match.ID
			}

			if i+1 < len(prevRoundMatches) {
				prevRoundMatches[i+1].NextMatchID = &match.ID
			}

			currentRound = append(currentRound, match)
			matches = append(matches, match)
			matchCounter++
		}
		roundMatches[round] = currentRound
	}

	return matches, roundMatches, nil
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
