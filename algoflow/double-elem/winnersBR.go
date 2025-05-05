package doubleelem

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/bits"
	"sort"

	"algoflow/domain"

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
func (g *SingleEliminationGenerator) Generate(ctx context.Context, tournamentID uuid.UUID, format Format, participants []*domain.Participant, options map[string]interface{}) ([]*domain.Match,[][]*domain.Match, error) {
	if len(participants) < 2 {
		return nil,nil, errors.New("at least 2 participants are required for a tournament")
	}

	switch format {
	case SingleElimination:
		return g.generateSingleElimination(ctx, tournamentID, participants)
	default:
		return nil,nil, fmt.Errorf("unsupported tournament format: %s", format)
	}
}

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
	match1Participants := make([]*domain.Participant, 0, len(participantsWithMatches))
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
			match1Participants = append(match1Participants, participant1)
		}

		if i+1 < len(participantsWithMatches) {
			participant2 := participantsWithMatches[i+1]
			match.Participant2ID = &participant2.ID
			match1Participants = append(match1Participants, participant2)
		}

		roundMatches[1] = append(roundMatches[1], match)
		matches = append(matches, match)
		match.Participants = match1Participants
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
	realparticipants := getParticipantsFromMixedSlice(round2Participants, participantsCopy)
	//generate matches for round 2
	for i := 0; i < len(round2Participants); i += 2 {
		m := &domain.Match{
			ID:           uuid.New(),
			TournamentID: tournamentID,
			Round:        2,
			MatchNumber:  matchCounter,
			Status:       domain.MatchPending,
			Participants: realparticipants,
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
		newParticipants := getParticipantsFromMixedSlice(mixedInput, participantsCopy)
		currentRound := make([]*domain.Match, 0)

		for i := 0; i < len(prevRoundMatches); i += 2 {
			match := &domain.Match{
				ID:           uuid.New(),
				TournamentID: tournamentID,
				Round:        round,
				MatchNumber:  matchCounter,
				Status:       domain.MatchPending,
				Participants: newParticipants,
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

func nextPowerOfTwo(n int) int {
	if n <= 1 {
		return 1
	}
	return 1 << (bits.Len(uint(n - 1)))
}

//GetParticipants from mixed slice extracts actual participants from a []interface that may
//may contain *domain.Participant or *domain.Match

func getParticipantsFromMixedSlice(mixed []interface{}, allParticipants []*domain.Participant) []*domain.Participant {
	var result []*domain.Participant

	for _, item := range mixed {
		switch v := item.(type) {
		case *domain.Participant:
			result = append(result, v)
		case *domain.Match:
			if v.WinnerID != nil {
				for _, participant := range allParticipants {
					if participant.ID == *v.WinnerID {
						result = append(result, participant)
					}
				}
			}
		}
	}
	return result
}
