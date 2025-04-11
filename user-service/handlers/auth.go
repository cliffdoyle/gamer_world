package handlers

import (
	"net/http"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/models"
	"github.com/cliffdoyle/gamer_world/user-service/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func Register(c *gin.Context) {
	input := models.User{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	hashedpassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
		return
	}

	_, err = database.DB.Exec("INSERT INTO users(username, password) VALUES ($1, $2)", input.Username, string(hashedpassword))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "User registered!"})
}

func Login(c *gin.Context) {
	input := models.User{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	storedUser := models.User{}
	err := database.DB.QueryRow("SELECT id, username, password FROM users WHERE username=$1", input.Username).Scan(&storedUser.ID, &storedUser.Username, &storedUser.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	err = bcrypt.CompareHashAndPassword([]byte(storedUser.Password), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	token, err := utils.GenerateJWT(storedUser.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": gin.H{
		"id":       storedUser.ID,
		"username": storedUser.Username,
	}})

}
