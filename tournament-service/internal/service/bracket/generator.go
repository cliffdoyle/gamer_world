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

// Format represents the tournament bracket format
type Format string

const (
	SingleElimination Format = "SINGLE_ELIMINATION"
	DoubleElimination Format = "DOUBLE_ELIMINATION"
	RoundRobin        Format = "ROUND_ROBIN"
	Swiss             Format = "SWISS"
)

// Generator defines the interface for generating tournament brackets
type Generator interface {
	// Generate creates a bracket for the given tournament and participants
	Generate(ctx context.Context, tournamentID uuid.UUID, format Format, participants []*domain.Participant, options map[string]interface{}) ([]*domain.Match, error)
}

// SingleEliminationGenerator implements the Generator interface for single elimination tournaments
type SingleEliminationGenerator struct{}

// NewSingleEliminationGenerator creates a new single elimination bracket generator
func NewSingleEliminationGenerator() *SingleEliminationGenerator {
	return &SingleEliminationGenerator{}
}

// Generate implements the Generator interface
func (g *SingleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, format Format, participants []*domain.Participant, options map[string]interface{}) ([]*domain.Match, error) {
	if len(participants) < 2 {
		return nil, errors.New("at least 2 participants are required for a tournament")
	}

	switch format {
	case SingleElimination:
		return g.generateSingleElimination(ctx, tournamentID, participants)
	case DoubleElimination:
		return g.generateDoubleElimination(ctx, tournamentID, participants)
	case RoundRobin:
		return g.generateRoundRobin(ctx, tournamentID, participants)
	case Swiss:
		rounds := 0
		if r, ok := options["rounds"].(int); ok {
			rounds = r
		}
		if rounds <= 0 {
			rounds = int(math.Ceil(math.Log2(float64(len(participants)))))
		}
		return g.generateSwiss(ctx, tournamentID, participants, rounds)
	default:
		return nil, fmt.Errorf("unsupported tournament format: %s", format)
	}
}

// generateSingleElimination creates a single elimination bracket
func (g *SingleEliminationGenerator) generateSingleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	// Calculate the number of rounds needed
	numParticipants := len(participants)
	numRounds := int(math.Ceil(math.Log2(float64(numParticipants))))
	totalMatches := (1 << numRounds) - 1 // 2^numRounds - 1

	// Sort participants by seed
	sort.Slice(participants, func(i, j int) bool {
		return participants[i].Seed < participants[j].Seed
	})

	matches := make([]*domain.Match, 0, totalMatches)
	matchIDs := make([]uuid.UUID, totalMatches)
	for i := range matchIDs {
		matchIDs[i] = uuid.New()
	}

	// Create first round matches
	firstRoundMatches := 1 << (numRounds - 1)
	matchNumber := 1
	for i := 0; i < firstRoundMatches; i++ {
		participant1Idx := i * 2
		participant2Idx := i*2 + 1

		match := &domain.Match{
			ID:           matchIDs[i],
			TournamentID: tournamentID,
			Round:        1,
			MatchNumber:  matchNumber,
			Status:       domain.MatchPending,
		}

		// Assign participants if available
		if participant1Idx < len(participants) {
			match.Participant1ID = &participants[participant1Idx].ID
		}
		if participant2Idx < len(participants) {
			match.Participant2ID = &participants[participant2Idx].ID
		}

		// If only one participant is assigned, they automatically advance
		if match.Participant1ID != nil && match.Participant2ID == nil {
			match.Status = domain.MatchCompleted
			match.WinnerID = match.Participant1ID
		}

		matches = append(matches, match)
		matchNumber++
	}

	// Create subsequent round matches
	currentRoundFirstMatch := firstRoundMatches
	for round := 2; round <= numRounds; round++ {
		matchesInRound := 1 << (numRounds - round)
		for i := 0; i < matchesInRound; i++ {
			match := &domain.Match{
				ID:           matchIDs[currentRoundFirstMatch+i],
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchNumber,
				Status:       domain.MatchPending,
			}
			matches = append(matches, match)
			matchNumber++
		}
		currentRoundFirstMatch += matchesInRound
	}

	// Link matches to their next matches
	for i, match := range matches {
		if match.Round < numRounds {
			nextMatchIdx := firstRoundMatches + (i / 2)
			match.NextMatchID = &matches[nextMatchIdx].ID
		}
	}

	return matches, nil
}

