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
		matches, _, err := g.generateSingleElimination(ctx, tournamentID, participants)
		return matches, err
	case DoubleElimination:
		doubleGenerator := NewDoubleEliminationGenerator()
		return doubleGenerator.Generate(ctx, tournamentID, format, participants, options)
	case RoundRobin:
		roundRobinGenerator := NewRoundRobinGenerator()
		return roundRobinGenerator.Generate(ctx, tournamentID, format, participants, options)
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

// generateSingleElimination creates a single elimination bracket
func (g *SingleEliminationGenerator) generateSingleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match,[][]*domain.Match, error) {
	if len(participants) < 2 {
		return nil,nil, errors.New("at least 2 participants are required for a tournament")
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

	// Generate first round matches
	// The key difference: we only create matches for actual participants with no "TBD" placeholders
	// firstRoundMatchCount := numParticipants / 2
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
	// match1Participants := make([]*domain.Participant, 0, len(participantsWithMatches))
	// Create matches for those who don't have byes
	for i := 0; i < len(participantsWithMatches); i += 2 {
		match := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        1,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
			// Participants: match1Participants,
		}

		if i < len(participantsWithMatches) {
			participant1 := participantsWithMatches[i]
			match.Participant1ID = &participant1.ID
			// match1Participants = append(match1Participants, participant1)
		}

		if i+1 < len(participantsWithMatches) {
			participant2 := participantsWithMatches[i+1]
			match.Participant2ID = &participant2.ID
			// match1Participants = append(match1Participants, participant2)
		}

		roundMatches[1] = append(roundMatches[1], match)
		matches = append(matches, match)
		// match.Participants = match1Participants
		matchCounter++
	}

	// Round 2
	//Add byes participant already in round 2 and the winners of round 1
	//we put the two different categories in an interface slice
	var round2Participants []interface{}

	//Add the byes participants to the interface
	for _, p := range byeParticipants {
		round2Participants = append(round2Participants, p)
	}

	//now we add round 1 winners
	for i := range roundMatches[1] {
		round2Participants = append(round2Participants, roundMatches[1][i])
	}

	//Resolve actual participants
	// realparticipants := getParticipantsFromMixedSlice(round2Participants, participantsCopy)
	//generate matches for round 2
	for i := 0; i < len(round2Participants); i += 2 {
		m := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        2,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
			// Participants: realparticipants,
		}

		//get player 1
		switch v := round2Participants[i].(type) {
		case *domain.Participant:
			m.Participant1ID = &v.ID
		case *domain.Match:
			v.NextMatchID = &m.ID
		}

		//getting player 2 now
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

	//subsequent matches after one, loop numround times from 2
	for round := 3; round <= numRounds; round++ {
		prevRoundMatches := roundMatches[round-1]
		var mixedInput []interface{}
		for _, match := range prevRoundMatches {
			mixedInput = append(mixedInput, match)
		}
		// newParticipants := getParticipantsFromMixedSlice(mixedInput, participantsCopy)
		currentRound := make([]*domain.Match, 0)

		for i := 0; i < len(prevRoundMatches); i += 2 {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchCounter,
				Status:       domain.MatchPending,
				// Participants: newParticipants,
			}

			//set forward links in previous matches
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

	return matches,roundMatches, nil
}

// applyChallongeSeeding arranges participants using Challonge's seeding algorithm
// This is crucial for giving byes to the right participants
func applyChallongeSeeding(participants []*domain.Participant, bracketSize int) []*domain.Participant {
	result := make([]*domain.Participant, bracketSize)

	// Special handling for very small brackets
	if len(participants) <= 2 {
		for i := 0; i < len(participants); i++ {
			result[i] = participants[i]
		}
		return result
	}

	// Challonge's algorithm prioritizes giving byes to top seeds
	// First, determine which positions will get byes
	byePositions := generateByePositions(bracketSize, len(participants))

	// Place top seeds in bye positions first
	seedIndex := 0
	for _, pos := range byePositions {
		if seedIndex < len(participants) {
			result[pos] = participants[seedIndex]
			seedIndex++
		}
	}

	// Now fill remaining positions
	positions := generateMatchPositions(bracketSize, byePositions)
	for _, pos := range positions {
		if seedIndex < len(participants) {
			result[pos] = participants[seedIndex]
			seedIndex++
		}
	}

	return result
}

// generateByePositions returns the positions that should get byes
// This prioritizes giving byes to higher seeds
func generateByePositions(bracketSize, numParticipants int) []int {
	byeCount := bracketSize - numParticipants
	if byeCount <= 0 {
		return []int{}
	}

	// Challonge's bye distribution pattern
	byePositions := make([]int, 0, byeCount)

	// For a standard bracket, byes are given to positions 0, 2, 4, etc. (top seeds)
	for i := 0; i < byeCount; i++ {
		byePositions = append(byePositions, i*2)
	}

	return byePositions
}

// generateMatchPositions returns positions that should have first round matches
func generateMatchPositions(bracketSize int, byePositions []int) []int {
	positions := make([]int, 0, bracketSize-len(byePositions))

	// Add all positions that aren't bye positions
	byeMap := make(map[int]bool)
	for _, pos := range byePositions {
		byeMap[pos] = true
	}

	for i := 0; i < bracketSize; i++ {
		if !byeMap[i] {
			positions = append(positions, i)
		}
	}

	return positions
}

func isInByes(p *domain.Participant, byes []*domain.Participant) bool {
	for _, b := range byes {
		if b == p {
			return true
		}
	}
	return false
}

// RoundRobinGenerator implements the Generator interface for round robin tournaments
type RoundRobinGenerator struct{}

// NewRoundRobinGenerator creates a new round robin tournament generator
func NewRoundRobinGenerator() *RoundRobinGenerator {
	return &RoundRobinGenerator{}
}

// Generate implements the Generator interface for round robin format
func (g *RoundRobinGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, format Format, participants []*domain.Participant, options map[string]interface{}) ([]*domain.Match, error) {
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
func (g *DoubleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, format Format, participants []*domain.Participant, options map[string]interface{}) ([]*domain.Match, error) {
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

	// Initialize match counter
	matchCounter := 1

	// Generate winners bracket using SingleEliminationGenerator
	singleElimGen := &SingleEliminationGenerator{}
	winnersBracket, winnersBracketRounds, err := singleElimGen.generateSingleElimination(ctx, tournamentID, participantsCopy)
	if err != nil {
		return nil, fmt.Errorf("failed to generate winners bracket: %w", err)
	}

	// Mark all matches as winners bracket
	for _, match := range winnersBracket {
		match.MatchNotes = string(WinnersBracket)
	}

	// Update match counter for losers bracket
	matchCounter = len(winnersBracket) + 1

	// Generate losers bracket using the winners bracket rounds
	losersBracket := g.generateLosersBracket(tournamentID, winnersBracketRounds, &matchCounter)

	// Generate grand finals matches
	grandFinals := g.generateGrandFinals(tournamentID, &matchCounter)

	// Connect winners and losers brackets to grand finals
	err = g.connectGrandFinals(winnersBracket, losersBracket, grandFinals)
	if err != nil {
		return nil, fmt.Errorf("failed to connect grand finals: %w", err)
	}

	// Combine all matches
	allMatches := make([]*domain.Match, 0)
	allMatches = append(allMatches, winnersBracket...)
	allMatches = append(allMatches, losersBracket...)
	allMatches = append(allMatches, grandFinals...)

	return allMatches, nil
}

// generateLosersBracket creates the losers bracket matches
func (g *DoubleEliminationGenerator) generateLosersBracket(
	tournamentID uuid.UUID,
	winnersBracketRounds [][]*domain.Match,
	matchCounter *int,
) []*domain.Match {
	matches := make([]*domain.Match, 0)
	losersBracketRounds := make([][]*domain.Match, 0)

	// Process each winners round (except finals)
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
					MatchNumber:  *matchCounter,
					Status:       domain.MatchPending,
					MatchNotes:   string(LosersBracket),
				}

				// Connect losers from winners bracket to this match
				winnersBracketRounds[winnersRound][i].LoserNextMatchID = &match.ID
				if i+1 < losersFromThisRound {
					winnersBracketRounds[winnersRound][i+1].LoserNextMatchID = &match.ID
				}

				currentRoundMatches = append(currentRoundMatches, match)
				matches = append(matches, match)
				(*matchCounter)++
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
					MatchNumber:  *matchCounter,
					Status:       domain.MatchPending,
					MatchNotes:   string(LosersBracket),
				}

				// Connect loser from winners bracket to this match
				winnersBracketRounds[winnersRound][i].LoserNextMatchID = &match.ID

				// Connect winner from previous losers round if available
				if i < len(prevLosersRound) {
					prevLosersRound[i].NextMatchID = &match.ID
				}

				currentRoundMatches = append(currentRoundMatches, match)
				matches = append(matches, match)
				(*matchCounter)++
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
					MatchNumber:  *matchCounter,
					Status:       domain.MatchPending,
					MatchNotes:   string(LosersBracket),
				}

				// Connect winners from current round
				currentRoundMatches[i].NextMatchID = &match.ID
				if i+1 < len(currentRoundMatches) {
					currentRoundMatches[i+1].NextMatchID = &match.ID
				}

				consolidationMatches = append(consolidationMatches, match)
				matches = append(matches, match)
				(*matchCounter)++
			}

			losersBracketRounds = append(losersBracketRounds, consolidationMatches)
		}
	}

	return matches
}

