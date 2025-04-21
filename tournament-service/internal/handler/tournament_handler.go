package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/cliffdoyle/tournament-service/internal/service"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// TournamentService defines the interface for tournament operations
type TournamentService interface {
	GetTournament(ctx context.Context, id uuid.UUID) (*domain.TournamentResponse, error)
	GetParticipants(ctx context.Context, tournamentID uuid.UUID) ([]*domain.ParticipantResponse, error)
}

// TournamentHandler handles HTTP requests for tournaments
type TournamentHandler struct {
	tournamentService TournamentService
}

// NewTournamentHandler creates a new tournament handler
func NewTournamentHandler(ts TournamentService) *TournamentHandler {
	return &TournamentHandler{
		tournamentService: ts,
	}
}

// GetTournament handles GET /tournaments/{id}
func (h *TournamentHandler) GetTournament(w http.ResponseWriter, r *http.Request) {
	// Extract tournament ID from URL
	params := mux.Vars(r)
	tournamentID, err := uuid.Parse(params["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	// Get tournament from service
	tournament, err := h.tournamentService.GetTournament(r.Context(), tournamentID)
	if err != nil {
		// Check if it's a not found error
		if _, ok := err.(*service.ErrTournamentNotFound); ok {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		// For all other errors, return 500
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return tournament as JSON response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tournament)
}

// GetParticipants handles GET /tournaments/{id}/participants
func (h *TournamentHandler) GetParticipants(w http.ResponseWriter, r *http.Request) {
	// Extract tournament ID from URL
	params := mux.Vars(r)
	tournamentID, err := uuid.Parse(params["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	// Get participants from service
	participants, err := h.tournamentService.GetParticipants(r.Context(), tournamentID)
	if err != nil {
		// Check if it's a not found error
		if _, ok := err.(*service.ErrTournamentNotFound); ok {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		// For all other errors, return 500
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Return participants as JSON response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participants)
}
