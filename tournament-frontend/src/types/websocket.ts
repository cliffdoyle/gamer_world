// src/types/websocket.ts

// Import necessary types from your existing domain/tournament types
// Adjust paths if your tournament types are structured differently
import { MatchStatus, Participant, TournamentResponse as FetchedTournament, Match as FetchedMatch, UserActivity as FetchedActivity } from '@/types/tournament';
// You might not need UUID from crypto on frontend if backend always sends strings
// For simplicity, we'll assume backend sends UUIDs as strings for IDs in JSON.
type UUIDString = string;

// Event types should EXACTLY match the 'Type' string your Go backend sends in WebSocketMessage
// These come from your tournament-service/internal/domain/websocket_events.go
export type WebSocketEventType =
  | "MATCH_SCORE_UPDATED"
  | "PARTICIPANT_JOINED"
  | "TOURNAMENT_CREATED"
  | "NEW_USER_ACTIVITY"
  | "TOURNAMENT_STATUS_CHANGED" // Example, if you broadcast this
  | "BRACKET_GENERATED";      // Example, if you broadcast this

// Generic structure for all WebSocket messages received from the backend
export interface WebSocketMessage {
  Type: WebSocketEventType; // Case-sensitive: Matches Go struct field name from backend (e.g., json.Marshal uses field name)
  Payload: any;           // Use specific payload types below with type assertion on the frontend
}

// --- Specific Payload Structs for WebSocket Events ---
// These interfaces MUST match the JSON structure your Go backend sends.
// If your Go struct fields are `TournamentID`, `MatchID` (PascalCase) and you don't use `json:"snake_case"` tags,
// then these TypeScript interfaces should also use PascalCase.
// For this example, I'll assume your Go WebSocket payload structs produce snake_case in JSON via tags.
// If they produce PascalCase (Go default), change these interfaces accordingly.

export interface MatchScoreUpdatedPayload {
  tournament_id: UUIDString;
  match_id: UUIDString;
  participant1_id?: UUIDString | null; // This is a Participant.ID from tournament_participants
  participant2_id?: UUIDString | null; // This is a Participant.ID
  score_participant1: number;
  score_participant2: number;
  winner_id?: UUIDString | null;       // Participant.ID of the winner
  status: MatchStatus;                // e.g., "COMPLETED" (MatchStatus from your domain)
  // Optional: For immediate UI update without refetching participant details, if backend includes them
  // participant1_name?: string;
  // participant2_name?: string;
}

export interface ParticipantJoinedPayload {
  tournament_id: UUIDString;
  participant: Participant;       // The full Participant object that joined (from your existing types)
  participant_count: number;      // The new total participant count
}

export interface TournamentCreatedPayload {
    tournament: FetchedTournament; // The full FetchedTournament object that was created
}

export interface NewUserActivityPayload {
  activity: FetchedActivity;      // Your existing FetchedActivity type from your backend
  for_user_id: UUIDString;        // Platform UserID this activity pertains to (for client-side filtering)
}

export interface BracketGeneratedPayload {
    tournament_id: UUIDString;
    matches: FetchedMatch[]; // Array of new/updated Match objects
}

export interface TournamentStatusChangedPayload {
    tournament_id: UUIDString;
    new_status: string; // Or your TournamentStatus type
    // You might include the entire updated tournament object or key fields
    // tournament?: FetchedTournament;
}