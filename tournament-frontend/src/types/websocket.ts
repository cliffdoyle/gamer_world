// src/types/websocket.ts

import {
  TournamentStatus,
  MatchStatus, // Assuming this exists in types/tournament.ts or should be defined here
  Participant as FetchedParticipant, // Aliasing for clarity
  TournamentResponse as FetchedTournament,
  Match as FetchedMatch,
  UserActivity as FetchedActivity,
  TournamentFormat, // Ensure this is imported
  BracketType,      // Ensure this is imported
} from '@/types/tournament'; // Assuming MatchStatus is also from here

type UUIDString = string;

// --- WebSocket Event Type Constants ---
// These string values MUST EXACTLY match the constants defined in your Go backend
export const WS_EVENT_TYPES = {
  MATCH_SCORE_UPDATED: "WSEventMatchScoreUpdated", // Verify these string values against Go backend
  PARTICIPANT_JOINED: "WSEventParticipantJoined",
  TOURNAMENT_CREATED: "WSEventTournamentCreated",
  NEW_USER_ACTIVITY: "WSEventNewUserActivity",
  TOURNAMENT_STATUS_CHANGED: "WSEventTournamentStatusChanged",
  BRACKET_GENERATED: "WSEventBracketGenerated",
  // ... any other event types
} as const;

export type WebSocketEventType = typeof WS_EVENT_TYPES[keyof typeof WS_EVENT_TYPES];

// --- Generic structure for all WebSocket messages ---
// Assuming Go struct domain.WebSocketMessage has fields 'Type' and 'Payload' (PascalCase)
export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: any; // Specific payload types below will be asserted in components
}

// --- Specific Payload Interface Definitions ---
// These interfaces should match the JSON structure your Go backend sends for WebSocket payloads.
// The field names (casing) MUST match what Go's json.Marshal produces.
// Based on your types/tournament.ts, it seems your backend might produce mixed case (camelCase & snake_case).

export interface WSMatchScoreUpdatedPayload {
  // Assuming these keys match Go's JSON output for this specific payload
  tournament_id: UUIDString;
  match_id: UUIDString;
  participant1_id?: UUIDString | null;
  participant2_id?: UUIDString | null;
  score_participant1: number; // Matches FetchedMatch['score_participant1']
  score_participant2: number; // Matches FetchedMatch['score_participant2']
  winner_id?: UUIDString | null;      // Matches FetchedMatch['winner_id']
  status: MatchStatus;               // Or string if MatchStatus from tournament.ts is just a string literal union
                                      // This should match FetchedMatch['status']'s type
  // If other fields from FetchedMatch are sent in this payload, add them:
  // e.g., round?: number; match_number?: number; bracket_type?: BracketType;
}

export interface WSParticipantJoinedPayload {
  // Assuming these keys match Go's JSON output for this specific payload
  tournament_id: UUIDString;
  participant: FetchedParticipant; // Reusing FetchedParticipant from types/tournament.ts
                                    // This assumes the WebSocket 'participant' object has the EXACT same
                                    // structure and field names (including casing) as your API's Participant.
  participant_count: number;        // This seems to be camelCase. VERIFY with backend output.
                                    // If Go payload struct is { TournamentID, Participant, ParticipantCount }
                                    // then it might be "ParticipantCount" or "participant_count" in JSON
                                    // depending on Go struct tags.
}

export interface WSTournamentCreatedPayload {
  // Assuming 'tournament' key with FetchedTournament structure matches Go's JSON output.
  tournament: FetchedTournament; // Reusing FetchedTournament from types/tournament.ts
}

export interface WSNewUserActivityPayload {
  // Assuming 'activity' key with FetchedActivity structure matches Go's JSON output.
  activity: FetchedActivity;       // Reusing FetchedActivity from types/tournament.ts
                                   // Particularly, `date` field from `FetchedActivity` means Go JSON is `{"date": "..."}`
  for_user_id: UUIDString;         // This is snake_case, verify backend output.
                                   // If Go field is `ForUserID`, it might be "ForUserID" or "for_user_id" in JSON.
}

export interface WSBracketGeneratedPayload {
  // Assuming these keys match Go's JSON output.
  tournament_id: UUIDString;
  matches: FetchedMatch[];         // Reusing FetchedMatch from types/tournament.ts
  // Optionally, the tournament might change status if bracket generation implies it
  // new_tournament_status?: TournamentStatus; // And its key "new_tournament_status"
}

export interface WSTournamentStatusChangedPayload {
  // Assuming these keys match Go's JSON output.
  tournament_id: UUIDString;
  new_status: TournamentStatus;   // Or string if TournamentStatus is a string literal union
  // Optionally, send relevant parts of the tournament object that changed
  // tournament?: Partial<FetchedTournament>;
}

// Union type for known payloads (helps with type assertions)
export type KnownWebSocketPayloads =
  | WSMatchScoreUpdatedPayload
  | WSParticipantJoinedPayload
  | WSTournamentCreatedPayload
  | WSNewUserActivityPayload
  | WSBracketGeneratedPayload
  | WSTournamentStatusChangedPayload;