// generateGrandFinals creates the grand finals matches and connects them properly
func (g *DoubleEliminationGenerator) generateGrandFinals(
	tournamentID uuid.UUID,
	matchCounter *int,
) []*domain.Match {
	// First grand finals match (Winners bracket winner vs Losers bracket winner)
	firstFinals := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        1,
		MatchNumber:  *matchCounter,
		Status:       domain.MatchPending,
		MatchNotes:   string(GrandFinals),
	}
	(*matchCounter)++

	// Reset match (only played if losers bracket winner wins first finals)
	resetMatch := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        2,
		MatchNumber:  *matchCounter,
		Status:       domain.MatchPending,
		MatchNotes:   string(GrandFinals) + "_RESET_IF_LOSER_WINS", // Store condition in MatchNotes
	}
	(*matchCounter)++

	// Connect first finals to reset match
	firstFinals.NextMatchID = &resetMatch.ID

	return []*domain.Match{firstFinals, resetMatch}
}

// connectGrandFinals connects winners and losers brackets to grand finals
func (g *DoubleEliminationGenerator) connectGrandFinals(
	winnersBracket []*domain.Match,
	losersBracket []*domain.Match,
	grandFinals []*domain.Match,
) error {
	if len(grandFinals) < 2 {
		return errors.New("grand finals must have two potential matches")
	}

	if len(winnersBracket) == 0 || len(losersBracket) == 0 {
		return errors.New("both winners and losers brackets must have matches")
	}

	// Get the finals matches from each bracket
	winnersFinal := winnersBracket[len(winnersBracket)-1]
	losersFinal := losersBracket[len(losersBracket)-1]
	firstGrandFinals := grandFinals[0]

	// Connect winners bracket final to grand finals
	winnersFinal.NextMatchID = &firstGrandFinals.ID
	winnersFinal.MatchNotes = string(WinnersBracket) + "_FINALS"

	// Connect losers bracket final to grand finals
	losersFinal.NextMatchID = &firstGrandFinals.ID
	losersFinal.MatchNotes = string(LosersBracket) + "_FINALS"

	return nil
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
