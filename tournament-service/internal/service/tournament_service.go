package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/cliffdoyle/tournament-service/internal/repository"
	"github.com/cliffdoyle/tournament-service/internal/service/bracket"
	"github.com/google/uuid"
)

// TournamentService defines methods for tournament business logic
type TournamentService interface {
	CreateTournament(
		ctx context.Context, request *domain.CreateTournamentRequest, creatorID uuid.UUID,
	) (*domain.Tournament, error)
	ListActiveTournaments(ctx context.Context, page, pageSize int) ([]*domain.Tournament, int, error)
	GetTournament(ctx context.Context, id uuid.UUID) (*domain.TournamentResponse, error)
	ListTournaments(
		ctx context.Context, filters map[string]interface{}, page, pageSize int,
	) ([]*domain.TournamentResponse, int, error)
	UpdateTournament(ctx context.Context, id uuid.UUID, request *domain.UpdateTournamentRequest) (
		*domain.Tournament, error,
	)
	DeleteTournament(ctx context.Context, id uuid.UUID) error
	UpdateTournamentStatus(ctx context.Context, id uuid.UUID, status domain.TournamentStatus) error

	// Participant operations
	RegisterParticipant(
		ctx context.Context, tournamentID uuid.UUID, request *domain.ParticipantRequest,
	) (*domain.Participant, error)
	UpdateParticipant(
		ctx context.Context, tournamentID uuid.UUID, participantID uuid.UUID, request *domain.ParticipantRequest,
	) (*domain.Participant, error)
	UnregisterParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error
	GetParticipants(ctx context.Context, tournamentID uuid.UUID) ([]*domain.ParticipantResponse, error)
	CheckInParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error
	UpdateParticipantSeed(ctx context.Context, tournamentID uuid.UUID, participantID uuid.UUID, seed int) error

	// Bracket operations
	GenerateBracket(ctx context.Context, tournamentID uuid.UUID) error
	GetMatches(ctx context.Context, tournamentID uuid.UUID) ([]*domain.MatchResponse, error)
	GetMatchesByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.MatchResponse, error)
	GetMatchesByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.MatchResponse, error)
	UpdateMatchScore(
		ctx context.Context, tournamentID uuid.UUID, matchID uuid.UUID, userID uuid.UUID,
		request *domain.ScoreUpdateRequest,
	) error
	DeleteMatches(ctx context.Context, tournamentID uuid.UUID) error

	// Chat operations
	SendMessage(
		ctx context.Context, tournamentID uuid.UUID, userID uuid.UUID, request *domain.MessageRequest,
	) (*domain.Message, error)
	GetMessages(ctx context.Context, tournamentID uuid.UUID, limit, offset int) ([]*domain.MessageResponse, error)
}

// tournamentService implements TournamentService
type tournamentService struct {
	tournamentRepo   repository.TournamentRepository
	participantRepo  repository.ParticipantRepository
	matchRepo        repository.MatchRepository
	messageRepo      repository.MessageRepository
	bracketGenerator bracket.Generator
	userActivityService UserActivityService
	broadcastChan       chan<- domain.WebSocketMessage // Channel to send messages to the hub
}

// NewTournamentService creates a new tournament service
func NewTournamentService(
	tournamentRepo repository.TournamentRepository,
	participantRepo repository.ParticipantRepository,
	matchRepo repository.MatchRepository,
	messageRepo repository.MessageRepository,
	bracketGenerator bracket.Generator,
	userActivityService UserActivityService,
	broadcastChan chan<- domain.WebSocketMessage, // New parameter
) TournamentService {
	return &tournamentService{
		tournamentRepo:   tournamentRepo,
		participantRepo:  participantRepo,
		matchRepo:        matchRepo,
		messageRepo:      messageRepo,
		bracketGenerator: bracketGenerator,
		userActivityService: userActivityService,
		broadcastChan:       broadcastChan, // Store it
	}
}

// ErrTournamentNotFound is returned when a tournament cannot be found
type ErrTournamentNotFound struct {
	ID uuid.UUID
}

func (e *ErrTournamentNotFound) Error() string {
	return fmt.Sprintf("tournament not found: %v", e.ID)
}

