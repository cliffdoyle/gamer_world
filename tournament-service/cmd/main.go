package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/client"
	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/cliffdoyle/tournament-service/internal/middleware"
	"github.com/cliffdoyle/tournament-service/internal/repository"
	"github.com/cliffdoyle/tournament-service/internal/service"
	"github.com/cliffdoyle/tournament-service/internal/service/bracket"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Database connection
	dbHost := getEnvOrDefault("DB_HOST", "localhost")
	dbPort := getEnvOrDefault("DB_PORT", "5432")
	dbUser := getEnvOrDefault("DB_USER", "postgres")
	dbPass := getEnvOrDefault("DB_PASSWORD", "postgres")
	dbName := getEnvOrDefault("DB_NAME", "tournament_db")
	serverPort := getEnvOrDefault("SERVER_PORT", "8080")

	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", dbConnStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to database")

	// Initialize services
	userService := client.NewUserService()
	tournamentRepo := repository.NewTournamentRepository(db)
	participantRepo := repository.NewParticipantRepository(db)
	matchRepo := repository.NewMatchRepository(db)
	messageRepo := repository.NewMessageRepository(db)
	bracketGen := bracket.NewSingleEliminationGenerator()

	tournamentService := service.NewTournamentService(
		tournamentRepo,
		participantRepo,
		matchRepo,
		messageRepo,
		bracketGen,
	)

	// Initialize router
	router := gin.Default()

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public routes
	router.GET("/tournaments", func(c *gin.Context) {
		filters := make(map[string]interface{})
		page := 1
		pageSize := 10
		tournaments, total, err := tournamentService.ListTournaments(c.Request.Context(), filters, page, pageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"tournaments": tournaments,
			"total":       total,
			"page":        page,
			"page_size":   pageSize,
		})
	})

	// Protected routes
	protected := router.Group("")
	protected.Use(middleware.AuthMiddleware())
	{
		// Tournament management
		protected.POST("/tournaments", func(c *gin.Context) {
			var req domain.CreateTournamentRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Validate user with user service
			token := c.GetHeader("Authorization")[7:] // Remove "Bearer " prefix
			user, err := userService.ValidateToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user token"})
				return
			}

			creatorID, err := uuid.Parse(user.ID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
				return
			}

			tournament, err := tournamentService.CreateTournament(c.Request.Context(), &req, creatorID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, tournament)
		})

		protected.PUT("/tournaments/:id", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("id"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			var req domain.UpdateTournamentRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			tournament, err := tournamentService.UpdateTournament(c.Request.Context(), id, &req)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, tournament)
		})

		protected.DELETE("/tournaments/:id", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("id"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			if err := tournamentService.DeleteTournament(c.Request.Context(), id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.Status(http.StatusNoContent)
		})

		// Tournament status management
		protected.PUT("/tournaments/:id/status", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("id"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			var req struct {
				Status domain.TournamentStatus `json:"status"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := tournamentService.UpdateTournamentStatus(c.Request.Context(), id, req.Status); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			tournament, err := tournamentService.GetTournament(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, tournament)
		})

		// Participant management
		protected.POST("/tournaments/:id/participants", func(c *gin.Context) {
			tournamentID, err := uuid.Parse(c.Param("id"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			var req domain.ParticipantRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Get user info from token
			token := c.GetHeader("Authorization")[7:] // Remove "Bearer " prefix
			user, err := userService.ValidateToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user token"})
				return
			}

			userID, err := uuid.Parse(user.ID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
				return
			}

			participant, err := tournamentService.RegisterParticipant(c.Request.Context(), tournamentID, userID, &req)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, participant)
		})

		// Message management
		protected.POST("/tournaments/:id/messages", func(c *gin.Context) {
			tournamentID, err := uuid.Parse(c.Param("id"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			var req domain.MessageRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			// Get user info from token
			token := c.GetHeader("Authorization")[7:] // Remove "Bearer " prefix
			user, err := userService.ValidateToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user token"})
				return
			}

			userID, err := uuid.Parse(user.ID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
				return
			}

			message, err := tournamentService.SendMessage(c.Request.Context(), tournamentID, userID, &req)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, message)
		})
	}

	// Start server
	server := &http.Server{
		Addr:    ":" + serverPort,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Server starting on port %s", serverPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Server is shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}

func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
