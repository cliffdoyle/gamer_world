package bracket

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/bits"
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

// BracketType represents the section of a tournament bracket
type BracketType string

const (
	WinnersBracket BracketType = "WINNERS"
	LosersBracket  BracketType = "LOSERS"
	GrandFinals    BracketType = "GRAND_FINALS"
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
		doubleGenerator := NewDoubleEliminationGenerator()
		return doubleGenerator.Generate(ctx, tournamentID, participants)
	case RoundRobin:
		roundRobinGenerator := NewRoundRobinGenerator()
		return roundRobinGenerator.Generate(ctx, tournamentID, participants)
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
	if len(participants) < 2 {
		return nil, errors.New("at least 2 participants are required for a tournament")
	}

	// Make a copy of participants to avoid modifying the original slice
	participantsCopy := make([]*domain.Participant, len(participants))
	copy(participantsCopy, participants)

	// Sort participants by seed
	sort.Slice(participantsCopy, func(i, j int) bool {
		return participantsCopy[i].Seed < participantsCopy[j].Seed
	})

	// Calculate the number of rounds needed and total matches
	numParticipants := len(participantsCopy)
	participantsPowerOfTwo := nextPowerOfTwo(numParticipants)
	numRounds := int(math.Log2(float64(participantsPowerOfTwo)))
	totalMatches := participantsPowerOfTwo - 1 // In single elim, total matches is always one less than participants in a full bracket

	// Apply tournament seeding algorithm (similar to Challonge's approach)
	seededParticipants := applySeeding(participantsCopy, participantsPowerOfTwo)

	// Create all matches
	matches := make([]*domain.Match, 0, totalMatches)
	matchCounter := 1

	// First round matches
	firstRoundMatchCount := participantsPowerOfTwo / 2
	firstRoundMatches := make([]*domain.Match, firstRoundMatchCount)

	for i := 0; i < firstRoundMatchCount; i++ {
		match := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        1,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
		}

		// Assign participants if available
		topSeedIdx := i * 2
		bottomSeedIdx := i*2 + 1

		if topSeedIdx < len(seededParticipants) && seededParticipants[topSeedIdx] != nil {
			match.Participant1ID = &seededParticipants[topSeedIdx].ID
		}

		if bottomSeedIdx < len(seededParticipants) && seededParticipants[bottomSeedIdx] != nil {
			match.Participant2ID = &seededParticipants[bottomSeedIdx].ID
		}

		// If only one participant is assigned, they automatically advance
		if match.Participant1ID != nil && match.Participant2ID == nil {
			match.Status = domain.MatchCompleted
			match.WinnerID = match.Participant1ID
		}

		firstRoundMatches[i] = match
		matches = append(matches, match)
		matchCounter++
	}

	// Create subsequent round matches
	for round := 2; round <= numRounds; round++ {
		matchesInRound := participantsPowerOfTwo / int(math.Pow(2, float64(round)))
		roundMatches := make([]*domain.Match, matchesInRound)

		for i := 0; i < matchesInRound; i++ {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchCounter,
				Status:       domain.MatchPending,
			}

			roundMatches[i] = match
			matches = append(matches, match)
			matchCounter++
		}

		// Link previous round matches to their next match
		prevRoundMatches := matches[len(matches)-matchesInRound-matchesInRound*2 : len(matches)-matchesInRound]
		for i, prevMatch := range prevRoundMatches {
			nextMatchIdx := i / 2
			if nextMatchIdx < len(roundMatches) {
				prevMatch.NextMatchID = &roundMatches[nextMatchIdx].ID
			}
		}
	}

	return matches, nil
}

// RoundRobinGenerator implements the Generator interface for round robin tournaments
type RoundRobinGenerator struct{}

// NewRoundRobinGenerator creates a new round robin tournament generator
func NewRoundRobinGenerator() *RoundRobinGenerator {
	return &RoundRobinGenerator{}
}

