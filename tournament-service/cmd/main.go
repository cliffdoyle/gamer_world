package main

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv" // Added for parsing pagination query parameters
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

	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=require",
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
	config.AllowOrigins = []string{"http://localhost:3000"} // Adjust as per your frontend URL
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

	// Initialize UserActivity repository and service
	activityRepo := repository.NewUserActivityRepository(db)
	// UserActivityService constructor requires tournamentRepo to enrich activity descriptions if needed
	userActivityService := service.NewUserActivityService(activityRepo, tournamentRepo)

	// Initialize TournamentService
	// NOTE: The provided tournamentService.go's NewTournamentService constructor signature
	// does not include userActivityService. The line `userActivityService, // Pass UserActivityService to TournamentService`
	// from your original main.go snippet would cause a compile error based on the `service.go` you provided.
	// If tournament actions (e.g., CreateTournament, RegisterParticipant) are meant to log activities
	// using userActivityService, you will need to modify the TournamentService struct definition
	// and its NewTournamentService constructor in `internal/service/service.go` to accept and store userActivityService.
	// For now, userActivityService is used by its dedicated dashboard endpoints.
	tournamentService := service.NewTournamentService(
		tournamentRepo,
		participantRepo,
		matchRepo,
		messageRepo,
		bracketGen,
		// userActivityService, // Removed to match the NewTournamentService signature in your provided service.go
	)

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public routes (existing ones)
	router.GET("/tournaments", func(c *gin.Context) {
		filters := make(map[string]interface{}) // Simplified for brevity, you might parse filters from query
		pageQuery := c.DefaultQuery("page", "1")
		pageSizeQuery := c.DefaultQuery("pageSize", "10")

		page, _ := strconv.Atoi(pageQuery)
		pageSize, _ := strconv.Atoi(pageSizeQuery)
		if page < 1 {
			page = 1
		}
		if pageSize < 1 {
			pageSize = 10
		}

		tournaments, total, err := tournamentService.ListTournaments(c.Request.Context(), filters, page, pageSize)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"tournaments": tournaments,
			"total":       total,
			"page":        page,
			"pageSize":    pageSize,
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
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found", "id": id.String()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, tournament)
	})

	router.GET("/tournaments/:tournamentId/participants", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}
		_, err = tournamentService.GetTournament(c.Request.Context(), id)
		if err != nil {
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		participants, err := tournamentService.GetParticipants(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if participants == nil {
			participants = []*domain.ParticipantResponse{}
		}
		c.JSON(http.StatusOK, participants)
	})

	router.POST("/tournaments/:tournamentId/participants", func(c *gin.Context) {
		tournamentID, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}

		//Define expected request body
		var req struct {
			ParticipantName string `json:"participant_name" binding:"required"`
			Seed            *int   `json:"seed,omitempty"`
			UserID          *string `json:"user_id,omitempty"`          // Optional: UUID string of an existing platform user to link
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			log.Printf("[AddParticipantHandler] Error binding JSON: %v. Request Body: %s", err, getRawBody(c))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload:" + err.Error()})
			return
		}

		log.Printf("[AddParticipantHandler] Received request to add participant: Name='%s', UserID_from_req='%v', Seed=%v",
			req.ParticipantName, req.UserID, req.Seed)

		participantReq := &domain.ParticipantRequest{ParticipantName: req.ParticipantName, Seed: req.Seed}
		if req.UserID != nil && *req.UserID != "" {
			//If a user_id string is provided in the request payload
			parsedUserUUID,uuidErr:= uuid.Parse(*req.UserID)
			if uuidErr != nil {
				log.Printf("[AddParticipantHandler] Invalid UserID format provided ('%s'). Error: %v. Adding as guest.", *req.UserID, uuidErr)
				participantReq.UserID = nil // Reset to nil if invalid UUID
		}else{
			//Valid UUID string provided, link this participant entry to the system user
			participantReq.UserID = &parsedUserUUID
			log.Printf("[AddParticipantHandler] Linking participant '%s' to existing system UserID: %s", req.ParticipantName, parsedUserUUID.String())
		}
	}else{
		// No UserID provided, treat as guest
		log.Printf("[AddParticipantHandler] No UserID provided, treating participant '%s' as guest.", req.ParticipantName)
		participantReq.UserID = nil
	}
		// token := c.GetHeader("Authorization")
		// if token != "" && len(token) > 7 {
		// 	token = token[7:]
		// 	user, err := userService.ValidateToken(token)
		// 	if err == nil {
		// 		userID := user.GetUserUUID()
		// 		participantReq.UserID = &userID//Bug overwriting user_id from request payload
		// 	}
		// }
		participant, err := tournamentService.RegisterParticipant(c.Request.Context(), tournamentID, participantReq)
		if err != nil {
			log.Printf("[AddParticipantHandler] Error calling tournamentService.RegisterParticipant: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register participant"+err.Error()})
			return
		}
		log.Printf("[AddParticipantHandler] Successfully registered participant: ID=%s, Name='%s', Linked_UserID=%v",
			participant.ID.String(), participant.ParticipantName, participant.UserID)
		c.JSON(http.StatusCreated, participant)
	})

	router.GET("/tournaments/:tournamentId/matches", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}
		matches, err := tournamentService.GetMatches(c.Request.Context(), id)
		if err != nil {
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if matches == nil {
			matches = []*domain.MatchResponse{}
		}
		c.JSON(http.StatusOK, matches)
	})

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
		updateReq := &domain.ParticipantRequest{ParticipantName: req.ParticipantName}
		participant, err := tournamentService.UpdateParticipant(c.Request.Context(), tournamentID, participantID, updateReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, participant)
	})

	router.GET("/tournaments/:tournamentId/messages", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("tournamentId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
			return
		}
		limit := 50
		offset := 0 // Add query param parsing for these if needed
		messages, err := tournamentService.GetMessages(c.Request.Context(), id, limit, offset)
		if err != nil {
			if _, ok := err.(*service.ErrTournamentNotFound); ok {
				c.JSON(http.StatusNotFound, gin.H{"error": "Tournament not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if messages == nil {
			messages = []*domain.MessageResponse{}
		}
		c.JSON(http.StatusOK, messages)
	})

	// Protected routes
	protected := router.Group("")
	protected.Use(middleware.AuthMiddleware()) // Assuming your middleware sets "userID" in the context
	{
		// === NEW DASHBOARD ENDPOINTS ===

		// GET /dashboard/active-tournaments
		// Retrieves a paginated list of active tournaments for the dashboard
		protected.GET("/dashboard/active-tournaments", func(c *gin.Context) {
			pageQuery := c.DefaultQuery("page", "1")
			pageSizeQuery := c.DefaultQuery("pageSize", "3") // Show 3 active tournaments on dashboard by default

			page, err := strconv.Atoi(pageQuery)
			if err != nil || page < 1 {
				page = 1
			}

			pageSize, err := strconv.Atoi(pageSizeQuery)
			if err != nil || pageSize < 1 {
				pageSize = 3
			}
			if pageSize > 10 { // Max 10 active tournaments for dashboard view
				pageSize = 10
			}

			tournaments, total, err := tournamentService.ListActiveTournaments(c.Request.Context(), page, pageSize)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list active tournaments: " + err.Error()})
				return
			}

			// Convert base domain.Tournament to domain.TournamentResponse to include participant counts,
			// matching what the general /tournaments list might return.
			tournamentResponses := make([]*domain.TournamentResponse, 0, len(tournaments))
			for _, t := range tournaments {
				participantCount, countErr := tournamentRepo.GetParticipantCount(c.Request.Context(), t.ID)
				if countErr != nil {
					log.Printf("Warning: Error fetching participant count for tournament %s on dashboard: %v", t.ID, countErr)
					// Continue, participantCount will be 0. This is acceptable for a dashboard display.
				}

				log.Printf("Processing tournament for dashboard: ID=%s, Name=%s, PrizePool from DB=%s", t.ID, t.Name, string(t.PrizePool))
				log.Printf("Participant count for %s: %d", t.ID, participantCount)

				var prizePoolStr string
				if t.PrizePool != nil {
					prizePoolStr = string(t.PrizePool)
				} else {
					prizePoolStr = "<nil_json.RawMessage>"
				}
				log.Printf("Dashboard - Tournament from DB: ID=%s, Name=%s, PrizePool (json.RawMessage as string): '%s'", t.ID, t.Name, prizePoolStr)
				tournamentResponses = append(tournamentResponses, &domain.TournamentResponse{
					ID:                   t.ID,
					Name:                 t.Name,
					Description:          t.Description,
					Game:                 t.Game,
					Format:               t.Format,
					Status:               t.Status, // Frontend might need to map this to display strings like "Registrations Open"
					MaxParticipants:      t.MaxParticipants,
					CurrentParticipants:  participantCount,
					RegistrationDeadline: t.RegistrationDeadline,
					StartTime:            t.StartTime,
					EndTime:              t.EndTime,
					CreatedAt:            t.CreatedAt,
					Rules:                t.Rules,
					PrizePool:            t.PrizePool, // This is json.RawMessage, frontend handles display
					CustomFields:         t.CustomFields,
				})
			}

			c.JSON(http.StatusOK, gin.H{
				"tournaments": tournamentResponses,
				"total":       total,
				"page":        page,
				"pageSize":    pageSize,
			})
		})

		// GET /dashboard/activities
		// Retrieves a paginated list of recent activities for the authenticated user.
		protected.GET("/dashboard/activities", func(c *gin.Context) {
			userIDValue, exists := c.Get("userID") // Assuming AuthMiddleware sets "userID"
			if !exists {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in context. Authentication required."})
				return
			}
			userID, ok := userIDValue.(uuid.UUID)
			if !ok {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID in context is of an invalid type."})
				return
			}

			pageQuery := c.DefaultQuery("page", "1")
			pageSizeQuery := c.DefaultQuery("pageSize", "4") // Show 4 recent activities on dashboard by default

			page, err := strconv.Atoi(pageQuery)
			if err != nil || page < 1 {
				page = 1
			}

			pageSize, err := strconv.Atoi(pageSizeQuery)
			if err != nil || pageSize < 1 {
				pageSize = 4
			}
			if pageSize > 10 { // Max 10 activities for dashboard view
				pageSize = 10
			}

			activities, total, err := userActivityService.GetUserActivities(c.Request.Context(), userID, page, pageSize)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user activities: " + err.Error()})
				return
			}

			// domain.UserActivity fields (id, user_id, type, detail, date, etc.) should map to frontend needs.

			c.JSON(http.StatusOK, gin.H{
				"activities": activities,
				"total":      total,
				"page":       page,
				"pageSize":   pageSize,
			})
		})

		// === END OF NEW DASHBOARD ENDPOINTS ===

		// Existing protected tournament management routes
		protected.POST("/tournaments", func(c *gin.Context) {
			var req domain.CreateTournamentRequest

			// --- START DEBUGGING BLOCK ---
			jsonData, err := c.GetRawData()
			if err != nil {
				log.Printf("Error getting raw data: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read request body"})
				return
			}
			log.Printf("Received RAW JSON for /tournaments: %s", string(jsonData))
			// It's crucial to put raw data back for ShouldBindJSON to work after reading it
			c.Request.Body = io.NopCloser(bytes.NewBuffer(jsonData))
			// --- END DEBUGGING BLOCK ---
			if err := c.ShouldBindJSON(&req); err != nil {
				log.Printf("Error binding JSON for /tournaments: %v. Received body: %s", err, string(jsonData)) // THIS LOG IS KEY
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"+err.Error()})
				return
			}
			token := c.GetHeader("Authorization")
			if len(token) < 8 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
				return
			}
			token = token[7:]

			user, err := userService.ValidateToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user token"})
				return
			}
			creatorID := user.GetUserUUID()

			  // Log the bound request struct
			  log.Printf("Successfully bound CreateTournamentRequest: %+v", req)
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

		protected.POST("/tournaments/:tournamentId/bracket", func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("tournamentId"))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tournament ID"})
				return
			}
			log.Printf("Clearing existing matches for tournament %s", id)
			err = tournamentService.DeleteMatches(c.Request.Context(), id)
			if err != nil {
				log.Printf("Error clearing matches: %v", err)
			}
			log.Printf("Generating bracket for tournament %s", id)
			err = tournamentService.GenerateBracket(c.Request.Context(), id)
			if err != nil {
				log.Printf("Error generating bracket: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate bracket: %v", err)})
				return
			}
			log.Printf("Updating tournament %s status to IN_PROGRESS", id)
			err = tournamentService.UpdateTournamentStatus(c.Request.Context(), id, domain.InProgress)
			if err != nil {
				log.Printf("Warning: Failed to update tournament status: %v", err)
			}
			log.Printf("Fetching matches for tournament %s", id)
			matches, err := tournamentService.GetMatches(c.Request.Context(), id)
			if err != nil {
				log.Printf("Error fetching matches: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch generated matches: %v", err)})
				return
			}
			c.JSON(http.StatusCreated, matches)
		})

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
			token := c.GetHeader("Authorization")
			if len(token) < 8 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
				return
			}
			token = token[7:]
			user, err := userService.ValidateToken(token)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user token"})
				return
			}
			userID := user.GetUserUUID()
			err = tournamentService.UpdateMatchScore(c.Request.Context(), tournamentID, matchID, userID, &req)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			matches, err := tournamentService.GetMatches(c.Request.Context(), tournamentID) // Re-fetch all matches for simplicity
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated match data"})
				return
			}
			var updatedMatch *domain.MatchResponse
			for _, m := range matches {
				if m.ID == matchID {
					updatedMatch = m
					break
				}
			}
			c.JSON(http.StatusOK, updatedMatch) // Return only the updated match or all matches if preferred
		})

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
			token := c.GetHeader("Authorization")
			if len(token) < 8 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
				return
			}
			token = token[7:]
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

	go func() {
		log.Printf("Server starting on port %s", serverPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

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

// Helper function to get raw body for logging (optional, but useful for debugging JSON binding)
func getRawBody(c *gin.Context) string {
    bodyBytes, err := io.ReadAll(c.Request.Body)
    if err != nil {
        return fmt.Sprintf("error reading body: %v", err)
    }
    c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes)) // Important: Restore the body for further processing
    return string(bodyBytes)
}
