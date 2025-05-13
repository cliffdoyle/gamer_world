package domain

import (
	"time"
	"github.com/google/uuid"
)

// ActivityType defines the category of the user activity
type ActivityType string

const (
	ActivityTournamentJoined ActivityType = "TOURNAMENT_JOINED"
	ActivityTournamentCreated ActivityType = "TOURNAMENT_CREATED"
	ActivityMatchWon         ActivityType = "MATCH_WON"
	ActivityMatchLost        ActivityType = "MATCH_LOST"      // Optional
	ActivityMatchDraw        ActivityType = "MATCH_DRAW"      // Optional, for RR
	ActivityBadgeEarned      ActivityType = "BADGE_EARNED"    // Future
	ActivityGeneralPost      ActivityType = "GENERAL_POST"  // Future
	// ... other activity types
)

// RelatedEntityType specifies the type of entity an activity might relate to
type RelatedEntityType string

const (
	EntityTypeTournament RelatedEntityType = "TOURNAMENT"
	EntityTypeMatch      RelatedEntityType = "MATCH"
	EntityTypeUser       RelatedEntityType = "USER" // e.g. followed a user
	EntityTypeBadge      RelatedEntityType = "BADGE"
)

// UserActivity represents a single activity item for a user's feed.
type UserActivity struct {
	ID                  uuid.UUID          `json:"id"`
	UserID              uuid.UUID          `json:"user_id"`
	ActivityType        ActivityType       `json:"type"` // Consistent with frontend placeholder
	Description         string             `json:"detail"` // Consistent with frontend placeholder
	RelatedEntityID     *uuid.UUID         `json:"related_entity_id,omitempty"`
	RelatedEntityType   *RelatedEntityType `json:"related_entity_type,omitempty"`
	ContextURL          *string            `json:"context_url,omitempty"` // URL for "View" button or link
	CreatedAt           time.Time          `json:"date"` // Consistent with frontend placeholder, use 'date'
}

// For API response, we might just use UserActivity directly,
// or create a UserActivityResponse if transformation is needed.
// For now, UserActivity can serve as the response.