// Generate implements the Generator interface for round robin format
func (g *RoundRobinGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	numParticipants := len(participants)
	if numParticipants < 2 {
		return nil, errors.New("at least 2 participants are required for a tournament")
	}

	// Make a copy of participants to avoid modifying the original slice
	participantsCopy := make([]*domain.Participant, len(participants))
	copy(participantsCopy, participants)

	// Sort participants by seed for consistent ordering
	sort.Slice(participantsCopy, func(i, j int) bool {
		return participantsCopy[i].Seed < participantsCopy[j].Seed
	})

	// Add a dummy participant if odd number of participants (for byes)
	hasDummy := false
	if numParticipants%2 != 0 {
		participantsCopy = append(participantsCopy, nil) // nil represents the dummy participant
		numParticipants++
		hasDummy = true
	}

	// Number of rounds and matches
	numRounds := numParticipants - 1
	matchesPerRound := numParticipants / 2
	totalMatches := numRounds * matchesPerRound

	// If we have a dummy participant, reduce the number of matches
	if hasDummy {
		totalMatches -= numRounds
	}

	matches := make([]*domain.Match, 0, totalMatches)
	matchCounter := 1

	// Create schedule using the "circle method" (similar to Challonge)
	// In this method, one participant stays fixed (idx 0), and the rest rotate around
	indices := make([]int, numParticipants)
	for i := range indices {
		indices[i] = i
	}

	for round := 1; round <= numRounds; round++ {
		for i := 0; i < matchesPerRound; i++ {
			// Get the pairing
			home := indices[i]
			away := indices[numParticipants-1-i]

			// Skip if one of the participants is the dummy (bye)
			if hasDummy && (home == numParticipants-1 || away == numParticipants-1) {
				continue
			}

			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchCounter,
				Status:       domain.MatchPending,
			}

			// Assign participants
			match.Participant1ID = &participantsCopy[home].ID
			match.Participant2ID = &participantsCopy[away].ID

			matches = append(matches, match)
			matchCounter++
		}

		// Rotate participants for next round (keeping first participant fixed)
		rotateParticipants(indices)
	}

	return matches, nil
}

// DoubleEliminationGenerator implements the Generator interface for double elimination tournaments
type DoubleEliminationGenerator struct{}

// NewDoubleEliminationGenerator creates a new double elimination bracket generator
func NewDoubleEliminationGenerator() *DoubleEliminationGenerator {
	return &DoubleEliminationGenerator{}
}

// Generate implements the Generator interface for double elimination format
func (g *DoubleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	if len(participants) < 2 {
		return nil, errors.New("at least 2 participants are required for a tournament")
	}

	// Make a copy of participants to avoid modifying the original slice
	participantsCopy := make([]*domain.Participant, len(participants))
	copy(participantsCopy, participants)

	// Sort participants by seed
	sort.Slice(participantsCopy, func(i, j int) bool {
		return participantsCopy[i].Seed < participantsCopy[j].Seed
	})

	// Calculate bracket sizes based on number of participants
	// Find the next power of 2 to determine bracket size
	normalizedSize := nextPowerOfTwo(len(participantsCopy))

	// Create matches for winners and losers brackets
	matches := []*domain.Match{}
	matchCounter := 1

	// Generate winners bracket
	winnersBracket := g.generateWinnersBracket(tournamentID, participantsCopy, normalizedSize, &matchCounter)
	matches = append(matches, winnersBracket...)

	// Generate losers bracket
	losersBracket := g.generateLosersBracket(tournamentID, normalizedSize, &matchCounter)
	matches = append(matches, losersBracket...)

	// Create grand finals matches
	grandFinals := g.generateGrandFinals(tournamentID, &matchCounter)
	matches = append(matches, grandFinals...)

	// Link winners bracket losers to losers bracket
	g.linkWinnersToLosers(winnersBracket, losersBracket, normalizedSize)

	// Link losers bracket to grand finals
	// The first grand finals match should be linked from both winners and losers finals
	if len(winnersBracket) > 0 && len(losersBracket) > 0 && len(grandFinals) > 0 {
		winnersFinalsIdx := len(winnersBracket) - 1
		losersFinalsIdx := len(losersBracket) - 1

		// Link winners and losers finals to grand finals
		winnersBracket[winnersFinalsIdx].NextMatchID = &grandFinals[0].ID
		losersBracket[losersFinalsIdx].NextMatchID = &grandFinals[0].ID

		// Link grand finals to potential reset match if winners bracket winner loses
		grandFinals[0].NextMatchID = &grandFinals[1].ID
	}

	return matches, nil
}

