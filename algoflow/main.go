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
		{ID: uuid.New(), ParticipantName: "Player 8"},
	}

	getName := func(uid uuid.UUID) string {
		for _, p := range participants {
			if p.ID == uid {
				return p.ParticipantName
			}
		}
		return "TBD"
	}

	ctx := context.Background()
	tournamentID := uuid.New()

	// Setup generators
	singleGen := doubleelem.NewSingleEliminationGenerator()
	doubleGen := &doubleelem.DoubleElimGenerator{SingleElim: singleGen}

	// Generate winners bracket using double elimination
	allMatches, winnerRounds, _, err := doubleGen.GenerateDouble(ctx, tournamentID, participants)
	if err != nil {
		log.Fatalf("Failed to generate double elimination: %v", err)
	}

	// Simulate winners/losers for testing
	for _, round := range winnerRounds {
		for _, match := range round {
			if len(match.Participants) < 2 {
				continue
			}
			p1 := match.Participants[0]
			p2 := match.Participants[1]

			match.WinnerID = &p1.ID
			match.LoserID = &p2.ID
			match.ScoreParticipant1 = 2
			match.ScoreParticipant2 = 1
		}
	}

	// Generate the losers bracket
	loserRounds, err := singleGen.GenerateLosers(ctx, tournamentID, winnerRounds)
	if err != nil {
		log.Fatalf("Failed to generate losers bracket: %v", err)
	}

// Print Winner Bracket
fmt.Println("\n--- Winner's Bracket ---")
for i, round := range winnerRounds {
	fmt.Printf("Round %d:\n", i+1)
	for _, match := range round {
		var p1, p2 string
		if match.Participant1ID != nil {
			p1 = getName(*match.Participant1ID)
		} else {
			p1 = "TBD"
		}
		if match.Participant2ID != nil {
			p2 = getName(*match.Participant2ID)
		} else {
			p2 = "TBD"
		}
		fmt.Printf("  Match %d: %s vs %s\n", match.MatchNumber, p1, p2)
	}
}

	// Print Loser Bracket
fmt.Println("\n--- Loser's Bracket ---")
for i, round := range loserRounds {
	fmt.Printf("LB Round %d:\n", i+1)
	for _, match := range round {
		var p1, p2 string
		if match.Participant1ID != nil {
			p1 = getName(*match.Participant1ID)
		} else {
			p1 = "TBD"
		}
		if match.Participant2ID != nil {
			p2 = getName(*match.Participant2ID)
		} else {
			p2 = "TBD"
		}
		fmt.Printf("  Match %d: %s vs %s\n", match.MatchNumber, p1, p2)
	}
}

	fmt.Printf("\nTotal Matches: %d\n", len(allMatches))
}