// CreateTournament creates a new tournament
func (s *tournamentService) CreateTournament(
	ctx context.Context, request *domain.CreateTournamentRequest, creatorID uuid.UUID,
) (*domain.Tournament, error) {
	// Validate format
	if request.Format == "" {
		request.Format = domain.SingleElimination
	}

	// Create tournament
	tournament := &domain.Tournament{
		ID:                   uuid.New(),
		Name:                 request.Name,
		Description:          request.Description,
		Game:                 request.Game,
		Format:               request.Format,
		Status:               domain.Draft,
		MaxParticipants:      request.MaxParticipants,
		RegistrationDeadline: request.RegistrationDeadline,
		StartTime:            request.StartTime,
		CreatedBy:            creatorID,
		Rules:                request.Rules,
		PrizePool:            request.PrizePool,
		CustomFields:         request.CustomFields,
	}

	// Save to database
	err := s.tournamentRepo.Create(ctx, tournament)
	if err != nil {
		return nil, fmt.Errorf("failed to create tournament: %w", err)
	}

	// --- RECORD ACTIVITY ---
	if s.userActivityService != nil { // Check if the service was injected
		activityType := domain.ActivityTournamentCreated
		// Description can be auto-generated by activityService or set here
		// For auto-generation, pass "" as description
		entityType := domain.EntityTypeTournament
		contextURL := fmt.Sprintf("/tournaments/%s", tournament.ID.String())

		_, activityErr := s.userActivityService.RecordActivity(
			ctx,
			creatorID, // The user who performed the action
			activityType,
			"", // Let activityService try to generate "Created tournament: 'Tournament Name'"
			&tournament.ID,
			&entityType,
			&contextURL,
		)
		if activityErr != nil {
			log.Printf("Warning: Failed to record '%s' activity for tournament %s by user %s: %v", activityType, tournament.ID, creatorID, activityErr)
		} else {
			log.Printf("Successfully recorded '%s' activity for tournament %s by user %s", activityType, tournament.ID, creatorID)
		}
	} else {
		log.Println("Warning: userActivityService is nil in tournamentService. Cannot record activity.")
	}
	// --- END RECORD ACTIVITY ---
	
// --- Broadcast tournament created event via WebSocket ---
	if s.broadcastChan != nil {
		// Construct the TournamentResponse DTO for the WebSocket payload
		participantCount, countErr := s.tournamentRepo.GetParticipantCount(ctx, tournament.ID)
		if countErr != nil {
			log.Printf("Warning: CreateTournament - Failed to get participant count for WebSocket payload for T-%s: %v", tournament.ID, countErr)
		}

		tournamentResponseForBroadcast := domain.TournamentResponse{
			ID:                   tournament.ID,
			Name:                 tournament.Name,
			Description:          tournament.Description,
			Game:                 tournament.Game,
			Format:               tournament.Format,
			Status:               tournament.Status,
			MaxParticipants:      tournament.MaxParticipants,
			CurrentParticipants:  participantCount,
			RegistrationDeadline: tournament.RegistrationDeadline,
			StartTime:            tournament.StartTime,
			EndTime:              tournament.EndTime,
			CreatedAt:            tournament.CreatedAt,
			Rules:                tournament.Rules,
			PrizePool:            tournament.PrizePool,
			CustomFields:         tournament.CustomFields,
			// Add CreatedBy if it's part of your TournamentResponse and needed by clients
			// CreatedBy: tournament.CreatedBy,
		}

		wsPayload := domain.TournamentCreatedPayload{
			Tournament: tournamentResponseForBroadcast,
		}
		wsMessage := domain.WebSocketMessage{
			Type:    domain.WSEventTournamentCreated,
			Payload: wsPayload,
		}

		// Send the domain.WebSocketMessage struct to the channel; the hub will marshal it.
		s.broadcastChan <- wsMessage
		log.Printf("Broadcasted WSEventTournamentCreated for T-%s", tournament.ID)
	} else {
		log.Println("Warning: CreateTournament - broadcastChan is nil. Cannot broadcast WebSocket event.")
	}
	// --- END Broadcast WebSocket event ---


	return tournament, nil
}

// GetTournament retrieves a tournament by ID
func (s *tournamentService) GetTournament(ctx context.Context, id uuid.UUID) (*domain.TournamentResponse, error) {
	tournament, err := s.tournamentRepo.GetByID(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("tournament not found: %v", id) {
			return nil, &ErrTournamentNotFound{ID: id}
		}
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	// Get participant count
	participantCount, err := s.tournamentRepo.GetParticipantCount(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get participant count: %w", err)
	}

	// Map to response
	response := &domain.TournamentResponse{
		ID:                   tournament.ID,
		Name:                 tournament.Name,
		Description:          tournament.Description,
		Game:                 tournament.Game,
		Format:               tournament.Format,
		Status:               tournament.Status,
		MaxParticipants:      tournament.MaxParticipants,
		CurrentParticipants:  participantCount,
		RegistrationDeadline: tournament.RegistrationDeadline,
		StartTime:            tournament.StartTime,
		EndTime:              tournament.EndTime,
		CreatedAt:            tournament.CreatedAt,
		Rules:                tournament.Rules,
		PrizePool:            tournament.PrizePool,
		CustomFields:         tournament.CustomFields,
	}

	return response, nil
}

// ListTournaments retrieves tournaments based on filters with pagination
func (s *tournamentService) ListTournaments(
	ctx context.Context, filters map[string]interface{}, page, pageSize int,
) ([]*domain.TournamentResponse, int, error) {
	tournaments, total, err := s.tournamentRepo.List(ctx, filters, page, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list tournaments: %w", err)
	}

	// Map to response
	responses := make([]*domain.TournamentResponse, len(tournaments))
	for i, tournament := range tournaments {
		// Get participant count
		participantCount, err := s.tournamentRepo.GetParticipantCount(ctx, tournament.ID)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to get participant count: %w", err)
		}

		responses[i] = &domain.TournamentResponse{
			ID:                   tournament.ID,
			Name:                 tournament.Name,
			Description:          tournament.Description,
			Game:                 tournament.Game,
			Format:               tournament.Format,
			Status:               tournament.Status,
			MaxParticipants:      tournament.MaxParticipants,
			CurrentParticipants:  participantCount,
			RegistrationDeadline: tournament.RegistrationDeadline,
			StartTime:            tournament.StartTime,
			EndTime:              tournament.EndTime,
			CreatedAt:            tournament.CreatedAt,
			Rules:                tournament.Rules,
			PrizePool:            tournament.PrizePool,
			CustomFields:         tournament.CustomFields,
		}
	}

	return responses, total, nil
}

func (s *tournamentService) ListActiveTournaments(ctx context.Context, page, pageSize int) ([]*domain.Tournament, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	} // Default page size
	if pageSize > 100 {
		pageSize = 100
	} // Max page size

	offset := (page - 1) * pageSize

	// Define what statuses are considered "active" for the dashboard
	activeStatuses := []domain.TournamentStatus{
		domain.Registration, // Assuming you defined this in domain/tournament.go
		domain.InProgress,   // Assuming you defined this
	}

	tournaments, total, err := s.tournamentRepo.GetByStatuses(ctx, activeStatuses, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list active tournaments: %w", err)
	}

	// Note: Your existing TournamentResponse in main.go wraps this in a paginated structure.
	// This service method just returns the raw data and total. The handler will format.
	return tournaments, total, nil
}