// generateWinnersBracket creates the winners bracket matches
func (g *DoubleEliminationGenerator) generateWinnersBracket(
	tournamentID uuid.UUID,
	participants []*domain.Participant,
	normalizedSize int,
	matchCounter *int,
) []*domain.Match {
	numRounds := int(math.Log2(float64(normalizedSize)))
	matches := make([]*domain.Match, 0)

	// Apply standard seeding pattern for participants
	seededParticipants := applySeeding(participants, normalizedSize)

	// First round setup with actual participants
	firstRoundMatches := normalizedSize / 2
	for i := 0; i < firstRoundMatches; i++ {
		match := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        1,
			MatchNumber:  *matchCounter,
			Status:       domain.MatchPending,
			MatchNotes:   string(WinnersBracket),
		}

		// Assign participants if available
		topSeedIdx := i * 2
		bottomSeedIdx := i*2 + 1

		if topSeedIdx < len(seededParticipants) && seededParticipants[topSeedIdx] != nil {
			match.Participant1ID = &seededParticipants[topSeedIdx].ID
		}

		if bottomSeedIdx < len(seededParticipants) && seededParticipants[bottomSeedIdx] != nil {
			match.Participant2ID = &seededParticipants[bottomSeedIdx].ID
		}

		// If only one participant is assigned, they automatically advance
		if match.Participant1ID != nil && match.Participant2ID == nil {
			match.Status = domain.MatchCompleted
			match.WinnerID = match.Participant1ID
			if match.Participant1ID != nil {
				match.LoserID = nil
			}
		}

		matches = append(matches, match)
		(*matchCounter)++
	}

	// Create remaining rounds of the winners bracket
	matchesInCurrentRound := firstRoundMatches
	startIdx := 0

	for round := 2; round <= numRounds; round++ {
		matchesInNextRound := matchesInCurrentRound / 2
		nextRoundStartIdx := startIdx + matchesInCurrentRound

		for i := 0; i < matchesInNextRound; i++ {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  *matchCounter,
				Status:       domain.MatchPending,
				MatchNotes:   string(WinnersBracket),
			}

			// Link previous round matches to this match
			if startIdx+i*2 < len(matches) {
				matches[startIdx+i*2].NextMatchID = &match.ID
			}
			if startIdx+i*2+1 < len(matches) {
				matches[startIdx+i*2+1].NextMatchID = &match.ID
			}

			matches = append(matches, match)
			(*matchCounter)++
		}

		startIdx = nextRoundStartIdx
		matchesInCurrentRound = matchesInNextRound
	}

	return matches
}

