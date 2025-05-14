// internal/handler/ranking_handler.go
package handler

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/cliffdoyle/ranking-service/internal/domain"
	"github.com/cliffdoyle/ranking-service/internal/service"
)

type RankingHandler struct {
	rankingService service.RankingService
}

func NewRankingHandler(rs service.RankingService) *RankingHandler {
	return &RankingHandler{rankingService: rs}
}

// POST /rankings/match-results
// Body: domain.MatchResultEvent
func (h *RankingHandler) ProcessMatchResults(c *gin.Context) {
	var event domain.MatchResultEvent
	if err := c.ShouldBindJSON(&event); err != nil {
		log.Printf("Handler: Error binding MatchResultEvent: %v. Request Body: %s", err, c.Request.Body)
		// It's useful to log c.Request.Body if possible (after reading it carefully not to consume it twice)
		// For simplicity here, just log the error
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	if event.Timestamp.IsZero() { // Set timestamp if not provided by client
		event.Timestamp = time.Now()
	}

	err := h.rankingService.ProcessMatchResults(c.Request.Context(), event)
	if err != nil {
		log.Printf("Handler: Error from RankingService.ProcessMatchResults: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process match results: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Match results processed successfully"})
}

// GetUserRanking handler remains mostly the same.
func (h *RankingHandler) GetUserRanking(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}
	gameID := c.Query("gameId")

	ranking, err := h.rankingService.GetUserRanking(c.Request.Context(), userID, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user ranking: " + err.Error()})
		return
	}
	// If GetUserScoreAndRankData (and GetUserRanking) handles the "not found" case by returning a default UserRanking struct with Score=0 and Rank=0 (or calculated last rank)
	c.JSON(http.StatusOK, ranking)
}

// GetLeaderboard handler remains the same.
func (h *RankingHandler) GetLeaderboard(c *gin.Context) {
	gameID := c.Query("gameId")
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("pageSize", "20")

	page, _ := strconv.Atoi(pageStr) // Error handling can be added
	pageSize, _ := strconv.Atoi(pageSizeStr)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	entries, totalPlayers, err := h.rankingService.GetLeaderboard(c.Request.Context(), gameID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve leaderboard: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"leaderboard":  entries,
		"totalPlayers": totalPlayers,
		"page":         page,
		"pageSize":     pageSize,
		"gameId":       domain.ResolveGameID(gameID),
	})
}
