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
			"id":       user.ID,
			"username": user.Username,
		},
	})
}

func UpdateUserProfile(c *gin.Context) {
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

	var input struct {
		NewUsername string `json:"username"`
		NewPassword string `json:"password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if input.NewUsername != "" && input.NewUsername != user.Username {
		// Check if the new username already exists
		var count int64
		database.DB.Model(&models.User{}).Where("username = ?", input.NewUsername).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
			return
		}

		user.Username = input.NewUsername
	}

	if input.NewPassword != "" {
		hashedPassword, err := utils.HashPassword(input.NewPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
			return
		}
		user.Password = hashedPassword
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