// generateLosersBracket creates the losers bracket matches
func (g *DoubleEliminationGenerator) generateLosersBracket(
	tournamentID uuid.UUID,
	normalizedSize int,
	matchCounter *int,
) []*domain.Match {
	if normalizedSize <= 2 {
		// For 2 participants, no losers bracket needed
		return []*domain.Match{}
	}

	numWinnerRounds := int(math.Log2(float64(normalizedSize)))
	// Losers bracket has 2*(numWinnerRounds-1) rounds
	numLoserRounds := 2 * (numWinnerRounds - 1)

	matches := make([]*domain.Match, 0)

	// Calculate the number of matches in each round of losers bracket
	// This uses the standard pattern for double elimination tournaments
	matchesInRound := make([]int, numLoserRounds+1) // +1 for 1-indexed rounds

	// First round of losers bracket has half the participants from winners round 1
	matchesInRound[1] = normalizedSize / 4

	// Calculate remaining rounds
	for round := 2; round <= numLoserRounds; round++ {
		if round%2 == 1 {
			// Drop-in rounds - participants coming from winners bracket
			matchesInRound[round] = normalizedSize / int(math.Pow(2, float64(round/2+1)))
		} else {
			// Consolidation rounds - matches between losers bracket participants
			matchesInRound[round] = matchesInRound[round-1]
		}
	}

	// Create matches for each round in losers bracket
	roundStartIndex := make([]int, numLoserRounds+1)
	currentIndex := 0

	for round := 1; round <= numLoserRounds; round++ {
		roundStartIndex[round] = currentIndex

		for i := 0; i < matchesInRound[round]; i++ {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  *matchCounter,
				Status:       domain.MatchPending,
				MatchNotes:   string(LosersBracket),
			}

			matches = append(matches, match)
			(*matchCounter)++
		}

		currentIndex += matchesInRound[round]
	}

	// Link consolidation matches (even rounds)
	for round := 1; round < numLoserRounds; round++ {
		if round%2 == 0 {
			// Even rounds (consolidation) - link to next round
			for i := 0; i < matchesInRound[round]; i++ {
				matchIdx := roundStartIndex[round] + i
				if round+1 <= numLoserRounds {
					nextRoundIdx := roundStartIndex[round+1] + i/2
					if nextRoundIdx < len(matches) {
						matches[matchIdx].NextMatchID = &matches[nextRoundIdx].ID
					}
				}
			}
		} else {
			// Odd rounds (drop-in) - link to next round
			for i := 0; i < matchesInRound[round]; i++ {
				matchIdx := roundStartIndex[round] + i
				if round+1 <= numLoserRounds {
					nextRoundIdx := roundStartIndex[round+1] + i
					if nextRoundIdx < len(matches) {
						matches[matchIdx].NextMatchID = &matches[nextRoundIdx].ID
					}
				}
			}
		}
	}

	return matches
}

// generateGrandFinals creates the grand finals matches
func (g *DoubleEliminationGenerator) generateGrandFinals(
	tournamentID uuid.UUID,
	matchCounter *int,
) []*domain.Match {
	grandFinals := []*domain.Match{
		{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        1,
			MatchNumber:  *matchCounter,
			Status:       domain.MatchPending,
			MatchNotes:   string(GrandFinals), // Store bracket type in notes
		},
	}
	(*matchCounter)++

	// Reset match (if winners bracket finalist loses)
	resetMatch := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        2,
		MatchNumber:  *matchCounter,
		Status:       domain.MatchPending,
		MatchNotes:   string(GrandFinals), // Store bracket type in notes
	}
	(*matchCounter)++

	grandFinals = append(grandFinals, resetMatch)
	return grandFinals
}

