package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primary_key;default:uuid_generate_v4()" json:"id"`
	Username              string         `gorm:"type:varchar(255);unique;not null" json:"username"`
	Email                 string         `gorm:"type:varchar(255);unique" json:"email,omitempty"`
	Password              string         `gorm:"type:varchar(255);" json:"-"` // Password can be null for OAuth users
	DisplayName           string         `gorm:"type:varchar(255)" json:"display_name,omitempty"`
	ProfilePictureURL     string         `gorm:"type:text" json:"profile_picture_url,omitempty"`
	Bio                   string         `gorm:"type:text" json:"bio,omitempty"`
	GamingHandlePSN       string         `gorm:"type:varchar(255)" json:"gaming_handle_psn,omitempty"`
	GamingHandleXbox      string         `gorm:"type:varchar(255)" json:"gaming_handle_xbox,omitempty"`
	GamingHandleOriginPC  string         `gorm:"type:varchar(255)" json:"gaming_handle_origin_pc,omitempty"`
	PreferredFifaVersion  string         `gorm:"type:varchar(50)" json:"preferred_fifa_version,omitempty"`
	FavoriteRealWorldClub string         `gorm:"type:varchar(100)" json:"favorite_real_world_club,omitempty"`
	Provider              string         `gorm:"type:varchar(50);not null;default:'credentials'" json:"provider,omitempty"`            // e.g., "google", "credentials"
	ProviderID            *string         `gorm:"type:varchar(255);" json:"provider_id,omitempty"` // Unique ID from the provider
	CreatedAt             time.Time      `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt             time.Time      `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate will set a UUID rather than numeric ID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	// If creating a user with a provider (e.g. Google) and no password is set, ensure password is not validated
	if u.Provider != "" && u.Password == "" {
		// No explicit action needed for GORM, just ensuring password is not 'not null' if provider is used
	} else if u.Provider == "" && u.Password == "" {
		// This case should be handled by validation in handlers (e.g. user via credentials must have password)
	}
	return nil
}

// NewUser creates a new user with a generated UUID (for username/password registration)
func NewUser(username, password,email string) *User {
	return &User{
		ID:       uuid.New(),
		Username: username,
		Password: password,
		Email: email,
		// Provider: "credentials", // Default provider for this constructor
	}
}

// NewOAuthUser creates a new user for OAuth providers
func NewOAuthUser(username, email, displayName, profilePictureURL, provider, providerID string) *User {
	return &User{
		ID:                uuid.New(),
		Username:          username, // May need a strategy for generating unique username if email is not unique or not desired as username
		Email:             email,
		DisplayName:       displayName,
		ProfilePictureURL: profilePictureURL,
		Provider:          provider,
		ProviderID:        &providerID,
	}
}
