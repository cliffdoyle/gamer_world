package main

import (
	"algoflow/domain"
	doubleelem "algoflow/double-elem"
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
)



func main() {
	// Create sample participants
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

	// Helper function to get a name from UUID
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
	doubleGen := doubleelem.DoubleElimGenerator{SingleElim: singleGen}

	// Generate double elimination brackets
	allMatches, winnerRounds, loserRounds, err := doubleGen.GenerateDouble(ctx, tournamentID, participants)
	if err != nil {
		log.Fatalf("Failed to generate double elimination: %v", err)
	}

	// Simulate winner bracket results - we'll set winners for each match in the bracket
	for roundIdx, round := range winnerRounds {
		fmt.Printf("Simulating Winner's Bracket Round %d results\n", roundIdx+1)
		for _, match := range round {
			if match.Participant1ID != nil && match.Participant2ID != nil {
				// Both participants exist, set player 1 as winner, player 2 as loser
				match.WinnerID = match.Participant1ID
				match.LoserID = match.Participant2ID
				match.ScoreParticipant1 = 2
				match.ScoreParticipant2 = 1
				fmt.Printf("  Match %d: %s defeats %s (2-1)\n", 
					match.MatchNumber,
					getName(*match.Participant1ID),
					getName(*match.Participant2ID))
			} else if match.Participant1ID != nil {
				// Only player 1 exists (bye match), auto-advance
				match.WinnerID = match.Participant1ID
				fmt.Printf("  Match %d: %s advances (bye)\n", 
					match.MatchNumber,
					getName(*match.Participant1ID))
			}
		}
	}

	// Simulate loser bracket results - we'll set winners for each match in the bracket
	fmt.Println("\nSimulating Loser's Bracket results")
	for roundIdx, round := range loserRounds {
		fmt.Printf("Loser's Bracket Round %d:\n", roundIdx+1)
		for _, match := range round {
			if match.Participant1ID != nil && match.Participant2ID != nil {
				// Set player 1 as winner, player 2 as loser
				match.WinnerID = match.Participant1ID
				match.LoserID = match.Participant2ID
				match.ScoreParticipant1 = 2
				match.ScoreParticipant2 = 1
				fmt.Printf("  Match %d: %s defeats %s (2-1)\n", 
					match.MatchNumber,
					getName(*match.Participant1ID),
					getName(*match.Participant2ID))
			} else if match.Participant1ID != nil {
				// Only player 1 exists (bye match), auto-advance
				match.WinnerID = match.Participant1ID
				fmt.Printf("  Match %d: %s advances (bye)\n", 
					match.MatchNumber,
					getName(*match.Participant1ID))
			}
		}
	}

	// --- Print Winner's Bracket ---
	fmt.Println("\n--- Winner's Bracket ---")
	for i, round := range winnerRounds {
		fmt.Printf("Round %d:\n", i+1)
		for _, match := range round {
			p1 := "TBD"
			p2 := "TBD"
			if match.Participant1ID != nil {
				p1 = getName(*match.Participant1ID)
			}
			if match.Participant2ID != nil {
				p2 = getName(*match.Participant2ID)
			}
			fmt.Printf("  Match %d: %s vs %s\n", match.MatchNumber, p1, p2)
			if match.WinnerID != nil {
				fmt.Printf("    Winner: %s\n", getName(*match.WinnerID))
			}
			if match.LoserID != nil {
				fmt.Printf("    Loser: %s\n", getName(*match.LoserID))
			}
		}
	}

	// --- Print Loser's Bracket ---
	fmt.Println("\n--- Loser's Bracket ---")
	for i, round := range loserRounds {
		fmt.Printf("LB Round %d:\n", i+1)
		for _, match := range round {
			p1 := "TBD"
			p2 := "TBD"
			if match.Participant1ID != nil {
				p1 = getName(*match.Participant1ID)
			}
			if match.Participant2ID != nil {
				p2 = getName(*match.Participant2ID)
			}
			fmt.Printf("  Match %d: %s vs %s\n", match.MatchNumber, p1, p2)
			if match.WinnerID != nil {
				fmt.Printf("    Winner: %s\n", getName(*match.WinnerID))
			}
			if match.LoserID != nil {
				fmt.Printf("    Loser: %s\n", getName(*match.LoserID))
			}
		}
	}

	// --- Print Player Match History ---
	fmt.Println("\n--- Player Progression ---")
	for _, p := range participants {
		fmt.Printf("%s:\n", p.ParticipantName)
		for _, match := range allMatches {
			if (match.Participant1ID != nil && *match.Participant1ID == p.ID) ||
				(match.Participant2ID != nil && *match.Participant2ID == p.ID) {
				bracket := "Unknown"
				if match.BracketType != "" {
					bracket = string(match.BracketType)
				}
				fmt.Printf("  Played Match %d (Round %d, %s)\n", match.MatchNumber, match.Round, bracket)
			}
		}
	}

	fmt.Printf("\nTotal Matches: %d\n", len(allMatches))
}
