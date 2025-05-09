package bracket

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/bits"
	"sort"
	"time"

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
		return doubleGenerator.Generate(ctx, tournamentID, participants)
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
func (g *SingleEliminationGenerator) generateSingleElimination(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, [][]*domain.Match, error) {
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
	// Add byes participant already in round 2 and the winners of round 1
	// we put the two different categories in an interface slice
	var round2Participants []interface{}

	// Add the byes participants to the interface
	for _, p := range byeParticipants {
		round2Participants = append(round2Participants, p)
	}

	// now we add round 1 winners
	for i := range roundMatches[1] {
		round2Participants = append(round2Participants, roundMatches[1][i])
	}

	// Resolve actual participants
	// realparticipants := getParticipantsFromMixedSlice(round2Participants, participantsCopy)
	// generate matches for round 2
	for i := 0; i < len(round2Participants); i += 2 {
		m := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        2,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
			BracketType: domain.BracketType(domain.SingleElimination),
			// Participants: realparticipants,
		}

		// get player 1
		switch v := round2Participants[i].(type) {
		case *domain.Participant:
			m.Participant1ID = &v.ID
		case *domain.Match:
			v.NextMatchID = &m.ID
		}

		// getting player 2 now
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

	// subsequent matches after one, loop numround times from 2
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
				BracketType: domain.BracketType(domain.SingleElimination),
				// Participants: newParticipants,
			}

			// set forward links in previous matches
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


// --- Assuming these helper functions are defined in your package ---
// --- If they are not, you need to provide their implementations ---
// func nextPowerOfTwo(n int) int { /* ... */ }
// func applyChallongeSeeding(participants []*domain.Participant, bracketSize int) []*domain.Participant { /* ... */ }
// func isInByes(p *domain.Participant, byes []*domain.Participant) bool { /* ... */ }
// --- End Helper Function Placeholders ---


