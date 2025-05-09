package handlers

import (
	"net/http"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/models"
	"github.com/cliffdoyle/gamer_world/user-service/utils"
	"github.com/gin-gonic/gin"
)

func GetUserProfile(c *gin.Context) {
	username := c.GetString("username")
	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                       user.ID,
			"username":                 user.Username,
			"email":                    user.Email,
			"display_name":             user.DisplayName,
			"profile_picture_url":      user.ProfilePictureURL,
			"bio":                      user.Bio,
			"gaming_handle_psn":        user.GamingHandlePSN,
			"gaming_handle_xbox":       user.GamingHandleXbox,
			"gaming_handle_origin_pc":  user.GamingHandleOriginPC,
			"preferred_fifa_version":   user.PreferredFifaVersion,
			"favorite_real_world_club": user.FavoriteRealWorldClub,
			"provider":                 user.Provider,
			"created_at":               user.CreatedAt,
			"updated_at":               user.UpdatedAt,
		},
	})
}

func UpdateUserProfile(c *gin.Context) {
	currentUsername := c.GetString("username")
	if currentUsername == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", currentUsername).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var input struct {
		Username              string `json:"username,omitempty"`
		Password              string `json:"password,omitempty"`
		Email                 string `json:"email,omitempty"`
		DisplayName           string `json:"display_name,omitempty"`
		ProfilePictureURL     string `json:"profile_picture_url,omitempty"`
		Bio                   string `json:"bio,omitempty"`
		GamingHandlePSN       string `json:"gaming_handle_psn,omitempty"`
		GamingHandleXbox      string `json:"gaming_handle_xbox,omitempty"`
		GamingHandleOriginPC  string `json:"gaming_handle_origin_pc,omitempty"`
		PreferredFifaVersion  string `json:"preferred_fifa_version,omitempty"`
		FavoriteRealWorldClub string `json:"favorite_real_world_club,omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	updated := false

	if input.Username != "" && input.Username != user.Username {
		var count int64
		database.DB.Model(&models.User{}).Where("username = ? AND id != ?", input.Username, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
			return
		}
		user.Username = input.Username
		updated = true
	}

	if input.Password != "" && user.Provider == "credentials" {
		hashedPassword, err := utils.HashPassword(input.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
			return
		}
		user.Password = hashedPassword
		updated = true
	} else if input.Password != "" && user.Provider != "credentials" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password change not allowed for OAuth users"})
		return
	}

	if input.Email != "" && input.Email != user.Email {
		var count int64
		database.DB.Model(&models.User{}).Where("email = ? AND id != ?", input.Email, user.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
			return
		}
		user.Email = input.Email
		updated = true
	}

	if input.DisplayName != "" {
		user.DisplayName = input.DisplayName
		updated = true
	}
	if input.ProfilePictureURL != "" {
		user.ProfilePictureURL = input.ProfilePictureURL
		updated = true
	}
	if input.Bio != "" {
		user.Bio = input.Bio
		updated = true
	}
	if input.GamingHandlePSN != "" {
		user.GamingHandlePSN = input.GamingHandlePSN
		updated = true
	}
	if input.GamingHandleXbox != "" {
		user.GamingHandleXbox = input.GamingHandleXbox
		updated = true
	}
	if input.GamingHandleOriginPC != "" {
		user.GamingHandleOriginPC = input.GamingHandleOriginPC
		updated = true
	}
	if input.PreferredFifaVersion != "" {
		user.PreferredFifaVersion = input.PreferredFifaVersion
		updated = true
	}
	if input.FavoriteRealWorldClub != "" {
		user.FavoriteRealWorldClub = input.FavoriteRealWorldClub
		updated = true
	}

	if !updated {
		c.JSON(http.StatusOK, gin.H{"message": "No changes provided"})
		return
	}

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User profile updated successfully"})
}

func DeleteUserAccount(c *gin.Context) {
	username := c.GetString("username")
	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := database.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting user account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User account deleted successfully"})
}
