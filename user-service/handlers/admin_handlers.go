package handlers

import "github.com/google/uuid"


type UserForLinking struct{
	ID uuid.UUID `json:"id"`
	Username string `json:"username"`
	 DisplayName string    `json:"display_name,omitempty"`

}