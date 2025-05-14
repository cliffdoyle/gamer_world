// cmd/main.go for Ranking Service
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

	"github.com/cliffdoyle/ranking-service/internal/handler"
	"github.com/cliffdoyle/ranking-service/internal/repository"
	"github.com/cliffdoyle/ranking-service/internal/service"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found for ranking-service")
	}

	// --- Database Connection (similar to Tournament Service) ---
	dbHost := os.Getenv("RANKING_DB_HOST")
	dbPort := os.Getenv("RANKING_DB_PORT")
	dbUser := os.Getenv("RANKING_DB_USER")
	dbPass := os.Getenv("RANKING_DB_PASSWORD")
	dbName := os.Getenv("RANKING_DB_NAME")
	serverPort := os.Getenv("RANKING_SERVER_PORT")

	if serverPort == "" {
		serverPort = "8083"
	} // Different default port
	if dbHost == "" {
		dbHost = "localhost"
	}
	// Add similar defaults for other DB vars if needed

	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", // Adjust sslmode
		dbHost, dbPort, dbUser, dbPass, dbName)

	db, err := sql.Open("postgres", dbConnStr)
	if err != nil {
		log.Fatalf("Failed to connect to ranking database: %v", err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Fatalf("Failed to ping ranking database: %v", err)
	}
	log.Println("Successfully connected to ranking database")

	// --- Initialize Layers ---
	rankingRepo := repository.NewRankingRepository(db)
	rankingService := service.NewRankingService(rankingRepo)
	rankingHandler := handler.NewRankingHandler(rankingService)

	// --- Setup Gin Router ---
	router := gin.Default()

	// CORS Middleware (copy from Tournament Service or adjust as needed)
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://localhost:8082"} // Allow frontend and Tournament Service
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	config.AllowCredentials = true
	router.Use(cors.New(config))

	// --- Routes ---
	rg := router.Group("/rankings") // Base path for ranking routes
	{
		rg.POST("/match-results", rankingHandler.ProcessMatchResults)
		rg.GET("/users/:userId", rankingHandler.GetUserRanking) // e.g., /rankings/users/uuid-of-user?gameId=fifa24
		rg.GET("/leaderboard", rankingHandler.GetLeaderboard)   // e.g., /rankings/leaderboard?gameId=fifa24&page=1
	}
	router.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ranking-service-ok"}) })

	// --- Start Server ---
	srv := &http.Server{
		Addr:    ":" + serverPort,
		Handler: router,
	}

	go func() {
		log.Printf("Ranking Service starting on port %s", serverPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Ranking Service ListenAndServe error: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Ranking Service shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Ranking Service forced to shutdown: %v", err)
	}
	log.Println("Ranking Service exited properly")
}
