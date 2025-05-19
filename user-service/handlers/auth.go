package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"log"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/models"
	"github.com/cliffdoyle/gamer_world/user-service/utils"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"
)

// Get Google Client ID from environment variable
func getGoogleClientID() string {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		// Log a warning if client ID is missing
		fmt.Println("WARNING: GOOGLE_CLIENT_ID environment variable is not set. Google authentication will not work properly.")
		// Default fallback or placeholder for development
		return "YOUR_GOOGLE_CLIENT_ID_HERE" // This will cause authentication to fail with a specific error
	}
	return clientID
}

func Register(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Email    string `json:"email" binding:"required,email"` // <-- added
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingUser models.User
	err := database.DB.Where("username = ?", input.Username).First(&existingUser).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking username"})
		return
	}
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
		return
	}

	newUser := models.NewUser(input.Username, input.Password,input.Email)

	hashedPassword, err := utils.HashPassword(newUser.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
		return
	}
	newUser.Password = hashedPassword

	if err := database.DB.Create(&newUser).Error; err != nil {
		 log.Printf("FATAL error creating user '%s': %v", newUser.Username, err)
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Username or email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user"})
		return
	}

	token, err := utils.GenerateToken(newUser.Username, newUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token"})
		return
	}

	fmt.Printf("Registering user: %s with email: %s\n", input.Username, input.Email)


	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       newUser.ID,
			"username": newUser.Username,
			"email":    newUser.Email,
		},
	})
}

func Login(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", input.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if user.Provider != "" && user.Provider != "credentials" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Please sign in using your original method (e.g., Google)"})
		return
	}
	if user.Password == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials or account setup issue"})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := utils.GenerateToken(user.Username, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
		},
	})
}

func GoogleSignIn(c *gin.Context) {
	var input struct {
		IDToken string `json:"id_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID token is required"})
		return
	}

	// Use the function to get the Google Client ID
	googleClientID := getGoogleClientID()

	payload, err := idtoken.Validate(context.Background(), input.IDToken, googleClientID)
	if err != nil {
		// Log detailed error for debugging
		fmt.Printf("Google token validation error: %v\n", err)

		// Check for specific error types for better user feedback
		if strings.Contains(err.Error(), "audience provided does not match") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication configuration error. Please contact support.",
				"code":  "auth_config_error",
			})
			return
		}

		if strings.Contains(err.Error(), "token expired") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Your login session has expired. Please try signing in again.",
				"code":  "token_expired",
			})
			return
		}

		// Generic error message
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Google authentication failed. Please try again or use a different sign-in method.",
			"code":  "google_auth_failed",
		})
		return
	}

	googleUserID := payload.Subject
	userEmail, _ := payload.Claims["email"].(string)
	userNameFromEmail := strings.Split(userEmail, "@")[0]
	displayName, _ := payload.Claims["name"].(string)
	profilePictureURL, _ := payload.Claims["picture"].(string)

	var user models.User
	err = database.DB.Where("provider = ? AND provider_id = ?", "google", googleUserID).First(&user).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking Google user"})
		return
	}

	if err == nil {
		needsUpdate := false
		if user.DisplayName != displayName && displayName != "" {
			user.DisplayName = displayName
			needsUpdate = true
		}
		if user.ProfilePictureURL != profilePictureURL && profilePictureURL != "" {
			user.ProfilePictureURL = profilePictureURL
			needsUpdate = true
		}
		if needsUpdate {
			if err := database.DB.Save(&user).Error; err != nil {
				fmt.Println("Error updating user details on Google Sign-In:", err)
			}
		}
	} else {
		err = database.DB.Where("email = ?", userEmail).First(&user).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking email"})
			return
		}

		if err == nil {
			if user.Provider != "" && user.Provider != "google" {
				c.JSON(http.StatusConflict, gin.H{
					"error":    "Account with this email already exists. Please sign in with your original method.",
					"provider": user.Provider,
					"code":     "account_exists",
				})
				return
			} else if user.Provider == "" {
				user.Provider = "google"
				user.ProviderID = &googleUserID
				user.DisplayName = displayName
				user.ProfilePictureURL = profilePictureURL
				if err := database.DB.Save(&user).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Error linking Google account to existing user"})
					return
				}
			}
		} else {
			finalUsername := userNameFromEmail
			count := 0
			for {
				var tempUser models.User
				if err := database.DB.Where("username = ?", finalUsername).First(&tempUser).Error; errors.Is(err, gorm.ErrRecordNotFound) {
					break
				}
				count++
				finalUsername = fmt.Sprintf("%s%d", userNameFromEmail, count)
				if count > 100 {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate unique username"})
					return
				}
			}

			newUser := models.NewOAuthUser(finalUsername, userEmail, displayName, profilePictureURL, "google", googleUserID)
			if err := database.DB.Create(&newUser).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating new Google user"})
				return
			}
			user = *newUser
		}
	}

	token, err := utils.GenerateToken(user.Username, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating platform token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":                  user.ID,
			"username":            user.Username,
			"email":               user.Email,
			"display_name":        user.DisplayName,
			"profile_picture_url": user.ProfilePictureURL,
			"provider":            user.Provider,
		},
	})
}
