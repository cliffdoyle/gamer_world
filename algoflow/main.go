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
	ctx := context.Background()
	generator := doubleelem.NewSingleEliminationGenerator()

	// dummy tournament
	tournamentID := uuid.New()

	// Call the Generate function

	_, WinnersBracketRound, err := generator.Generate(ctx, tournamentID, doubleelem.SingleElimination, participants, nil)
	if err != nil {
		log.Fatalf("Error generating bracket: %v", err)
	}

	generatorDoubleelem := doubleelem.NewDoubleEliminationGenerator()

	losersMatches, finalMatch, err := generatorDoubleelem.Generate(ctx, tournamentID, doubleelem.DoubleElimination, WinnersBracketRound, nil)
	if err != nil {
		log.Fatalf("Error generating bracket: %v", err)
	}

	// LOsers bracket matches
	fmt.Println("LOsers Bracket Matches:")

	for _, m := range losersMatches {
		fmt.Printf("Match ID: %s, Round: %d, Match Number: %d\n", m.ID, m.Round, m.MatchNumber)
	}

	if finalMatch != nil {
		fmt.Println("Final Losers Match:", finalMatch.ID)
	} else {
		fmt.Println("No final match in losers bracket.")
	}

	// // Print matches
	// fmt.Println("All Matches in winners bracket:........")
	// for _, match := range winnersBracketMatches {
	// 	fmt.Printf("Match %d (Round %d): %v vs %v\n", match.MatchNumber, match.Round, match.Participant1ID, match.Participant2ID)
	// }

	// // Print matches grouped by rounds
	// fmt.Println("\nMatches by Round:")
	// for roundNum, round := range WinnersBracketRound {
	// 	fmt.Printf("Round %d:\n", roundNum)
	// 	for _, match := range round {
	// 		fmt.Printf("  Match %d: %v vs %v\n", match.MatchNumber, match.Participant1ID, match.Participant2ID)
	// 	}
	// }
}
