package service

import (
	"context"
	"fmt"
	"math"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/google/uuid"
)

// BracketGenerator defines methods for generating tournament brackets
type BracketGenerator interface {
	GenerateSingleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error)
	GenerateDoubleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error)
	GenerateRoundRobin(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error)
	GenerateSwiss(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant, rounds int) ([]*domain.Match, error)
}

// bracketGenerator implements BracketGenerator interface
type bracketGenerator struct{}

// NewBracketGenerator creates a new bracket generator
func NewBracketGenerator() BracketGenerator {
	return &bracketGenerator{}
}

// GenerateSingleElimination creates a single elimination bracket
func (g *bracketGenerator) GenerateSingleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	participantCount := len(participants)
	if participantCount < 2 {
		return nil, fmt.Errorf("need at least 2 participants to generate bracket")
	}

	// Calculate bracket size (next power of 2)
	bracketSize := int(math.Pow(2, math.Ceil(math.Log2(float64(participantCount)))))

	// Calculate number of rounds
	roundCount := int(math.Log2(float64(bracketSize)))

	// Calculate number of matches in first round
	firstRoundMatches := bracketSize / 2

	// Create all matches
	matches := []*domain.Match{}
	matchIndex := 1

	// Create matches round by round
	for round := 1; round <= roundCount; round++ {
		matchesInRound := int(math.Pow(2, float64(roundCount-round)))

		for i := 0; i < matchesInRound; i++ {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  i + 1,
				Status:       domain.MatchPending,
			}

			// Link to next round match if not final
			if round < roundCount {
				nextMatchIndex := matchIndex + matchesInRound/2 + i/2

				if nextMatchIndex < len(matches) {
					match.NextMatchID = &matches[nextMatchIndex].ID
				}
			}

			matches = append(matches, match)
			matchIndex++
		}
	}

	// Seed participants into first round matches
	for i := 0; i < participantCount; i++ {
		// Get appropriate first round match based on seed
		matchIdx := getSeedIndex(i+1, firstRoundMatches) - 1
		if matchIdx < 0 || matchIdx >= len(matches) {
			continue
		}

		// Assign participant to correct position
		if matches[matchIdx].Participant1ID == nil {
			matches[matchIdx].Participant1ID = &participants[i].ID
		} else {
			matches[matchIdx].Participant2ID = &participants[i].ID
		}
	}

	return matches, nil
}

// GenerateDoubleElimination creates a double elimination bracket
func (g *bracketGenerator) GenerateDoubleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	// Generate the winners bracket
	winnersBracket, err := g.GenerateSingleElimination(ctx, tournamentID, participants)
	if err != nil {
		return nil, err
	}

	participantCount := len(participants)
	if participantCount < 2 {
		return nil, fmt.Errorf("need at least 2 participants to generate bracket")
	}

	// Calculate bracket sizes
	bracketSize := int(math.Pow(2, math.Ceil(math.Log2(float64(participantCount)))))
	roundCount := int(math.Log2(float64(bracketSize)))

	// Create losers bracket matches
	losersBracket := []*domain.Match{}
	loserRounds := roundCount*2 - 1 // Double the rounds minus 1 for losers bracket

	matchNumberCounter := 1
	for round := roundCount + 1; round <= roundCount+loserRounds; round++ {
		// Determine matches in this losers round
		var matchesInRound int
		if (round-roundCount)%2 == 1 {
			// Drop-down round
			matchesInRound = bracketSize / int(math.Pow(2, float64((round-roundCount+1)/2)))
		} else {
			// Consolidation round
			matchesInRound = bracketSize / int(math.Pow(2, float64((round-roundCount)/2)))
		}

		for i := 0; i < matchesInRound; i++ {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchNumberCounter,
				Status:       domain.MatchPending,
			}

			losersBracket = append(losersBracket, match)
			matchNumberCounter++
		}
	}

	// Add grand finals match
	grandFinals := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        roundCount + loserRounds + 1,
		MatchNumber:  matchNumberCounter,
		Status:       domain.MatchPending,
	}

	// Add potential bracket reset match
	bracketReset := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        roundCount + loserRounds + 2,
		MatchNumber:  matchNumberCounter + 1,
		Status:       domain.MatchPending,
	}

	// Combine all brackets
	allMatches := append(winnersBracket, losersBracket...)
	allMatches = append(allMatches, grandFinals, bracketReset)

	return allMatches, nil
}

