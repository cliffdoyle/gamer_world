package main

import (
	"context"
	"fmt"
	"log"

	"algoflow/domain"
	doubleelem "algoflow/double-elem"

	"github.com/google/uuid"
)

func main() {
	participants := []*domain.Participant{
		{ID: uuid.New(), ParticipantName: "Player 1"},
		{ID: uuid.New(), ParticipantName: "Player 2"},
		{ID: uuid.New(), ParticipantName: "Player 3"},
		{ID: uuid.New(), ParticipantName: "Player 4"},
		{ID: uuid.New(), ParticipantName: "Player 5"},
		{ID: uuid.New(), ParticipantName: "Player 6"},
		{ID: uuid.New(), ParticipantName: "Player 7"},
	}

	getName := func(uid uuid.UUID) string {
		for _, participant := range participants {
			if participant.ID == uid {
				return participant.ParticipantName
			}
		}

		return "TBD"
	}

	ctx := context.Background()
	generator := doubleelem.NewSingleEliminationGenerator()

	// dummy tournament
	tournamentID := uuid.New()

	// Generate winners bracket
	_, WinnersBracketRound, err := generator.Generate(
		ctx, tournamentID, doubleelem.SingleElimination, participants, nil,
	)
	if err != nil {
		log.Fatalf("Error generating bracket: %v", err)
	}

	// 💡 Set dummy winners and losers for testing
	for roundIndex, round := range WinnersBracketRound {
		fmt.Printf("Setting results for round %d\n", roundIndex)
		for _, match := range round {
			if len(match.Participants) < 2 {
				continue
			}
			p1 := match.Participants[0]
			p2 := match.Participants[1]

			// For testing: participant 1 always wins
			match.WinnerID = &p1.ID
			match.LoserID = &p2.ID
			match.ScoreParticipant1 = 2
			match.ScoreParticipant2 = 1

			fmt.Printf(
				"Match %d (Round %d): %s wins over %s\n", match.MatchNumber, match.Round, p1.ParticipantName,
				p2.ParticipantName,
			)
		}
	}

	for i, matches := range WinnersBracketRound {
		fmt.Printf("Round: %d\n", i)

		for _, match := range matches {
			//fmt.Printf("Match: %#v\n", *match)
			player1 := "TDB"
			player2 := "TDB"
			if match.Participant1ID != nil {
				player1 = getName(*match.Participant1ID)
			}

			if match.Participant2ID != nil {
				player2 = getName(*match.Participant2ID)
			}

			fmt.Printf("Match: {%s, %s}\n", player1, player2)
		}
	}

	// Now generate the losers bracket
	//generatorDoubleelem := doubleelem.NewDoubleEliminationGenerator()
	//
	//losersMatches, finalMatch, err := generatorDoubleelem.Generate(ctx, tournamentID, doubleelem.DoubleElimination, WinnersBracketRound, nil)
	//if err != nil {
	//	log.Fatalf("Error generating bracket: %v", err)
	//}
	//
	//// 🏆 Losers bracket matches
	//fmt.Println("\nLosers Bracket Matches:")
	//for _, m := range losersMatches {
	//	fmt.Printf("Match ID: %s, Round: %d, Match Number: %d\n", m.ID, m.Round, m.MatchNumber)
	//}
	//
	//if finalMatch != nil {
	//	fmt.Println("Final Losers Match:", finalMatch.ID)
	//} else {
	//	fmt.Println("No final match in losers bracket.")
	//}
}
