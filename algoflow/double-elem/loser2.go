package doubleelem

import (
	"context"
	"errors"
	"fmt"
	"time"

	"algoflow/domain"

	"github.com/google/uuid"
)

type DoubleElimGenerator struct {
	SingleElim *SingleEliminationGenerator
}

func (g *DoubleElimGenerator) generateDouble(ctx context.Context, tournaID uuid.UUID, participants []*domain.Participant) ([]*domain.Match, [][]*domain.Match, [][]*domain.Match, error) {
	// Step 1: Generate winners bracket
	winnersMatches, winnerRounds, err := g.SingleElim.generateSingleElimination(ctx, tournaID, participants)
	if err != nil {
		return nil, nil, nil, err
	}
	loserRounds := make([][]*domain.Match, 0)

	allMatches := make([]*domain.Match, 0)
	allMatches = append(allMatches, winnersMatches...)

	return allMatches, winnerRounds, loserRounds, nil
}

func (g *SingleEliminationGenerator) generateLosers(ctx context.Context, tournamentID uuid.UUID, winnerRounds [][]*domain.Match) ([][]*domain.Match, error) {
	if len(winnerRounds) < 2 {
		return nil, errors.New("cannot generate loser's bracket with less than 2 winner rounds")
	}

	// Slice to hold rounds of the losers Bracket
	losersRound := make([][]*domain.Match, 0)

	matchCounter := 1000

	// Step2: Extract losers from WB round 1
	firstRoundLosers := []*uuid.UUID{}

	for _, match := range winnerRounds[0] {
		if match.LoserID != nil {
			firstRoundLosers = append(firstRoundLosers, match.LoserID)
		}
	}

	// Step 3b: pair up losers into LB matches
	// we take every two losers and make a new match

	lbFirstRound := []*domain.Match{} // slice to hold matches in first round
	byePlayers := []*uuid.UUID{}

	for i := 0; i < len(firstRoundLosers); i += 2 {
		if i+1 < len(firstRoundLosers) {
			match := &domain.Match{
				TournamentID:   tournamentID,
				MatchNumber:    matchCounter,
				Round:          1,
				Participant1ID: firstRoundLosers[i],
				Participant2ID: firstRoundLosers[i+1],
				BracketType:    domain.LosersBracket,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}
			matchCounter++
			lbFirstRound = append(lbFirstRound, match)
			fmt.Printf("LB Match %d: %s vs %s\n", match.MatchNumber, match.Participant1ID, match.Participant2ID)
		} else {
			// Odd person out gets a bye
			byePlayers = append(byePlayers, firstRoundLosers[i])
			fmt.Printf("Bye in LB Round 1: %s\n", *firstRoundLosers[i])
		}
	}
	// We now need to use Winners in losers bracket and bye players to form Loser bracket round 2
	// Build round2 using Winners of LB Round 1(not known yet- will be updated later)
	// Bye players-directly forwarded to Round 2

	round2Players := []*uuid.UUID{} // collecting winners from LB Round 1

	for _, match := range lbFirstRound {
		if match.WinnerID != nil {
			round2Players = append(round2Players, match.WinnerID)
		}
	}

	// Adding players who had byes in Round 1 of LB
	round2Players = append(round2Players, byePlayers...)

	// Generate matches for Round 2
	lbSecondRound := []*domain.Match{}
	var lbRound2ByePlayer *uuid.UUID

	for i := 0; i < len(round2Players); i += 2 {
		if i+1 < len(round2Players) {

			match := &domain.Match{
				TournamentID:   tournamentID,
				MatchNumber:    matchCounter,
				Round:          2,
				Participant1ID: round2Players[i],
				Participant2ID: round2Players[i+1],
				BracketType:    domain.LosersBracket,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}
			lbSecondRound = append(lbSecondRound, match)
			fmt.Printf("LB Match %d (Round 2): %s vs %s\n", match.MatchNumber, match.Participant1ID, match.Participant2ID)
			matchCounter++
		} else {
			// Bye -move to Round 3
			lbRound2ByePlayer = round2Players[i]
			fmt.Printf("Bye in LB Round 2: %s advances to Round 3\n", *lbRound2ByePlayer)
		}
	}

	round3Players:=[]*uuid.UUID{}

	for _,match:=range lbSecondRound{
		if match.WinnerID !=nil{
			round3Players=append(round3Players, match.WinnerID)
		}
	}

	if lbRound2ByePlayer != nil {
		round3Players = append(round3Players, lbRound2ByePlayer)
	}
	
}
