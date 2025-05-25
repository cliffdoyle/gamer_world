package domain

import (
	"time" // You'll likely need this for timestamps in payloads
	"github.com/google/uuid"
)

// WebSocketEventType defines the type of event being broadcast
type WebSocketEventType string

// Define constants for different event types
const (
	WSEventMatchScoreUpdated    WebSocketEventType = "MATCH_SCORE_UPDATED"
	WSEventParticipantJoined    WebSocketEventType = "PARTICIPANT_JOINED"
	WSEventTournamentCreated    WebSocketEventType = "TOURNAMENT_CREATED" // Example
	WSEventNewUserActivity      WebSocketEventType = "NEW_USER_ACTIVITY"
	// Add more event types as needed: TOURNAMENT_STATUS_CHANGED, NEW_MESSAGE, etc.
)

// WebSocketMessage is the generic structure for all messages sent over WebSocket
type WebSocketMessage struct {
	Type    WebSocketEventType `json:"type"`
	Payload interface{}        `json:"payload"` // Allows different payload structures
}

// --- Specific Payload Structs ---

// MatchScoreUpdatedPayload contains data for when a match score changes
type MatchScoreUpdatedPayload struct {
	TournamentID      uuid.UUID   `json:"tournament_id"`
	MatchID           uuid.UUID   `json:"match_id"`
	Participant1ID    *uuid.UUID  `json:"participant1_id,omitempty"` // Participant.ID
	Participant2ID    *uuid.UUID  `json:"participant2_id,omitempty"` // Participant.ID
	ScoreParticipant1 int         `json:"score_participant1"`
	ScoreParticipant2 int         `json:"score_participant2"`
	WinnerID          *uuid.UUID  `json:"winner_id,omitempty"`       // Participant.ID of winner
	Status            MatchStatus `json:"status"`                    // e.g., COMPLETED
	// Optional: For direct UI update without re-fetching participant details
	// Participant1Name  string `json:"participant1_name,omitempty"`
	// Participant2Name  string `json:"participant2_name,omitempty"`
}

// ParticipantJoinedPayload contains data for when a new participant joins
type ParticipantJoinedPayload struct {
	TournamentID    uuid.UUID           `json:"tournament_id"`
	Participant     ParticipantResponse `json:"participant"` // Your existing ParticipantResponse
	ParticipantCount int                `json:"participant_count"`
}

// NewUserActivityPayload contains the newly created user activity
type NewUserActivityPayload struct {
	Activity UserActivity `json:"activity"` // Your existing domain.UserActivity
	ForUserID uuid.UUID `json:"for_user_id"` // The UserID this activity is for (so frontend can filter)
}

// TournamentCreatedPayload (Example)
type TournamentCreatedPayload struct {
	Tournament TournamentResponse `json:"tournament"` // Your existing domain.TournamentResponse
}