// linkWinnersToLosers connects winners bracket matches to losers bracket matches
func (g *DoubleEliminationGenerator) linkWinnersToLosers(
	winnersBracket []*domain.Match,
	losersBracket []*domain.Match,
	normalizedSize int,
) {
	if len(losersBracket) == 0 {
		return // No losers bracket to link to
	}

	// Group losers bracket matches by round
	loserRoundMatches := make(map[int][]*domain.Match)
	for _, match := range losersBracket {
		loserRoundMatches[match.Round] = append(loserRoundMatches[match.Round], match)
	}

	// Group winners bracket matches by round
	winnerRoundMatches := make(map[int][]*domain.Match)
	for _, match := range winnersBracket {
		winnerRoundMatches[match.Round] = append(winnerRoundMatches[match.Round], match)
	}

	// For each winners bracket round (except finals)
	numWinnerRounds := int(math.Log2(float64(normalizedSize)))
	for winnerRound := 1; winnerRound < numWinnerRounds; winnerRound++ {
		// Calculate which losers round receives these losers
		// Standard mapping: losers from winner's round N go to loser's round (2N-1)
		loserRound := 2*winnerRound - 1

		// Skip if no matches in this winner round or target loser round
		if len(winnerRoundMatches[winnerRound]) == 0 || len(loserRoundMatches[loserRound]) == 0 {
			continue
		}

		// Map losers based on their position
		loserMatchCount := len(loserRoundMatches[loserRound])

		// If the number of winner matches doesn't align with loser matches,
		// we need to distribute appropriately
		for i, winnerMatch := range winnerRoundMatches[winnerRound] {
			// Calculate destination in losers bracket
			loserMatchIdx := i % loserMatchCount

			// Link the loser to the appropriate losers bracket match
			winnerMatch.LoserNextMatchID = &loserRoundMatches[loserRound][loserMatchIdx].ID
		}
	}
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

// Helper functions

// nextPowerOfTwo returns the next power of 2 >= n
func nextPowerOfTwo(n int) int {
	if n <= 1 {
		return 1
	}
	return 1 << (bits.Len(uint(n - 1)))
}

// rotateParticipants rotates all elements except the first one
// This is used for round robin scheduling
func rotateParticipants(indices []int) {
	n := len(indices)
	if n <= 2 {
		return
	}

	last := indices[n-1]
	for i := n - 1; i > 1; i-- {
		indices[i] = indices[i-1]
	}
	indices[1] = last
}

// applySeeding arranges participants in a tournament bracket according to seed
// This is similar to how platforms like Challonge seed participants
func applySeeding(participants []*domain.Participant, bracketSize int) []*domain.Participant {
	result := make([]*domain.Participant, bracketSize)

	// Special cases for small brackets
	if bracketSize <= 2 {
		for i := 0; i < len(participants) && i < bracketSize; i++ {
			result[i] = participants[i]
		}
		return result
	}

	// Apply standard seeding pattern for power-of-2 brackets
	// This distributes participants to maximize the distance between top seeds
	positions := make([]int, bracketSize)

	// Initialize the positions array
	for i := 0; i < bracketSize; i++ {
		positions[i] = i
	}

	// Apply the seeding pattern recursively
	applySeedingPattern(positions, 0, bracketSize-1, 1)

	// Place participants according to the calculated positions
	for i := 0; i < len(participants) && i < bracketSize; i++ {
		result[positions[i]] = participants[i]
	}

	return result
}

// applySeedingPattern recursively determines bracket positions based on seeding
// This creates bracket placements like: 1 vs 16, 8 vs 9, 5 vs 12, 4 vs 13, etc.
func applySeedingPattern(positions []int, start, end, seed int) {
	if start > end {
		return
	}

	if start == end {
		positions[start] = seed - 1
		return
	}

	mid := (start + end) / 2
	positions[start] = seed - 1
	positions[end] = (len(positions) + 1 - seed) - 1

	applySeedingPattern(positions, start+1, mid, seed*2)
	applySeedingPattern(positions, mid+1, end-1, seed*2-1)
}

// seedParticipants orders participants according to standard seeding pattern
func seedParticipants(participants []*domain.Participant) {
	// Sort participants by their seed value first
	for i := 0; i < len(participants); i++ {
		for j := i + 1; j < len(participants); j++ {
			if participants[i].Seed > participants[j].Seed {
				participants[i], participants[j] = participants[j], participants[i]
			}
		}
	}

	// Challonge-style bracket seeding placement (1 vs 16, 8 vs 9, 5 vs 12, etc)
	size := nextPowerOfTwo(len(participants))
	if size <= 1 {
		return
	}

	reordered := make([]*domain.Participant, size)

	// Apply Challonge seeding algorithm
	placeSeed(participants, reordered, 0, 0, size)

	// Copy back participants that exist
	for i := 0; i < len(participants); i++ {
		participants[i] = reordered[i]
	}
}

// placeSeed recursively places seeds according to Challonge's algorithm
func placeSeed(src []*domain.Participant, dst []*domain.Participant, position int, seed int, size int) {
	if size == 1 {
		if seed < len(src) {
			dst[position] = src[seed]
		}
		return
	}

	halfSize := size / 2

	// Place the first seed at the top position
	placeSeed(src, dst, position, seed, halfSize)

	// Place the second seed at the bottom position
	placeSeed(src, dst, position+halfSize, seed+halfSize, halfSize)
}