// UpdateTournament updates an existing tournament
func (s *tournamentService) UpdateTournament(
	ctx context.Context, id uuid.UUID, request *domain.UpdateTournamentRequest,
) (*domain.Tournament, error) {
	// Get current tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	// Only allow updates in Draft or Registration status
	if tournament.Status != domain.Draft && tournament.Status != domain.Registration {
		return nil, errors.New("cannot update tournament that has started or is completed")
	}

	// Update fields if provided
	if request.Name != "" {
		tournament.Name = request.Name
	}
	if request.Description != "" {
		tournament.Description = request.Description
	}
	if request.Game != "" {
		tournament.Game = request.Game
	}
	if request.Format != "" {
		tournament.Format = request.Format
	}
	if request.MaxParticipants > 0 {
		// Check if new max is less than current registrations
		count, err := s.tournamentRepo.GetParticipantCount(ctx, id)
		if err != nil {
			return nil, fmt.Errorf("failed to get participant count: %w", err)
		}
		if request.MaxParticipants < count {
			return nil, errors.New("cannot reduce max participants below current count")
		}
		tournament.MaxParticipants = request.MaxParticipants
	}
	if request.RegistrationDeadline != nil {
		tournament.RegistrationDeadline = request.RegistrationDeadline
	}
	if request.StartTime != nil {
		tournament.StartTime = request.StartTime
	}
	if request.Rules != "" {
		tournament.Rules = request.Rules
	}
	if request.PrizePool != nil {
		tournament.PrizePool = request.PrizePool
	}
	if request.CustomFields != nil {
		tournament.CustomFields = request.CustomFields
	}

	// Save updates
	err = s.tournamentRepo.Update(ctx, tournament)
	if err != nil {
		return nil, fmt.Errorf("failed to update tournament: %w", err)
	}

	return tournament, nil
}

// DeleteTournament deletes a tournament
func (s *tournamentService) DeleteTournament(ctx context.Context, id uuid.UUID) error {
	// Get current tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Only allow deletion if not in progress
	if tournament.Status == domain.InProgress {
		return errors.New("cannot delete tournament that is in progress")
	}

	// Delete tournament
	err = s.tournamentRepo.Delete(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete tournament: %w", err)
	}

	return nil
}

// UpdateTournamentStatus updates the status of a tournament
func (s *tournamentService) UpdateTournamentStatus(
	ctx context.Context, id uuid.UUID, status domain.TournamentStatus,
) error {
	// Get current tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Validate status transition
	if !isValidStatusTransition(tournament.Status, status) {
		return fmt.Errorf("invalid status transition from %s to %s", tournament.Status, status)
	}

	// Additional validations based on status
	switch status {
	case domain.Registration:
		if tournament.RegistrationDeadline != nil {
			now := time.Now().UTC()
			deadline := tournament.RegistrationDeadline.UTC()
			if now.After(deadline) {
				// Just log a warning instead of returning an error
				log.Printf("Warning: Registration deadline has passed for tournament %s", id)
			}
		}
	case domain.InProgress:
		// Removed start time validation to allow starting tournaments anytime

		// Check if minimum participants are registered
		count, err := s.tournamentRepo.GetParticipantCount(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get participant count: %w", err)
		}
		if count < 2 {
			// Just log a warning instead of returning an error
			log.Printf("Warning: Tournament %s has less than 2 participants", id)
		}
	case domain.Completed:
		// Verify all matches are completed
		matches, err := s.matchRepo.GetByTournamentID(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get tournament matches: %w", err)
		}
		for _, match := range matches {
			if match.Status != domain.MatchCompleted {
				return errors.New("cannot complete tournament with unfinished matches")
			}
		}
		now := time.Now()
		tournament.EndTime = &now
	}

	// Update status
	tournament.Status = status
	err = s.tournamentRepo.Update(ctx, tournament)
	if err != nil {
		return fmt.Errorf("failed to update tournament status: %w", err)
	}

	return nil
}

// isValidStatusTransition checks if a status transition is valid
func isValidStatusTransition(from, to domain.TournamentStatus) bool {
	// Special case: always allow transitions to IN_PROGRESS
	if to == domain.InProgress {
		return true
	}

	validTransitions := map[domain.TournamentStatus][]domain.TournamentStatus{
		domain.Draft: {
			domain.Registration,
			domain.Cancelled,
		},
		domain.Registration: {
			domain.Cancelled,
		},
		domain.InProgress: {
			domain.Completed,
			domain.Cancelled,
		},
		domain.Completed: {}, // No valid transitions from completed
		domain.Cancelled: {}, // No valid transitions from cancelled
	}

	validNextStates, exists := validTransitions[from]
	if !exists {
		return false
	}

	for _, validState := range validNextStates {
		if validState == to {
			return true
		}
	}

	return false
}

