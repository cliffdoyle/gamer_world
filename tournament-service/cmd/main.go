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
	"github.com/gin-contrib/cors"
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
	serverPort := getEnvOrDefault("SERVER_PORT", "8082")

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

	// Initialize router
	router := gin.Default()

	// Add CORS middleware
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"}
	config.AllowCredentials = true
	config.ExposeHeaders = []string{"Content-Length"}
	config.MaxAge = 86400 // 24 hours
	router.Use(cors.New(config))

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

	router.GET("/tournaments/:tournamentId", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		tournament, err := tournamentService.GetTournament(c.Request.Context(), id)
		if err != nil {
			// Check if it's a not found error
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found", "id": id.String()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, tournament)
	})

	// Add participants route
	router.GET("/tournaments/:tournamentId/participants", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		// First check if tournament exists
		_, err = tournamentService.GetTournament(c.Request.Context(), id)
		if err != nil {
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found", "id": id.String()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Get participants
		participants, err := tournamentService.GetParticipants(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Even if there are no participants, return an empty array instead of null
		if participants == nil {
			participants = []*domain.ParticipantResponse{}
		}

		c.JSON(http.StatusOK, participants)
	})

	// Add participant registration endpoint
	router.POST("/tournaments/:tournamentId/participants", func(c *gin.Context) {
		tournamentID, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		var req struct {
			ParticipantName string `json:"participant_name" binding:"required"`
			Seed            *int   `json:"seed,omitempty"` // Make seed optional
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create participant request
		participantReq := &domain.ParticipantRequest{
			ParticipantName: req.ParticipantName,
			Seed:            req.Seed, // Pass optional seed
		}

		// Get user info from token if available
		token := c.GetHeader("Authorization")
		if token != "" {
			token = token[7:] // Remove "Bearer " prefix
			user, err := userService.ValidateToken(token)
			if err == nil {
				userID := user.GetUserUUID()
				participantReq.UserID = &userID
			}
		}

		participant, err := tournamentService.RegisterParticipant(c.Request.Context(), tournamentID, participantReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, participant)
	})

	// Add matches endpoint
	router.GET("/tournaments/:tournamentId/matches", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		matches, err := tournamentService.GetMatches(c.Request.Context(), id)
		if err != nil {
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found", "id": id.String()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Even if there are no matches, return an empty array instead of null
		if matches == nil {
			matches = []*domain.MatchResponse{}
		}

		c.JSON(http.StatusOK, matches)
	})

	// Add participant update endpoint
	router.PUT("/tournaments/:tournamentId/participants/:participantId", func(c *gin.Context) {
		tournamentID, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		participantID, err := uuid.Parse(c.Param("participantId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid participant ID"})
			return
		}

		var req struct {
			ParticipantName string `json:"participant_name" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create update request
		updateReq := &domain.ParticipantRequest{
			ParticipantName: req.ParticipantName,
		}

		participant, err := tournamentService.UpdateParticipant(c.Request.Context(), tournamentID, participantID, updateReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, participant)
	})

	// Add messages endpoint
	router.GET("/tournaments/:tournamentId/messages", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		limit := 50
		offset := 0
		messages, err := tournamentService.GetMessages(c.Request.Context(), id, limit, offset)
		if err != nil {
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found", "id": id.String()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Even if there are no messages, return an empty array instead of null
		if messages == nil {
			messages = []*domain.MessageResponse{}
		}

		c.JSON(http.StatusOK, messages)
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

			creatorID := user.GetUserUUID()

			tournament, err := tournamentService.CreateTournament(c.Request.Context(), &req, creatorID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusCreated, tournament)
		})

		protected.PUT("/tournaments/:tournamentId", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("tournamentId"))
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

		protected.DELETE("/tournaments/:tournamentId", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("tournamentId"))
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
		protected.PUT("/tournaments/:tournamentId/status", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("tournamentId"))
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

		// Add bracket generation endpoint
		protected.POST("/tournaments/:tournamentId/bracket", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("tournamentId"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			err = tournamentService.GenerateBracket(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.Status(http.StatusCreated)
		})

		// Add match score update endpoint
		protected.PUT("/tournaments/:tournamentId/matches/:matchId", func(c *gin.Context) {
			tournamentID, err := uuid.Parse(c.Param("tournamentId"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}

			matchID, err := uuid.Parse(c.Param("matchId"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid match ID"})
				return
			}

			var req domain.ScoreUpdateRequest
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

			userID := user.GetUserUUID()

			// Pass tournamentID to validate the match belongs to the correct tournament
			err = tournamentService.UpdateMatchScore(c.Request.Context(), tournamentID, matchID, userID, &req)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Get updated match data
			matches, err := tournamentService.GetMatches(c.Request.Context(), tournamentID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated match data"})
				return
			}

			// Find the updated match
			var updatedMatch *domain.MatchResponse
			for _, m := range matches {
				if m.ID == matchID {
					updatedMatch = m
					break
				}
			}

			c.JSON(http.StatusOK, updatedMatch)
		})

		// Message management
		protected.POST("/tournaments/:tournamentId/messages", func(c *gin.Context) {
			tournamentID, err := uuid.Parse(c.Param("tournamentId"))
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

			userID := user.GetUserUUID()
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
