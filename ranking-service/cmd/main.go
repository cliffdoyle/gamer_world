// ranking-service/cmd/main.go
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

	// Adjust import paths as per your project structure
	"github.com/cliffdoyle/ranking-service/internal/client" // Your new client package
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

	// --- Database Connection ---
	dbHost := os.Getenv("RANKING_DB_HOST")
	dbPort := os.Getenv("RANKING_DB_PORT")
	dbUser := os.Getenv("RANKING_DB_USER")
	dbPass := os.Getenv("RANKING_DB_PASSWORD")
	dbName := os.Getenv("RANKING_DB_NAME")
	serverPort := os.Getenv("RANKING_SERVER_PORT")

	if serverPort == "" {
		serverPort = "8083"
	}
	if dbHost == "" {
		dbHost = "localhost"
	}
	// Add defaults for other DB vars if needed

	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=require",
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

	// Instantiate the HTTP User Service Client
	userServiceURL := os.Getenv("USER_SERVICE_URL") // e.g., "http://localhost:8081" (port of user-service)
	// interServiceKey := os.Getenv("INTERNAL_SERVICE_KEY") // For securing inter-service calls

	if userServiceURL == "" {
		log.Fatal("USER_SERVICE_URL environment variable is not set. Cannot initialize UserServiceClient.")
	}
	userServiceClient := client.NewHTTPUserServiceClient(userServiceURL /*, interServiceKey */)

	rankingSvc := service.NewRankingService(rankingRepo, userServiceClient) // Pass the client
	rankingHandler := handler.NewRankingHandler(rankingSvc)

	// --- Setup Gin Router ---
	router := gin.Default()

	config := cors.DefaultConfig()
	// Ensure your tournament service (e.g., localhost:8082) and frontend (e.g. localhost:3000) are allowed
	config.AllowOrigins = []string{"http://localhost:3000", "http://localhost:8082"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Internal-Service-Key"} // Add if you use it
	config.AllowCredentials = true
	router.Use(cors.New(config))

	// --- Routes ---
	rg := router.Group("/rankings")
	{
		rg.POST("/match-results", rankingHandler.ProcessMatchResults)
		rg.GET("/users/:userId", rankingHandler.GetUserRanking)    // userId here is UUID string
		rg.GET("/leaderboard", rankingHandler.GetLeaderboard)
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

	ctxShutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatalf("Ranking Service forced to shutdown: %v", err)
	}
	log.Println("Ranking Service exited properly")
}