// GenerateRoundRobin creates a round robin bracket
func (g *bracketGenerator) GenerateRoundRobin(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	participantCount := len(participants)
	if participantCount < 2 {
		return nil, fmt.Errorf("need at least 2 participants to generate round robin")
	}

	// If odd number of participants, add a "bye" participant
	hasBye := participantCount%2 != 0
	if hasBye {
		participantCount++
	}

	// Number of rounds needed
	rounds := participantCount - 1
	matchesPerRound := participantCount / 2

	matches := []*domain.Match{}
	matchCounter := 1

	// Create all matches using "circle method" for round robin
	for round := 1; round <= rounds; round++ {
		for match := 1; match <= matchesPerRound; match++ {
			// Calculate indices based on circle method
			homeIdx := match - 1
			awayIdx := participantCount - match

			// Fixed position for first participant
			if match == 1 {
				homeIdx = 0
			}

			// Skip matches with "bye" participant
			if hasBye && (homeIdx == participantCount-1 || awayIdx == participantCount-1) {
				continue
			}

			// Ensure indices are within bounds of actual participants
			if homeIdx < len(participants) && awayIdx < len(participants) {
				match := &domain.Match{
					ID:             uuid.New(),
					TournamentID:   tournamentID,
					Round:          round,
					MatchNumber:    matchCounter,
					Participant1ID: &participants[homeIdx].ID,
					Participant2ID: &participants[awayIdx].ID,
					Status:         domain.MatchPending,
				}

				matches = append(matches, match)
				matchCounter++
			}
		}

		// Rotate participants for next round (circle method)
		// Keeping first participant fixed and rotating the rest
	}

	return matches, nil
}

// GenerateSwiss creates a Swiss-system bracket
func (g *bracketGenerator) GenerateSwiss(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant, rounds int) ([]*domain.Match, error) {
	participantCount := len(participants)
	if participantCount < 2 {
		return nil, fmt.Errorf("need at least 2 participants to generate Swiss bracket")
	}

	// If not specified, determine optimal number of rounds
	// Swiss typically uses log2(n) rounds where n is number of participants
	if rounds <= 0 {
		rounds = int(math.Ceil(math.Log2(float64(participantCount))))
	}

	// For initial round, participants are matched based on seed
	// We can only generate the first round now, subsequent rounds depend on results
	matches := []*domain.Match{}
	matchCounter := 1

	// Create first round matches
	for i := 0; i < participantCount/2; i++ {
		p1Idx := i
		p2Idx := participantCount - i - 1

		if p1Idx < participantCount && p2Idx < participantCount {
			match := &domain.Match{
				ID:             uuid.New(),
				TournamentID:   tournamentID,
				Round:          1,
				MatchNumber:    matchCounter,
				Participant1ID: &participants[p1Idx].ID,
				Participant2ID: &participants[p2Idx].ID,
				Status:         domain.MatchPending,
			}

			matches = append(matches, match)
			matchCounter++
		}
	}

	// Handle odd number of participants (one gets a bye)
	if participantCount%2 != 0 {
		// The middle seeded participant gets a bye in the first round
		middleIdx := participantCount / 2

		if middleIdx < participantCount {
			// Create a bye match (only one participant)
			match := &domain.Match{
				ID:             uuid.New(),
				TournamentID:   tournamentID,
				Round:          1,
				MatchNumber:    matchCounter,
				Participant1ID: &participants[middleIdx].ID,
				Status:         domain.MatchPending,
			}

			matches = append(matches, match)
		}
	}

	return matches, nil
}

// getSeedIndex returns the match index for a given seed in standard seeding
func getSeedIndex(seed, matches int) int {
	if seed <= 0 || matches <= 0 {
		return 0
	}

	// For power of 2 brackets, this gives standard tournament seeding
	// where 1 plays against lowest seed, 2 plays against second lowest, etc.
	bracketSize := matches * 2
	position := 1

	// Find position using bit manipulation
	for i := 1; i < bracketSize; i *= 2 {
		position = position*2 - (seed/i)%2
	}

	return (position + 1) / 2
}
