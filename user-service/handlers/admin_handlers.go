package handlers

import (
	"net/http"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)


type UserForLinking struct{
	ID uuid.UUID `json:"id"`
	Username string `json:"username"`
	 DisplayName string    `json:"display_name,omitempty"`

}

func ListUsersForLinking(c *gin.Context) {
	var users []models.User
	err:=database.DB.Select("id, username").Order("username asc").Find(&users).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users: " + err.Error()})
		return
	}

	//Map the users to a simple DTO
	responseUsers:= make([]UserForLinking, len(users))
	for i, user := range users {
		responseUsers[i] = UserForLinking{
			ID: user.ID,
			Username: user.Username,
			DisplayName: user.DisplayName,
		}
	}
	c.JSON(http.StatusOK, gin.H{"users": responseUsers})
}