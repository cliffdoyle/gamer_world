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

	// Add CORS middleware
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "User service is Up!"})
	})

	//Public routes
	r.POST("/register", handlers.Register)
	r.POST("/login", handlers.Login)

	//Protected routes
	userGroup := r.Group("/user")
	userGroup.Use(middleware.AuthMiddleware())
	{
		userGroup.GET("/profile", handlers.GetUserProfile)
		userGroup.PUT("/profile", handlers.UpdateUserProfile)
		userGroup.DELETE("/profile", handlers.DeleteUserAccount)
	}

	log.Println("User service is running on port:", os.Getenv("PORT"))
	// Start the server

	r.Run(":" + os.Getenv("PORT"))
}
