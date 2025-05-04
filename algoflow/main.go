package main

import (
	"algoflow/domain"
	"algoflow/double-elem"
	"context"
	"fmt"
	"math"

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
	tournamentID := uuid.New()
	generator := double.NewSingleEliminationGenerator()
	winners, err := generator.Generate(ctx, tournamentID, double.SingleElimination, participants, nil)
	if err != nil {
		fmt.Println("Error generating single elimination:", err)
	}

	for _, winner := range winners {
		for _, participant := range winner.Participants {
			fmt.Println(participant.ID, participant.ParticipantName, winner.Round)
		}
		// fmt.Println(winner.ID, winner.Round)
	}
	fmt.Println("losers section")

	losers := double.GenerateLosersBracket(winners)
	for _, loser := range losers {
		for _, participant := range loser.Participants {
			fmt.Println(participant.ID, participant.ParticipantName, loser.Round)
		}
		// fmt.Println(loser.ID, loser.Round)
	}
	numParticipants := 9
	numRounds := int(math.Ceil(math.Log2(float64(numParticipants))))
	fmt.Println("Number of rounds:", numRounds)
}