// RegisterParticipant registers a participant for a tournament
func (s *tournamentService) RegisterParticipant(
	ctx context.Context, tournamentID uuid.UUID, request *domain.ParticipantRequest,
) (*domain.Participant, error) {
    // --- END OF CHECK ---
	   log.Printf("[Service.RegisterParticipant] BEFORE creating Participant struct. request.UserID is: %v", request.UserID) // Log the pointer
    if request.UserID == nil {
        log.Printf("[Service.RegisterParticipant] Value of *request.UserID: %s", (*request.UserID).String())
		return nil, errors.New("participant registration requires a valid UserID to link")
    }
	 // --- ADD THIS CHECK ---
    // Check if a participant with this UserID is already registered for this tournament
    exists, err := s.participantRepo.ExistsByTournamentIDAndUserID(ctx, tournamentID, *request.UserID)
    if err != nil {
        // Handle potential database query errors (e.g., transient connection issues)
        return nil, fmt.Errorf("failed to check for existing participant: %w", err)
    }
    if exists {
        // Return a specific error if the user is already a participant
        // You should define a custom error type like domain.ErrAlreadyParticipant
        return nil, domain.ErrAlreadyParticipant // Or return a more generic error if you prefer
    }

	targetUserID := *request.UserID
    // Create participant
	// Create participant
	participant := &domain.Participant{
		
		ID:              uuid.New(),
		TournamentID:    tournamentID,
		UserID:          request.UserID,
		ParticipantName: request.ParticipantName,
		Seed:            0, // Default to 0, will be assigned during bracket generation
		Status:          domain.ParticipantRegistered,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	   log.Printf("[Service.RegisterParticipant] AFTER creating Participant struct. participant.UserID is: %v", participant.UserID) // Log the pointer again
    if participant.UserID != nil {
        log.Printf("[Service.RegisterParticipant] Value of *participant.UserID: %s", (*participant.UserID).String())
    }

	// Save to database
	err = s.participantRepo.Create(ctx, participant)
	if err != nil {
		return nil, fmt.Errorf("failed to register participant: %w", err)
	}
	
	// --- RECORD ACTIVITY for TOURNAMENT_JOINED ---
	if s.userActivityService != nil {
		activityType := domain.ActivityTournamentJoined
		entityType := domain.EntityTypeTournament
		contextURL := fmt.Sprintf("/tournaments/%s", tournamentID.String())

		// Passing "" for description to let userActivityService try to auto-generate it
		_, activityErr := s.userActivityService.RecordActivity(
			ctx, targetUserID, activityType, "", &tournamentID, &entityType, &contextURL,
		)
		if activityErr != nil {
			log.Printf("Warning: RegisterParticipant - Failed to record '%s' activity for T-%s by U-%s: %v",
				activityType, tournamentID, targetUserID, activityErr)
		} else {
			log.Printf("RegisterParticipant - Successfully recorded '%s' activity for T-%s by U-%s",
				activityType, tournamentID, targetUserID)
		}
	} else {
		log.Println("Warning: RegisterParticipant - userActivityService is nil. Cannot record activity.")
	}
	// --- END RECORD ACTIVITY ---

	
	if s.broadcastChan != nil && participant.UserID != nil { // Only if actual user joined
        // Get current participant count
        participantCount, _ := s.tournamentRepo.GetParticipantCount(ctx, tournamentID)

		// Convert domain.Participant to domain.ParticipantResponse if needed by frontend type
        participantResp := domain.ParticipantResponse{ /* ... map from participant ... */ }

		wsPayload := domain.ParticipantJoinedPayload{
			TournamentID:     tournamentID,
			Participant:      participantResp,
            ParticipantCount: participantCount,
		}
		wsMessage := domain.WebSocketMessage{
			Type:    domain.WSEventParticipantJoined,
			Payload: wsPayload,
		}
		s.broadcastChan <- wsMessage // Send struct, hub marshals
		log.Printf("Broadcasted WSEventParticipantJoined for P-%s in T-%s", participant.ID, tournamentID)
	}

	return participant, nil
}

// UnregisterParticipant removes a user from a tournament
func (s *tournamentService) UnregisterParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Check tournament status
	if tournament.Status != domain.Draft && tournament.Status != domain.Registration {
		return errors.New("cannot unregister after tournament has started")
	}

	// Get participant
	participant, err := s.participantRepo.GetByTournamentAndUser(ctx, tournamentID, userID)
	if err != nil {
		return fmt.Errorf("failed to get participant: %w", err)
	}

	// Delete participant
	err = s.participantRepo.Delete(ctx, participant.ID)
	if err != nil {
		return fmt.Errorf("failed to unregister participant: %w", err)
	}

	return nil
}

// GetParticipants retrieves all participants for a tournament
func (s *tournamentService) GetParticipants(ctx context.Context, tournamentID uuid.UUID) (
	[]*domain.ParticipantResponse, error,
) {
	// Get participants
	participants, err := s.participantRepo.ListByTournament(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}

	// Map to response
	responses := make([]*domain.ParticipantResponse, len(participants))
	for i, participant := range participants {
		responses[i] = &domain.ParticipantResponse{
			ID:              participant.ID,
			TournamentID:    participant.TournamentID,
			UserID:          participant.UserID,
			ParticipantName: participant.ParticipantName,
			Seed:            participant.Seed,
			Status:          participant.Status,
			IsWaitlisted:    participant.IsWaitlisted,
			CreatedAt:       participant.CreatedAt,
		}
	}

	return responses, nil
}

// CheckInParticipant checks in a participant for a tournament
func (s *tournamentService) CheckInParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Validate tournament status
	if tournament.Status != domain.Registration {
		return errors.New("tournament is not in registration phase")
	}

	// Check if tournament has started
	if tournament.StartTime != nil && time.Now().After(*tournament.StartTime) {
		return errors.New("tournament has already started")
	}

	// Get participant
	participant, err := s.participantRepo.GetByTournamentAndUser(ctx, tournamentID, userID)
	if err != nil {
		return fmt.Errorf("failed to get participant: %w", err)
	}
	if participant == nil {
		return errors.New("participant not found")
	}

	// Check if already checked in
	if participant.Status == domain.ParticipantCheckedIn {
		return errors.New("participant already checked in")
	}

	// If waitlisted, check if there's space
	if participant.IsWaitlisted {
		count, err := s.tournamentRepo.GetParticipantCount(ctx, tournamentID)
		if err != nil {
			return fmt.Errorf("failed to get participant count: %w", err)
		}
		if count >= tournament.MaxParticipants {
			return errors.New("tournament is full, cannot check in waitlisted participant")
		}
		participant.IsWaitlisted = false
	}

	// Update participant status
	participant.Status = domain.ParticipantCheckedIn
	err = s.participantRepo.Update(ctx, participant)
	if err != nil {
		return fmt.Errorf("failed to update participant: %w", err)
	}

	return nil
}

// UpdateParticipantSeed updates a participant's seed
func (s *tournamentService) UpdateParticipantSeed(
	ctx context.Context, tournamentID uuid.UUID, participantID uuid.UUID, seed int,
) error {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Check tournament status
	if tournament.Status != domain.Draft && tournament.Status != domain.Registration {
		return errors.New("cannot update seeds after tournament has started")
	}

	// Update seed
	err = s.participantRepo.UpdateSeed(ctx, participantID, seed)
	if err != nil {
		return fmt.Errorf("failed to update seed: %w", err)
	}

	return nil
}

