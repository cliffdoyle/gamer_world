package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/cliffdoyle/tournament-service/internal/service"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type TournamentHandler struct {
	tournamentService service.TournamentService
}

func NewTournamentHandler(tournamentService service.TournamentService) *TournamentHandler {
	return &TournamentHandler{
		tournamentService: tournamentService,
	}
}

// RegisterRoutes registers all tournament-related routes
func (h *TournamentHandler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/tournaments", h.CreateTournament).Methods("POST")
	r.HandleFunc("/tournaments", h.ListTournaments).Methods("GET")
	r.HandleFunc("/tournaments/{id}", h.GetTournament).Methods("GET")
	r.HandleFunc("/tournaments/{id}", h.UpdateTournament).Methods("PUT")
	r.HandleFunc("/tournaments/{id}", h.DeleteTournament).Methods("DELETE")
	r.HandleFunc("/tournaments/{id}/participants", h.RegisterParticipant).Methods("POST")
	r.HandleFunc("/tournaments/{id}/participants", h.GetParticipants).Methods("GET")
	r.HandleFunc("/tournaments/{id}/matches", h.GetMatches).Methods("GET")
	r.HandleFunc("/matches/{id}/score", h.UpdateMatchScore).Methods("PUT")
	r.HandleFunc("/tournaments/{id}/messages", h.GetMessages).Methods("GET")
	r.HandleFunc("/tournaments/{id}/messages", h.SendMessage).Methods("POST")
}

// CreateTournament handles the creation of a new tournament
func (h *TournamentHandler) CreateTournament(w http.ResponseWriter, r *http.Request) {
	var request domain.CreateTournamentRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// TODO: Get creator ID from auth context
	creatorID := uuid.New() // Temporary for testing

	tournament, err := h.tournamentService.CreateTournament(r.Context(), &request, creatorID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tournament)
}

// ListTournaments handles retrieving all tournaments
func (h *TournamentHandler) ListTournaments(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 {
		pageSize = 10
	}

	filters := make(map[string]interface{})
	// TODO: Add filter parsing from query params

	tournaments, total, err := h.tournamentService.ListTournaments(r.Context(), filters, page, pageSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"tournaments": tournaments,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetTournament handles retrieving a specific tournament
func (h *TournamentHandler) GetTournament(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	tournament, err := h.tournamentService.GetTournament(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tournament)
}

// UpdateTournament handles updating a tournament
func (h *TournamentHandler) UpdateTournament(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	var request domain.UpdateTournamentRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tournament, err := h.tournamentService.UpdateTournament(r.Context(), id, &request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tournament)
}

// DeleteTournament handles deleting a tournament
func (h *TournamentHandler) DeleteTournament(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	if err := h.tournamentService.DeleteTournament(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RegisterParticipant handles adding a participant to a tournament
func (h *TournamentHandler) RegisterParticipant(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tournamentID, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	// Get user ID from context
	userID := r.Context().Value("user_id").(uuid.UUID)

	var request domain.ParticipantRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	participant, err := h.tournamentService.RegisterParticipant(r.Context(), tournamentID, userID, &request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participant)
}

// GetParticipants handles retrieving all participants for a tournament
func (h *TournamentHandler) GetParticipants(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tournamentID, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	participants, err := h.tournamentService.GetParticipants(r.Context(), tournamentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participants)
}

// GetMatches handles retrieving all matches for a tournament
func (h *TournamentHandler) GetMatches(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tournamentID, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	matches, err := h.tournamentService.GetMatches(r.Context(), tournamentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(matches)
}

// UpdateMatchScore handles updating a match score
func (h *TournamentHandler) UpdateMatchScore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	matchID, err := uuid.Parse(vars["match_id"])
	if err != nil {
		http.Error(w, "Invalid match ID", http.StatusBadRequest)
		return
	}

	// TODO: Get user ID from auth context
	userID := uuid.New() // Temporary for testing

	var request domain.ScoreUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.tournamentService.UpdateMatchScore(r.Context(), matchID, userID, &request); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetMessages handles retrieving all messages for a tournament
func (h *TournamentHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tournamentID, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 50
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	messages, err := h.tournamentService.GetMessages(r.Context(), tournamentID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// SendMessage handles creating a new message for a tournament
func (h *TournamentHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tournamentID, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value("user_id").(uuid.UUID)

	var request domain.MessageRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	message, err := h.tournamentService.SendMessage(r.Context(), tournamentID, userID, &request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(message)
}
