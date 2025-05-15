package main

import (
	"log"
	"os"

	"github.com/cliffdoyle/gamer_world/user-service/database"
	"github.com/cliffdoyle/gamer_world/user-service/handlers"
	"github.com/cliffdoyle/gamer_world/user-service/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	database.Connect()

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"} // Update for production
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "User service is Up!"})
	})

	// Public auth routes
	authRoutes := r.Group("/auth")
	{
		authRoutes.POST("/register", handlers.Register)
		authRoutes.POST("/login", handlers.Login)
		authRoutes.POST("/google/signin", handlers.GoogleSignIn) // New route for Google Sign-In
	}

	// Protected user routes (profile related)
	userRoutes := r.Group("/user")
	userRoutes.Use(middleware.AuthMiddleware()) // Assuming AuthMiddleware verifies your platform's JWT
	{
		userRoutes.GET("/profile", handlers.GetUserProfile)
		userRoutes.PUT("/profile", handlers.UpdateUserProfile)
		userRoutes.DELETE("/account", handlers.DeleteUserAccount) // Changed from /profile to /account for clarity

		//Added new routes for linking other services to get a list of users for linking 
		//to tournament participants
		userRoutes.GET("/list-for-linking", handlers.ListUsersForLinking)
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8081" // Default port if not set
		log.Printf("Defaulting to port %s", port)
	}
	log.Printf("User service is running on port: %s", port)
	r.Run(":" + port)
}