// GenerateBracket generates the tournament bracket based on format
func (s *tournamentService) GenerateBracket(ctx context.Context, tournamentID uuid.UUID) error {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Get participants
	participants, err := s.participantRepo.ListByTournament(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get participants: %w", err)
	}

	// Check if we have enough participants
	if len(participants) < 2 {
		return errors.New("need at least 2 participants to generate bracket")
	}

	// Convert domain.TournamentFormat to bracket.Format
	var bracketFormat bracket.Format
	switch tournament.Format {
	case domain.SingleElimination:
		bracketFormat = bracket.SingleElimination
	case domain.DoubleElimination:
		bracketFormat = bracket.DoubleElimination
	case domain.RoundRobin:
		bracketFormat = bracket.RoundRobin
	case domain.Swiss:
		bracketFormat = bracket.Swiss
	default:
		return fmt.Errorf("unsupported tournament format: %s", tournament.Format)
	}

	// Generate bracket based on tournament format
	var matches []*domain.Match
	options := make(map[string]interface{})
	fmt.Println(">>> Generating brackets")
	matches, err = s.bracketGenerator.Generate(ctx, tournamentID, bracketFormat, participants, options)
	if err != nil {
		return fmt.Errorf("failed to generate bracket: %w", err)
	}
	fmt.Println("[OK] -> Generated brackets")
	for _, match := range matches {
		fmt.Printf("{%#v}/n", *match)
	}
	fmt.Println("[OK] <- Generated brackets")

	// First, create all matches without next_match_id or loser_next_match_id
	matchesWithoutReferences := make([]*domain.Match, len(matches))
	for i, match := range matches {
		matchCopy := *match
		matchCopy.NextMatchID = nil
		matchCopy.LoserNextMatchID = nil
		matchesWithoutReferences[i] = &matchCopy
	}

	// Save matches without references
	for _, match := range matchesWithoutReferences {
		if err := s.matchRepo.Create(ctx, match); err != nil {
			return fmt.Errorf("failed to create match: %w", err)
		}
	}

	// Now update matches with their next_match_id and loser_next_match_id
	for i, match := range matches {
		needsUpdate := false

		if match.NextMatchID != nil {
			matchesWithoutReferences[i].NextMatchID = match.NextMatchID
			needsUpdate = true
		}

		if match.LoserNextMatchID != nil {
			matchesWithoutReferences[i].LoserNextMatchID = match.LoserNextMatchID
			needsUpdate = true
		}

		if needsUpdate {
			if err := s.matchRepo.Update(ctx, matchesWithoutReferences[i]); err != nil {
				return fmt.Errorf("failed to update match with references: %w", err)
			}
		}
	}

	return nil
}

// GetMatches retrieves all matches for a tournament
func (s *tournamentService) GetMatches(ctx context.Context, tournamentID uuid.UUID) ([]*domain.MatchResponse, error) {
	matches, err := s.matchRepo.GetByTournamentID(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}

	// Map to response
	responses := make([]*domain.MatchResponse, len(matches))
	for i, match := range matches {
		responses[i] = &domain.MatchResponse{
			ID:                match.ID,
			TournamentID:      match.TournamentID,
			Round:             match.Round,
			MatchNumber:       match.MatchNumber,
			Participant1ID:    match.Participant1ID,
			Participant2ID:    match.Participant2ID,
			WinnerID:          match.WinnerID,
			LoserID:           match.LoserID,
			ScoreParticipant1: match.ScoreParticipant1,
			ScoreParticipant2: match.ScoreParticipant2,
			Status:            match.Status,
			ScheduledTime:     match.ScheduledTime,
			CompletedTime:     match.CompletedTime,
			NextMatchID:       match.NextMatchID,
			LoserNextMatchID:  match.LoserNextMatchID,
			CreatedAt:         match.CreatedAt,
			MatchNotes:        match.MatchNotes,
			MatchProofs:       match.MatchProofs,
		}
	}

	return responses, nil
}

// GetMatchesByRound retrieves matches for a specific round
func (s *tournamentService) GetMatchesByRound(
	ctx context.Context, tournamentID uuid.UUID, round int,
) ([]*domain.MatchResponse, error) {
	// Get matches
	matches, err := s.matchRepo.GetByRound(ctx, tournamentID, round)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}

	// Map to response
	responses := make([]*domain.MatchResponse, len(matches))
	for i, match := range matches {
		responses[i] = &domain.MatchResponse{
			ID:                match.ID,
			TournamentID:      match.TournamentID,
			Round:             match.Round,
			MatchNumber:       match.MatchNumber,
			Participant1ID:    match.Participant1ID,
			Participant2ID:    match.Participant2ID,
			WinnerID:          match.WinnerID,
			LoserID:           match.LoserID,
			ScoreParticipant1: match.ScoreParticipant1,
			ScoreParticipant2: match.ScoreParticipant2,
			Status:            match.Status,
			ScheduledTime:     match.ScheduledTime,
			CompletedTime:     match.CompletedTime,
			NextMatchID:       match.NextMatchID,
			LoserNextMatchID:  match.LoserNextMatchID,
			CreatedAt:         match.CreatedAt,
			MatchNotes:        match.MatchNotes,
			MatchProofs:       match.MatchProofs,
		}
	}

	return responses, nil
}

// GetMatchesByParticipant retrieves matches for a specific participant
func (s *tournamentService) GetMatchesByParticipant(
	ctx context.Context, tournamentID, participantID uuid.UUID,
) ([]*domain.MatchResponse, error) {
	// Get matches
	matches, err := s.matchRepo.GetByParticipant(ctx, tournamentID, participantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}

	// Map to response
	responses := make([]*domain.MatchResponse, len(matches))
	for i, match := range matches {
		responses[i] = &domain.MatchResponse{
			ID:                match.ID,
			TournamentID:      match.TournamentID,
			Round:             match.Round,
			MatchNumber:       match.MatchNumber,
			Participant1ID:    match.Participant1ID,
			Participant2ID:    match.Participant2ID,
			WinnerID:          match.WinnerID,
			LoserID:           match.LoserID,
			ScoreParticipant1: match.ScoreParticipant1,
			ScoreParticipant2: match.ScoreParticipant2,
			Status:            match.Status,
			ScheduledTime:     match.ScheduledTime,
			CompletedTime:     match.CompletedTime,
			NextMatchID:       match.NextMatchID,
			LoserNextMatchID:  match.LoserNextMatchID,
			CreatedAt:         match.CreatedAt,
			MatchNotes:        match.MatchNotes,
			MatchProofs:       match.MatchProofs,
		}
	}

	return responses, nil
}

// UpdateMatchScore updates the score of a match and advances winners if needed

// Ensure these DTOs for Ranking Service communication are defined.
// If they live in a shared package, import that. For now, defining them here for completeness.
type RS_ResultType string

const (
	RS_Win  RS_ResultType = "WIN"
	RS_Draw RS_ResultType = "DRAW"
	RS_Loss RS_ResultType = "LOSS"
)