// This is your provided function, adapted slightly to be a method
// of DoubleEliminationGenerator and to include BracketType, Timestamps, and return matchCounter.
// I've named it generateWinnersBracketFromSingleElim to clearly indicate its role.
func (g *DoubleEliminationGenerator) generateWinnersBracketFromSingleElim(
    ctx context.Context,
    tournamentID uuid.UUID,
    participants []*domain.Participant,
) ([]*domain.Match, [][]*domain.Match, int, error) { // Added int for matchCounter
	if len(participants) < 2 {
		return nil, nil, 0, errors.New("at least 2 participants are required for a tournament")
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
    numRounds := 0
	if numParticipants > 0 {
		numRounds = int(math.Ceil(math.Log2(float64(numParticipants))))
	}
    if numParticipants <= 1 {
        numRounds = 0
    }


	participantsPowerOfTwo := nextPowerOfTwo(numParticipants)

	// Create matches list
	matches := make([]*domain.Match, 0)
	matchCounter := 1 // Start match numbering at 1 for WB

	// Apply Challonge-style seeding
	seededParticipants := applyChallongeSeeding(participantsCopy, participantsPowerOfTwo)

	// Initialize arrays to track matches in each round
	// roundMatchesRoster[0] will be empty, roundMatchesRoster[1] is WB Round 1, etc.
	roundMatchesRoster := make([][]*domain.Match, numRounds+1)
	for i := 0; i <= numRounds; i++ {
		roundMatchesRoster[i] = make([]*domain.Match, 0)
	}

	// Generate first round matches
	byeCount := participantsPowerOfTwo - numParticipants

	// Process participants who get byes first (no first round match)
	byeParticipants := make([]*domain.Participant, 0, byeCount)
	// This logic for finding byeParticipants seems specific to a certain seeding.
	// A more general Challonge approach relies on `nil` slots in `seededParticipants`.
	// However, I will keep your logic as requested.
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

    if numRounds > 0 { // Only create R1 matches if there are rounds
        for i := 0; i < len(participantsWithMatches); i += 2 {
            now := time.Now()
            match := &domain.Match{
                ID:           uuid.New(),
                TournamentID: tournamentID,
                Round:        1,
                MatchNumber:  matchCounter,
                Status:       domain.MatchPending,
                BracketType:  domain.WinnersBracket,
                CreatedAt:    now,
                UpdatedAt:    now,
            }

            if i < len(participantsWithMatches) {
                participant1 := participantsWithMatches[i]
                match.Participant1ID = &participant1.ID
            }

            if i+1 < len(participantsWithMatches) {
                participant2 := participantsWithMatches[i+1]
                match.Participant2ID = &participant2.ID
            }

            roundMatchesRoster[1] = append(roundMatchesRoster[1], match)
            matches = append(matches, match)
            matchCounter++
        }
    }


	// Round 2
	var round2Participants []interface{}
	for _, p := range byeParticipants {
		round2Participants = append(round2Participants, p)
	}
	if numRounds >=1 { // Only add R1 winners if R1 existed
		for i := range roundMatchesRoster[1] {
			round2Participants = append(round2Participants, roundMatchesRoster[1][i])
		}
	}

    if numRounds >= 2 { // Only create R2 if there are enough rounds
        for i := 0; i < len(round2Participants); i += 2 {
            now := time.Now()
            m := &domain.Match{
                ID:           uuid.New(),
                TournamentID: tournamentID,
                Round:        2,
                MatchNumber:  matchCounter,
                Status:       domain.MatchPending,
                BracketType:  domain.WinnersBracket,
                CreatedAt:    now,
                UpdatedAt:    now,
            }

            if i < len(round2Participants) {
                switch v := round2Participants[i].(type) {
                case *domain.Participant:
                    m.Participant1ID = &v.ID
                case *domain.Match:
                    v.NextMatchID = &m.ID
                }
            }

            if i+1 < len(round2Participants) {
                switch v := round2Participants[i+1].(type) {
                case *domain.Participant:
                    m.Participant2ID = &v.ID
                case *domain.Match:
                    v.NextMatchID = &m.ID
                }
            }
            roundMatchesRoster[2] = append(roundMatchesRoster[2], m)
            matches = append(matches, m)
            matchCounter++
        }
    }


	// subsequent matches after round 2
	for round := 3; round <= numRounds; round++ {
		prevRoundMatches := roundMatchesRoster[round-1]
		// var mixedInput []interface{} // Not used in your original, so kept out
		// for _, match := range prevRoundMatches {
		// 	mixedInput = append(mixedInput, match)
		// }
		currentRound := make([]*domain.Match, 0)

		for i := 0; i < len(prevRoundMatches); i += 2 {
            now := time.Now()
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchCounter,
				Status:       domain.MatchPending,
                BracketType:  domain.WinnersBracket,
                CreatedAt:    now,
                UpdatedAt:    now,
			}

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
		roundMatchesRoster[round] = currentRound
	}

	return matches, roundMatchesRoster, matchCounter, nil // Added matchCounter
}


// DoubleEliminationGenerator implements the Generator interface for double elimination tournaments
type DoubleEliminationGenerator struct{}

// NewDoubleEliminationGenerator creates a new double elimination bracket generator
func NewDoubleEliminationGenerator() *DoubleEliminationGenerator {
	return &DoubleEliminationGenerator{}
}

// Generate creates a double elimination tournament bracket
func (g *DoubleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, error) {
	if len(participants) < 2 {
		return nil, errors.New("at least 2 participants are required for a tournament")
	}

	// Generate winners bracket first using your provided logic
	flatWinnersMatches, allWinnerBracketRounds, wbMatchCounter, err := g.generateWinnersBracketFromSingleElim(ctx, tournamentID, participants)
	if err != nil {
		return nil, err
	}

	var actualWinnerRounds [][]*domain.Match
	if len(allWinnerBracketRounds) > 1 { // allWinnerBracketRounds[0] is empty
		actualWinnerRounds = allWinnerBracketRounds[1:]
	} else {
		actualWinnerRounds = [][]*domain.Match{}
	}

	losersBracketMatchesList, lbMatchCounter, err := g.generateLosersBracket(ctx, tournamentID, actualWinnerRounds, wbMatchCounter)
	if err != nil {
		return nil, err
	}
	
	flatLosersMatches := make([]*domain.Match, 0)
	for _, round := range losersBracketMatchesList {
		flatLosersMatches = append(flatLosersMatches, round...)
	}

	finalMatches, _, err := g.generateFinalMatches(ctx, tournamentID, allWinnerBracketRounds, losersBracketMatchesList, lbMatchCounter)
	if err != nil {
		return nil, err
	}

	allMatches := make([]*domain.Match, 0)
	allMatches = append(allMatches, flatWinnersMatches...)
	allMatches = append(allMatches, flatLosersMatches...)
	allMatches = append(allMatches, finalMatches...)

	return allMatches, nil
}


// --- PASTE THE generateLosersBracket and generateFinalMatches functions here ---
// --- from the previous correct versions. I'm omitting them for brevity but you need them. ---

// Helper to create a new LB match shell
func createLBMatchShell(tournamentID uuid.UUID, lbRoundNum int, matchCounter int) *domain.Match {
	return &domain.Match{
		ID:               uuid.New(),
		TournamentID:     tournamentID,
		Round:            lbRoundNum,
		MatchNumber:      matchCounter,
		Status:           domain.MatchPending,
		BracketType:      domain.LosersBracket,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		// PreviousMatchIDs: make([]uuid.UUID, 0), // Keep if you use this field
	}
}

// generateLosersBracket creates the lower/losers bracket
func (g *DoubleEliminationGenerator) generateLosersBracket(
	ctx context.Context,
	tournamentID uuid.UUID,
	actualWinnerRounds [][]*domain.Match,
	initialMatchCounter int,
) (losersRoundsGenerated [][]*domain.Match, nextMatchCounter int, err error) {
	numActualWBRounds := len(actualWinnerRounds)

	if numActualWBRounds == 0 {
		return [][]*domain.Match{}, initialMatchCounter, nil
	}
	if numActualWBRounds == 1 && len(actualWinnerRounds[0]) <= 1 {
		return [][]*domain.Match{}, initialMatchCounter, nil
	}

	losersRounds := make([][]*domain.Match, 0)
	lbMatchCounter := initialMatchCounter
	currentLBRoundNumber := 0
	var advancingLBSlots []*domain.Match

	if len(actualWinnerRounds[0]) > 0 {
		currentLBRoundNumber++
		currentLBRoundMatches := []*domain.Match{}
		wbR1Matches := actualWinnerRounds[0]
		for i := 0; i < len(wbR1Matches); i += 2 {
			lbMatch := createLBMatchShell(tournamentID, currentLBRoundNumber, lbMatchCounter)
			lbMatchCounter++
			wbSourceMatch1 := wbR1Matches[i]
			wbSourceMatch1.LoserNextMatchID = &lbMatch.ID
			// lbMatch.PreviousMatchIDs = append(lbMatch.PreviousMatchIDs, wbSourceMatch1.ID) // If used
			if i+1 < len(wbR1Matches) {
				wbSourceMatch2 := wbR1Matches[i+1]
				wbSourceMatch2.LoserNextMatchID = &lbMatch.ID
				// lbMatch.PreviousMatchIDs = append(lbMatch.PreviousMatchIDs, wbSourceMatch2.ID) // If used
			}
			currentLBRoundMatches = append(currentLBRoundMatches, lbMatch)
		}
		if len(currentLBRoundMatches) > 0 {
			losersRounds = append(losersRounds, currentLBRoundMatches)
			advancingLBSlots = currentLBRoundMatches
		}
	}

	for wbDropRoundIdx := 1; wbDropRoundIdx < numActualWBRounds; wbDropRoundIdx++ {
		wbMatchesProducingLosers := actualWinnerRounds[wbDropRoundIdx]
		if len(advancingLBSlots) == 0 && len(wbMatchesProducingLosers) == 0 {
			break
		}
		tempNextAdvancingLBSlotsForConsolidation := []*domain.Match{}
		if len(advancingLBSlots) > 0 || len(wbMatchesProducingLosers) > 0 {
			currentLBRoundNumber++
			dropInRoundMatches := []*domain.Match{}
			pairedCount := 0
			for pairedCount < len(advancingLBSlots) && pairedCount < len(wbMatchesProducingLosers) {
				lbMatch := createLBMatchShell(tournamentID, currentLBRoundNumber, lbMatchCounter)
				lbMatchCounter++
				prevLBMatch := advancingLBSlots[pairedCount]
				prevLBMatch.NextMatchID = &lbMatch.ID
				// lbMatch.PreviousMatchIDs = append(lbMatch.PreviousMatchIDs, prevLBMatch.ID) // If used
				wbSourceMatch := wbMatchesProducingLosers[pairedCount]
				wbSourceMatch.LoserNextMatchID = &lbMatch.ID
				// lbMatch.PreviousMatchIDs = append(lbMatch.PreviousMatchIDs, wbSourceMatch.ID) // If used
				dropInRoundMatches = append(dropInRoundMatches, lbMatch)
				tempNextAdvancingLBSlotsForConsolidation = append(tempNextAdvancingLBSlotsForConsolidation, lbMatch)
				pairedCount++
			}
			for i := pairedCount; i < len(advancingLBSlots); i++ {
				tempNextAdvancingLBSlotsForConsolidation = append(tempNextAdvancingLBSlotsForConsolidation, advancingLBSlots[i])
			}
			for i := pairedCount; i < len(wbMatchesProducingLosers); i++ {
				lbMatchForByedWBLoser := createLBMatchShell(tournamentID, currentLBRoundNumber, lbMatchCounter)
				lbMatchCounter++
				wbSourceMatch := wbMatchesProducingLosers[i]
				wbSourceMatch.LoserNextMatchID = &lbMatchForByedWBLoser.ID
				// lbMatchForByedWBLoser.PreviousMatchIDs = append(lbMatchForByedWBLoser.PreviousMatchIDs, wbSourceMatch.ID) // If used
				dropInRoundMatches = append(dropInRoundMatches, lbMatchForByedWBLoser)
				tempNextAdvancingLBSlotsForConsolidation = append(tempNextAdvancingLBSlotsForConsolidation, lbMatchForByedWBLoser)
			}
			if len(dropInRoundMatches) > 0 {
				losersRounds = append(losersRounds, dropInRoundMatches)
			}
			advancingLBSlots = tempNextAdvancingLBSlotsForConsolidation
		}
		if len(advancingLBSlots) > 1 {
			currentLBRoundNumber++
			consolidationRoundMatches := []*domain.Match{}
			tempNextAdvancingLBSlotsForDropIn := []*domain.Match{}
			for i := 0; i < len(advancingLBSlots); i += 2 {
				lbMatch := createLBMatchShell(tournamentID, currentLBRoundNumber, lbMatchCounter)
				lbMatchCounter++
				prevLBMatch1 := advancingLBSlots[i]
				prevLBMatch1.NextMatchID = &lbMatch.ID
				// lbMatch.PreviousMatchIDs = append(lbMatch.PreviousMatchIDs, prevLBMatch1.ID) // If used
				if i+1 < len(advancingLBSlots) {
					prevLBMatch2 := advancingLBSlots[i+1]
					prevLBMatch2.NextMatchID = &lbMatch.ID
					// lbMatch.PreviousMatchIDs = append(lbMatch.PreviousMatchIDs, prevLBMatch2.ID) // If used
				}
				consolidationRoundMatches = append(consolidationRoundMatches, lbMatch)
				tempNextAdvancingLBSlotsForDropIn = append(tempNextAdvancingLBSlotsForDropIn, lbMatch)
			}
			if len(consolidationRoundMatches) > 0 {
				losersRounds = append(losersRounds, consolidationRoundMatches)
			}
			advancingLBSlots = tempNextAdvancingLBSlotsForDropIn
		}
		if len(advancingLBSlots) <= 1 && (wbDropRoundIdx+1) >= numActualWBRounds {
			break
		}
		if currentLBRoundNumber > (2*numActualWBRounds+5) && numActualWBRounds > 0 {
			break
		}
	}
	return losersRounds, lbMatchCounter, nil
}

func (g *DoubleEliminationGenerator) generateFinalMatches(
	ctx context.Context,
	tournamentID uuid.UUID,
	allWinnerBracketRounds [][]*domain.Match,
	losersBracketRoundsList [][]*domain.Match,
	startingMatchNumber int,
) ([]*domain.Match, int, error) {
	var winnersBracketFinal *domain.Match
	if len(allWinnerBracketRounds) > 0 {
		for i := len(allWinnerBracketRounds) - 1; i >= 1; i-- {
			if len(allWinnerBracketRounds[i]) == 1 {
				winnersBracketFinal = allWinnerBracketRounds[i][0]
				break
			} else if len(allWinnerBracketRounds[i]) > 1 {
				return nil, 0, errors.New("winners bracket final seems to have multiple matches or is malformed")
			}
		}
	}
	if winnersBracketFinal == nil {
		if len(allWinnerBracketRounds) > 1 && len(allWinnerBracketRounds[1]) == 1 && len(losersBracketRoundsList) == 0 {
			return []*domain.Match{}, startingMatchNumber, nil
		}
		return nil, 0, errors.New("winners bracket final match not found or tournament too small for Grand Finals structure")
	}

	var losersBracketFinal *domain.Match
	if len(losersBracketRoundsList) > 0 {
		lastLBRound := losersBracketRoundsList[len(losersBracketRoundsList)-1]
		if len(lastLBRound) == 1 {
			losersBracketFinal = lastLBRound[0]
		} else if len(lastLBRound) > 1 {
			return nil, 0, errors.New("losers bracket final seems to have multiple matches or is malformed")
		}
	}
	if losersBracketFinal == nil {
		return []*domain.Match{}, startingMatchNumber, nil
	}

	finalMatches := make([]*domain.Match, 0, 2)
	matchCounter := startingMatchNumber
	now := time.Now()

	grandFinals := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        999,
		MatchNumber:  matchCounter,
		Status:       domain.MatchPending,
		BracketType:  domain.GrandFinals,
		CreatedAt:    now,
		UpdatedAt:    now,
		// PreviousMatchIDs: []uuid.UUID{winnersBracketFinal.ID, losersBracketFinal.ID}, // If used
	}
	matchCounter++
	winnersBracketFinal.NextMatchID = &grandFinals.ID
	losersBracketFinal.NextMatchID = &grandFinals.ID
	finalMatches = append(finalMatches, grandFinals)

	bracketResetMatch := &domain.Match{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		Round:        1000,
		MatchNumber:  matchCounter,
		Status:       domain.MatchPending,
		BracketType:  domain.GrandFinals,
		CreatedAt:    now,
		UpdatedAt:    now,
		// PreviousMatchIDs: []uuid.UUID{grandFinals.ID}, // If used
	}
	finalMatches = append(finalMatches, bracketResetMatch)
	
	return finalMatches, matchCounter, nil
}
// max returns the larger of x or y
func max(x, y int) int {
	if x > y {
		return x
	}
	return y
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