// generateDoubleElimination creates a double elimination bracket
func (g *SingleEliminationGenerator) generateDoubleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	// First generate the winners bracket
	winnersBracket, err := g.generateSingleElimination(ctx, tournamentID, participants)
	if err != nil {
		return nil, fmt.Errorf("failed to generate winners bracket: %w", err)
	}

	// Create losers bracket matches (will be half the size of winners bracket)
	numLoserMatches := len(winnersBracket) / 2
	losersBracket := make([]*domain.Match, numLoserMatches)

	// Create losers bracket matches
	matchNumber := len(winnersBracket) + 1
	currentRound := 1

	for i := 0; i < numLoserMatches; i++ {
		losersBracket[i] = &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        currentRound,
			MatchNumber:  matchNumber,
			Status:       domain.MatchPending,
		}
		matchNumber++

		if i > 0 && i%2 == 0 {
			currentRound++
		}
	}

	// Create final championship matches
	finalMatches := []*domain.Match{
		{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        currentRound + 1,
			MatchNumber:  matchNumber,
			Status:       domain.MatchPending,
		},
		{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        currentRound + 2,
			MatchNumber:  matchNumber + 1,
			Status:       domain.MatchPending,
		},
	}

	// Combine all matches
	allMatches := append(winnersBracket, losersBracket...)
	allMatches = append(allMatches, finalMatches...)

	return allMatches, nil
}

// generateRoundRobin creates a round robin tournament schedule
func (g *SingleEliminationGenerator) generateRoundRobin(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	numParticipants := len(participants)
	if numParticipants%2 != 0 {
		// Add a "bye" participant for odd numbers
		participants = append(participants, &domain.Participant{
			ID: uuid.Nil, // Use nil UUID for bye
		})
		numParticipants++
	}

	numRounds := numParticipants - 1
	matchesPerRound := numParticipants / 2
	totalMatches := numRounds * matchesPerRound

	matches := make([]*domain.Match, 0, totalMatches)
	matchNumber := 1

	// Create array of participant indices
	indices := make([]int, numParticipants)
	for i := range indices {
		indices[i] = i
	}

	// Generate matches for each round
	for round := 1; round <= numRounds; round++ {
		for i := 0; i < matchesPerRound; i++ {
			participant1 := participants[indices[i]]
			participant2 := participants[indices[numParticipants-1-i]]

			// Skip matches involving the bye participant
			if participant1.ID != uuid.Nil && participant2.ID != uuid.Nil {
				match := &domain.Match{
					ID:             uuid.New(),
					TournamentID:   tournamentID,
					Round:          round,
					MatchNumber:    matchNumber,
					Participant1ID: &participant1.ID,
					Participant2ID: &participant2.ID,
					Status:         domain.MatchPending,
				}
				matches = append(matches, match)
				matchNumber++
			}
		}

		// Rotate participants (keeping first participant fixed)
		lastIndex := indices[numParticipants-1]
		for i := numParticipants - 1; i > 1; i-- {
			indices[i] = indices[i-1]
		}
		indices[1] = lastIndex
	}

	return matches, nil
}

// generateSwiss creates a Swiss-system tournament schedule
func (g *SingleEliminationGenerator) generateSwiss(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant, rounds int) ([]*domain.Match, error) {
	if rounds <= 0 {
		// Default to log2(n) rounds
		rounds = int(math.Ceil(math.Log2(float64(len(participants)))))
	}

	// Sort participants by seed initially
	sort.Slice(participants, func(i, j int) bool {
		return participants[i].Seed < participants[j].Seed
	})

	matches := make([]*domain.Match, 0)
	matchNumber := 1

	// Generate first round matches
	for i := 0; i < len(participants)/2; i++ {
		participant1 := participants[i]
		participant2 := participants[len(participants)-1-i]

		match := &domain.Match{
			ID:             uuid.New(),
			TournamentID:   tournamentID,
			Round:          1,
			MatchNumber:    matchNumber,
			Participant1ID: &participant1.ID,
			Participant2ID: &participant2.ID,
			Status:         domain.MatchPending,
		}
		matches = append(matches, match)
		matchNumber++
	}

	// Handle bye if odd number of participants
	if len(participants)%2 != 0 {
		lastParticipant := participants[len(participants)/2]
		match := &domain.Match{
			ID:             uuid.New(),
			TournamentID:   tournamentID,
			Round:          1,
			MatchNumber:    matchNumber,
			Participant1ID: &lastParticipant.ID,
			Status:         domain.MatchPending,
		}
		matches = append(matches, match)
		matchNumber++
	}

	// Create placeholder matches for subsequent rounds
	matchesPerRound := len(participants) / 2
	if len(participants)%2 != 0 {
		matchesPerRound++
	}

	for round := 2; round <= rounds; round++ {
		for i := 0; i < matchesPerRound; i++ {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchNumber,
				Status:       domain.MatchPending,
			}
			matches = append(matches, match)
			matchNumber++
		}
	}

	return matches, nil
}