type RS_UserMatchOutcome struct {
	UserID  uuid.UUID     `json:"userId"` // Ensure JSON tag matches Ranking Service expected input
	Outcome RS_ResultType `json:"outcome"`
}

type RS_MatchResultEvent struct {
	GameID    string                `json:"gameId,omitempty"`
	TournamentID uuid.UUID             `json:"tournamentId,omitempty"`
	Users     []RS_UserMatchOutcome `json:"users"`
	MatchID   uuid.UUID             `json:"matchId,omitempty"`
	Timestamp time.Time             `json:"timestamp"`
}

// --- End DTO definitions ---

//With activity recording
// UpdateMatchScore updates the score of a match, advances winners, and notifies ranking service.
func (s *tournamentService) UpdateMatchScore(
	ctx context.Context, tournamentID uuid.UUID, matchID uuid.UUID, reportingUserID uuid.UUID,
	request *domain.ScoreUpdateRequest,
) error {
	// 1. Get the match
	match, err := s.matchRepo.GetByID(ctx, matchID)
	if err != nil {
		return fmt.Errorf("failed to get match %s: %w", matchID, err)
	}
	if match.TournamentID != tournamentID {
		return errors.New("match does not belong to this tournament")
	}

	// 2. Get the tournament (needed for GameID and format checks)
	tournament, errT := s.tournamentRepo.GetByID(ctx, tournamentID)
	if errT != nil {
		return fmt.Errorf("failed to get tournament %s: %w", tournamentID, errT)
	}

	// 3. Ensure participants are assigned to the match
	if match.Participant1ID == nil || match.Participant2ID == nil {
		return errors.New("cannot update score: match participants not fully assigned")
	}

	// 4. Fetch the full participant entries (these contain ParticipantName and linked platform UserID)
	p1Entry, errP1 := s.participantRepo.GetByID(ctx, *match.Participant1ID)
	if errP1 != nil || p1Entry == nil {
		log.Printf("Error fetching participant 1 (P_ID: %s) details for M_ID %s: %v", *match.Participant1ID, matchID, errP1)
		return fmt.Errorf("failed to get details for participant 1 (%s): %w", *match.Participant1ID, errP1)
	}

	p2Entry, errP2 := s.participantRepo.GetByID(ctx, *match.Participant2ID)
	if errP2 != nil || p2Entry == nil {
		log.Printf("Error fetching participant 2 (P_ID: %s) details for M_ID %s: %v", *match.Participant2ID, matchID, errP2)
		return fmt.Errorf("failed to get details for participant 2 (%s): %w", *match.Participant2ID, errP2)
	}

	// 5. Update match scores from request
	match.ScoreParticipant1 = request.ScoreParticipant1
	match.ScoreParticipant2 = request.ScoreParticipant2
	if request.MatchNotes != "" {
		match.MatchNotes = request.MatchNotes
	}
	if len(request.MatchProofs) > 0 {
		match.MatchProofs = request.MatchProofs
	}
	log.Printf("Updating scores for Match %s: %s (%d) vs %s (%d)", matchID, p1Entry.ParticipantName, match.ScoreParticipant1, p2Entry.ParticipantName, match.ScoreParticipant2)


	// 6. Determine winner (Participant.ID), loser (Participant.ID), and outcomes for Ranking Service
	var p1OutcomeForRanking RS_ResultType // Use your RS_ResultType
	var p2OutcomeForRanking RS_ResultType
	var determinedWinnerPID, determinedLoserPID *uuid.UUID // Participant IDs

	if match.ScoreParticipant1 == match.ScoreParticipant2 {
		// Since you specified "no draw"
		return fmt.Errorf("ties are not allowed in this tournament format; scores were %d-%d for match %s",
			match.ScoreParticipant1, match.ScoreParticipant2, matchID)
	} else if match.ScoreParticipant1 > match.ScoreParticipant2 {
		determinedWinnerPID = match.Participant1ID // p1Entry.ID
		determinedLoserPID = match.Participant2ID  // p2Entry.ID
		p1OutcomeForRanking = RS_Win
		p2OutcomeForRanking = RS_Loss
	} else { // ScoreParticipant2 > ScoreParticipant1
		determinedWinnerPID = match.Participant2ID  // p2Entry.ID
		determinedLoserPID = match.Participant1ID // p1Entry.ID
		p1OutcomeForRanking = RS_Loss
		p2OutcomeForRanking = RS_Win
	}

	// 7. Update match record in the database
	match.Status = domain.MatchCompleted
	now := time.Now()
	match.CompletedTime = &now
	match.WinnerID = determinedWinnerPID
	match.LoserID = determinedLoserPID

	err = s.matchRepo.Update(ctx, match)
	if err != nil {
		return fmt.Errorf("failed to update match %s in repository: %w", match.ID, err)
	}
	log.Printf("Match %s successfully updated in DB. WinnerPID: %v, LoserPID: %v", match.ID, match.WinnerID, match.LoserID)

	// 8. --- Notify Ranking Service ---
	if p1Entry.UserID != nil && p2Entry.UserID != nil { // Check if platform UserIDs are linked
		rankingEvent := RS_MatchResultEvent{
			GameID:       tournament.Game, // GameID from the tournament
			TournamentID: tournamentID,
			MatchID:      match.ID,
			Timestamp:    time.Now(),
			Users: []RS_UserMatchOutcome{
				{UserID: *p1Entry.UserID, Outcome: p1OutcomeForRanking}, // Platform UserID
				{UserID: *p2Entry.UserID, Outcome: p2OutcomeForRanking}, // Platform UserID
			},
		}
		 go s.notifyRankingService(rankingEvent) // Assuming this is your async call
		// For now, let's make it synchronous for easier debugging if notifyRankingService can error
		// if errNotify := s.notifyRankingService(rankingEvent); errNotify != nil {
		// 	log.Printf("Warning: UpdateMatchScore - Failed to notify ranking service for match %s: %v", matchID, errNotify)
		// 	// Decide if this should be a critical error that rolls back or just a warning.
		// 	// For now, it's just a warning and the flow continues.
		// } else {
		// 	log.Printf("UpdateMatchScore: Successfully notified ranking service for match %s", matchID)
		// }
	} else {
		log.Printf("Warning: UpdateMatchScore - One or both participants (P1: %s - UserID: %v, P2: %s - UserID: %v) missing linked platform UserID. Ranking not notified.",
			p1Entry.ParticipantName, p1Entry.UserID, p2Entry.ParticipantName, p2Entry.UserID)
	}
	// --- END Notify Ranking Service ---


	// 9. --- RECORD ACTIVITIES for MATCH_WON and MATCH_LOST ---
	if s.userActivityService != nil {
		matchEntityType := domain.EntityTypeMatch
		matchContextURL := fmt.Sprintf("/tournaments/%s/matches/%s", tournamentID.String(), matchID.String()) // Example link

		var winnerName, loserName string
		var winnerPlatformUserID, loserPlatformUserID *uuid.UUID
		var winnerScore, loserScore int

		// Use p1Entry and p2Entry which are already fetched *domain.Participant
		if *determinedWinnerPID == p1Entry.ID { // P1 (p1Entry) won
			winnerName = p1Entry.ParticipantName
			winnerPlatformUserID = p1Entry.UserID
			winnerScore = match.ScoreParticipant1
			loserName = p2Entry.ParticipantName
			loserPlatformUserID = p2Entry.UserID
			loserScore = match.ScoreParticipant2
		} else { // P2 (p2Entry) won (since no draws)
			winnerName = p2Entry.ParticipantName
			winnerPlatformUserID = p2Entry.UserID
			winnerScore = match.ScoreParticipant2
			loserName = p1Entry.ParticipantName
			loserPlatformUserID = p1Entry.UserID
			loserScore = match.ScoreParticipant1
		}

		// Activity for Winner
		if winnerPlatformUserID != nil { // Check if winner has a linked platform UserID
			descWin := fmt.Sprintf("Won match %d-%d against %s", winnerScore, loserScore, loserName)
			_, activityErr := s.userActivityService.RecordActivity(
				ctx, *winnerPlatformUserID, domain.ActivityMatchWon, descWin, &matchID, &matchEntityType, &matchContextURL,
			)
			if activityErr != nil {
				log.Printf("Warning: UpdateMatchScore - Failed to record MATCH_WON for U-%s: %v", *winnerPlatformUserID, activityErr)
			} else {
				log.Printf("UpdateMatchScore - Successfully recorded MATCH_WON for U-%s (P-%s, Match: %s)", *winnerPlatformUserID, *determinedWinnerPID, matchID)
			}
		} else {
			log.Printf("Warning: UpdateMatchScore - Winner (P-%s) has no linked platform UserID. MATCH_WON activity not recorded.", *determinedWinnerPID)
		}

		// Activity for Loser
		if loserPlatformUserID != nil { // Check if loser has a linked platform UserID
			descLoss := fmt.Sprintf("Lost match %d-%d to %s", loserScore, winnerScore, winnerName)
			_, activityErr := s.userActivityService.RecordActivity(
				ctx, *loserPlatformUserID, domain.ActivityMatchLost, descLoss, &matchID, &matchEntityType, &matchContextURL,
			)
			if activityErr != nil {
				log.Printf("Warning: UpdateMatchScore - Failed to record MATCH_LOST for U-%s: %v", *loserPlatformUserID, activityErr)
			} else {
				log.Printf("UpdateMatchScore - Successfully recorded MATCH_LOST for U-%s (P-%s, Match: %s)", *loserPlatformUserID, *determinedLoserPID, matchID)
			}
		} else {
			log.Printf("Warning: UpdateMatchScore - Loser (P-%s) has no linked platform UserID. MATCH_LOST activity not recorded.", *determinedLoserPID)
		}
	} else {
		log.Println("Warning: UpdateMatchScore - userActivityService is nil. Cannot record activities.")
	}
	// --- END RECORD ACTIVITIES ---


	// 10. --- Post-Update Logic: Advancement and Tournament Completion ---
	// This logic uses determinedWinnerPID (Participant.ID of the winner)
	if determinedWinnerPID != nil { // This will always be true if no draws are allowed and scores differ
		// Advance winner to next match if applicable
		if match.NextMatchID != nil {
			nextMatch, errGetNext := s.matchRepo.GetByID(ctx, *match.NextMatchID)
			if errGetNext != nil {
				log.Printf("Warning: UpdateMatchScore - Error getting next match %s for winner of %s: %v", *match.NextMatchID, matchID, errGetNext)
				// Potentially return an error here or just log if advancement isn't critical to fail the whole op
			} else {
				assigned := false
				if nextMatch.Participant1ID == nil {
					nextMatch.Participant1ID = determinedWinnerPID
					assigned = true
				} else if nextMatch.Participant2ID == nil {
					nextMatch.Participant2ID = determinedWinnerPID
					assigned = true
				} else {
					log.Printf("Warning: UpdateMatchScore - Winner's next match %s already has both participants assigned.", nextMatch.ID)
				}
				if assigned {
					if errUpdateNext := s.matchRepo.Update(ctx, nextMatch); errUpdateNext != nil {
						log.Printf("Warning: UpdateMatchScore - Error updating next match %s with winner %s: %v", nextMatch.ID, *determinedWinnerPID, errUpdateNext)
						// Potentially return an error
					}
				}
			}
		}

		// For double elimination tournaments: Move loser (determinedLoserPID)
		if tournament.Format == domain.DoubleElimination && determinedLoserPID != nil && match.LoserNextMatchID != nil {
			loserNextMatch, errGetLoser := s.matchRepo.GetByID(ctx, *match.LoserNextMatchID)
			if errGetLoser != nil {
				log.Printf("Warning: UpdateMatchScore - Failed to get loser's next match %s: %v", *match.LoserNextMatchID, errGetLoser)
			} else {
				assigned := false
				if loserNextMatch.Participant1ID == nil {
					loserNextMatch.Participant1ID = determinedLoserPID
					assigned = true
				} else if loserNextMatch.Participant2ID == nil {
					loserNextMatch.Participant2ID = determinedLoserPID
					assigned = true
				}
				if assigned {
					if errUpdateLoser := s.matchRepo.Update(ctx, loserNextMatch); errUpdateLoser != nil {
						log.Printf("Warning: UpdateMatchScore - Failed to update loser's next match %s with P-%s: %v", loserNextMatch.ID, *determinedLoserPID, errUpdateLoser)
					}
				}
			}
		}
	}
	// --- End Post-Update Logic ---

	// Check if tournament is complete
	// This part might need to run outside the main db transaction of match update, or be careful.
	// For simplicity, keeping it as is, but complex tournament completion might need its own flow.
	completed, errCheck := s.checkTournamentCompletion(ctx, tournament.ID)
	if errCheck != nil {
		log.Printf("Warning (TID: %s): Failed to check tournament completion after match %s update: %v", tournamentID, matchID, errCheck)
	} else if completed {
		log.Printf("Tournament %s is now complete. Attempting to update status.", tournamentID)
		if errStatusUpdate := s.UpdateTournamentStatus(ctx, tournament.ID, domain.Completed); errStatusUpdate != nil {
			log.Printf("Warning (TID: %s): Failed to update tournament status to COMPLETED: %v", tournamentID, errStatusUpdate)
		}
	}
	if s.broadcastChan != nil {
		wsPayload := domain.MatchScoreUpdatedPayload{
			TournamentID:      tournamentID,
			MatchID:           match.ID,
			Participant1ID:    match.Participant1ID,
			Participant2ID:    match.Participant2ID,
			ScoreParticipant1: match.ScoreParticipant1,
			ScoreParticipant2: match.ScoreParticipant2,
			WinnerID:          match.WinnerID,
			Status:            match.Status,
		}
		wsMessage := domain.WebSocketMessage{
			Type:    domain.WSEventMatchScoreUpdated,
			Payload: wsPayload,
		}
		s.broadcastChan <- wsMessage // Send struct, hub marshals
		log.Printf("Broadcasted WSEventMatchScoreUpdated for M-%s", match.ID)
	}

	return nil
}

