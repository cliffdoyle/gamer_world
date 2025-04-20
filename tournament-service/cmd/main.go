package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/cliffdoyle/tournament-service/internal/repository"
	"github.com/cliffdoyle/tournament-service/internal/service"
	"github.com/cliffdoyle/tournament-service/internal/service/bracket"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables
	dbHost := getEnvOrDefault("DB_HOST", "localhost")
	dbPort := getEnvOrDefault("DB_PORT", "5432")
	dbUser := getEnvOrDefault("DB_USER", "postgres")
	dbPass := getEnvOrDefault("DB_PASSWORD", "postgres")
	dbName := getEnvOrDefault("DB_NAME", "tournament_db")
	serverPort := getEnvOrDefault("SERVER_PORT", "8080")

	// Connect to database
	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", dbConnStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Successfully connected to database")

	// Initialize repositories
	tournamentRepo := repository.NewTournamentRepository(db)
	participantRepo := repository.NewParticipantRepository(db)
	matchRepo := repository.NewMatchRepository(db)
	messageRepo := repository.NewMessageRepository(db)

	// Initialize services
	bracketGen := bracket.NewSingleEliminationGenerator()
	tournamentService := service.NewTournamentService(
		tournamentRepo,
		participantRepo,
		matchRepo,
		messageRepo,
		bracketGen,
	)

	// Create HTTP server
	server := &http.Server{
		Addr:    ":" + serverPort,
		Handler: setupRoutes(tournamentService),
	}

	// Start server in a goroutine
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

	// Create a deadline for server shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown the server gracefully
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}

// getEnvOrDefault returns the value of the environment variable or a default value
func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// setupRoutes sets up the HTTP routes for the tournament service
func setupRoutes(ts service.TournamentService) http.Handler {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok"}`))
	})

	// Tournament routes
	router.HandleFunc("/tournaments", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			var req domain.CreateTournamentRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}
			// TODO: Get creator ID from auth context
			creatorID := uuid.New() // Temporary for testing
			tournament, err := ts.CreateTournament(r.Context(), &req, creatorID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tournament)
		case http.MethodGet:
			filters := make(map[string]interface{})
			page, _ := strconv.Atoi(r.URL.Query().Get("page"))
			if page < 1 {
				page = 1
			}
			pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
			if pageSize < 1 {
				pageSize = 10
			}
			tournaments, total, err := ts.ListTournaments(r.Context(), filters, page, pageSize)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"tournaments": tournaments,
				"total":       total,
				"page":        page,
				"page_size":   pageSize,
			})
		}
	}).Methods("GET", "POST")

	router.HandleFunc("/tournaments/{id}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id, err := uuid.Parse(vars["id"])
		if err != nil {
			http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodGet:
			tournament, err := ts.GetTournament(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tournament)
		case http.MethodPut:
			var req domain.UpdateTournamentRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}
			tournament, err := ts.UpdateTournament(r.Context(), id, &req)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(tournament)
		case http.MethodDelete:
			if err := ts.DeleteTournament(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		}
	}).Methods("GET", "PUT", "DELETE")

	// Add status update endpoint
	router.HandleFunc("/tournaments/{id}/status", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id, err := uuid.Parse(vars["id"])
		if err != nil {
			http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
			return
		}

		var req struct {
			Status domain.TournamentStatus `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := ts.UpdateTournamentStatus(r.Context(), id, req.Status); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Get updated tournament
		tournament, err := ts.GetTournament(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tournament)
	}).Methods("PUT")

	// Participant routes
	router.HandleFunc("/tournaments/{id}/participants", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		tournamentID, err := uuid.Parse(vars["id"])
		if err != nil {
			http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPost:
			var req domain.ParticipantRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}
			participant, err := ts.RegisterParticipant(r.Context(), tournamentID, &req)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(participant)
		case http.MethodGet:
			participants, err := ts.GetParticipants(r.Context(), tournamentID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(participants)
		}
	}).Methods("GET", "POST")

	// Match routes
	router.HandleFunc("/tournaments/{id}/matches", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		tournamentID, err := uuid.Parse(vars["id"])
		if err != nil {
			http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
			return
		}

		matches, err := ts.GetMatches(r.Context(), tournamentID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(matches)
	}).Methods("GET")

	// Message routes
	router.HandleFunc("/tournaments/{id}/messages", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		tournamentID, err := uuid.Parse(vars["id"])
		if err != nil {
			http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPost:
			// TODO: Get user ID from auth context
			userID := uuid.New() // Temporary for testing
			var req domain.MessageRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}
			message, err := ts.SendMessage(r.Context(), tournamentID, userID, &req)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(message)
		case http.MethodGet:
			limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
			if limit < 1 {
				limit = 50
			}
			offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
			if offset < 0 {
				offset = 0
			}
			messages, err := ts.GetMessages(r.Context(), tournamentID, limit, offset)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(messages)
		}
	}).Methods("GET", "POST")

	return router
}