// notifyRankingService helper method (as provided before)
func (s *tournamentService) notifyRankingService(event RS_MatchResultEvent) {
	rankingServiceURL := os.Getenv("RANKING_SERVICE_URL")
	if rankingServiceURL == "" {
		log.Println("Warning: RANKING_SERVICE_URL not set. Cannot notify ranking service.")
		return
	}

	payloadBytes, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshalling ranking event for match %s: %v", event.MatchID, err)
		return
	}

	req, err := http.NewRequest("POST", rankingServiceURL+"/rankings/match-results", bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("Error creating request to ranking service for match %s: %v", event.MatchID, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	// If your ranking service requires some form of inter-service auth key:
	// req.Header.Set("X-Internal-Service-Key", os.Getenv("INTERNAL_SERVICE_KEY"))

	client := &http.Client{Timeout: 10 * time.Second} // Increased timeout slightly
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error POSTing to ranking service for match %s: %v", event.MatchID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest { // Check for 4xx and 5xx errors
		// bodyBytes, _ := io.ReadAll(resp.Body) // Requires "io" package
		log.Printf("Ranking service returned error status %d for match %s. Body might contain details.", resp.StatusCode, event.MatchID)
		// log.Printf("Ranking service error body: %s", string(bodyBytes))
	} else {
		log.Printf("Successfully notified ranking service for match %s, status %d", event.MatchID, resp.StatusCode)
	}
}


// checkTournamentCompletion checks if all matches in a tournament are completed
func (s *tournamentService) checkTournamentCompletion(ctx context.Context, tournamentID uuid.UUID) (bool, error) {
	matches, err := s.matchRepo.GetByTournamentID(ctx, tournamentID)
	if err != nil {
		return false, fmt.Errorf("failed to get matches: %w", err)
	}

	for _, match := range matches {
		if match.Status != domain.MatchCompleted {
			return false, nil
		}
	}

	return true, nil
}

// SendMessage sends a message to the tournament chat
func (s *tournamentService) SendMessage(
	ctx context.Context, tournamentID uuid.UUID, userID uuid.UUID, request *domain.MessageRequest,
) (*domain.Message, error) {
	// Check if tournament exists
	_, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	// Create message
	message := &domain.Message{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		UserID:       userID,
		Message:      request.Message,
		CreatedAt:    time.Now(),
	}

	// Save message
	err = s.messageRepo.Create(ctx, message)
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	return message, nil
}

// GetMessages retrieves chat messages for a tournament
func (s *tournamentService) GetMessages(
	ctx context.Context, tournamentID uuid.UUID, limit, offset int,
) ([]*domain.MessageResponse, error) {
	// Check if tournament exists
	_, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	// Get messages
	messages, err := s.messageRepo.ListByTournament(ctx, tournamentID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}

	// Map to response
	responses := make([]*domain.MessageResponse, len(messages))
	for i, message := range messages {
		// In a real implementation, you would fetch username from a user service
		username := fmt.Sprintf("User-%s", message.UserID.String()[:8])

		responses[i] = &domain.MessageResponse{
			ID:        message.ID,
			UserID:    message.UserID,
			Username:  username,
			Message:   message.Message,
			CreatedAt: message.CreatedAt,
		}
	}

	return responses, nil
}

// UpdateParticipant updates a participant's details
func (s *tournamentService) UpdateParticipant(
	ctx context.Context, tournamentID uuid.UUID, participantID uuid.UUID, request *domain.ParticipantRequest,
) (*domain.Participant, error) {
	// Get participant
	participant, err := s.participantRepo.GetByID(ctx, participantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participant: %w", err)
	}

	// Verify participant belongs to tournament
	if participant.TournamentID != tournamentID {
		return nil, errors.New("participant does not belong to this tournament")
	}

	// Update fields
	participant.ParticipantName = request.ParticipantName
	participant.UpdatedAt = time.Now()

	// Save updates
	err = s.participantRepo.Update(ctx, participant)
	if err != nil {
		return nil, fmt.Errorf("failed to update participant: %w", err)
	}

	return participant, nil
}

// DeleteMatches removes all matches for a tournament
func (s *tournamentService) DeleteMatches(ctx context.Context, tournamentID uuid.UUID) error {
	return s.matchRepo.Delete(ctx, tournamentID)
}
