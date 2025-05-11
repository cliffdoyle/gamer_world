package service

import (
	"context"
	"errors"
	"fmt"
	"log"
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
}

// NewTournamentService creates a new tournament service
func NewTournamentService(
	tournamentRepo repository.TournamentRepository,
	participantRepo repository.ParticipantRepository,
	matchRepo repository.MatchRepository,
	messageRepo repository.MessageRepository,
	bracketGenerator bracket.Generator,
) TournamentService {
	return &tournamentService{
		tournamentRepo:   tournamentRepo,
		participantRepo:  participantRepo,
		matchRepo:        matchRepo,
		messageRepo:      messageRepo,
		bracketGenerator: bracketGenerator,
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

	// Save to database
	err := s.participantRepo.Create(ctx, participant)
	if err != nil {
		return nil, fmt.Errorf("failed to register participant: %w", err)
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
// UpdateMatchScore updates the score of a match and advances winners if needed
func (s *tournamentService) UpdateMatchScore(
	ctx context.Context, tournamentID uuid.UUID, matchID uuid.UUID, userID uuid.UUID,
	request *domain.ScoreUpdateRequest,
) error {
	// Get match
	match, err := s.matchRepo.GetByID(ctx, matchID)
	if err != nil {
		return fmt.Errorf("failed to get match: %w", err)
	}

	// Validate match belongs to the tournament
	if match.TournamentID != tournamentID {
		return errors.New("match does not belong to this tournament")
	}

	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Update scores from request
	match.ScoreParticipant1 = request.ScoreParticipant1
	match.ScoreParticipant2 = request.ScoreParticipant2
	if request.MatchNotes != "" { // Check if MatchNotes is part of ScoreUpdateRequest and not empty
		match.MatchNotes = request.MatchNotes
	}
	if len(request.MatchProofs) > 0 { // Check if MatchProofs is part of ScoreUpdateRequest and not empty
		match.MatchProofs = request.MatchProofs
	}

	// Declare winnerID and loserID. These will be populated if scores are unequal.
	var winnerID, loserID *uuid.UUID

	// Determine winnerID and loserID based on scores (applies to all formats where unequal scores mean a winner)
	if match.ScoreParticipant1 > match.ScoreParticipant2 {
		winnerID = match.Participant1ID
		loserID = match.Participant2ID
	} else if match.ScoreParticipant2 > match.ScoreParticipant1 {
		winnerID = match.Participant2ID
		loserID = match.Participant1ID
	}
	// If scores are equal, winnerID and loserID remain nil (signifying a draw)

	// Apply properties that are common for any valid score update leading to completion
	match.Status = domain.MatchCompleted
	now := time.Now()
	match.CompletedTime = &now
	match.WinnerID = winnerID // This will be nil if it was a draw
	match.LoserID = loserID   // This will be nil if it was a draw or if participants were nil


	// Perform format-specific validation, e.g., for ties
	// This switch is now primarily for validation or format-specific post-score-update logic,
	// not for initial winner determination based on simple score comparison.
	switch tournament.Format {
	case domain.SingleElimination, domain.DoubleElimination, domain.Swiss:
		// These formats typically do not allow ties if scores are reported.
		// winnerID would be nil if scores are equal.
		if winnerID == nil && (request.ScoreParticipant1 != 0 || request.ScoreParticipant2 != 0 || match.Participant1ID != nil || match.Participant2ID != nil) {
			// If it's still a draw (winnerID is nil), and it wasn't an unplayed match (0-0 with no one set)
			// then it's an invalid tie.
			// Check if participants are set to avoid erroring on a truly unplayed match (0-0 where p1/p2 are nil)
			if match.Participant1ID != nil && match.Participant2ID != nil {
				return fmt.Errorf("matches in %s format cannot end in a tie when scores are reported (%d-%d)",
					tournament.Format, match.ScoreParticipant1, match.ScoreParticipant2)
			}
		}
	case domain.RoundRobin:
		// Ties are allowed. WinnerID will be nil if scores are equal, which is correct.
		// Status already set to completed.
		break // No specific validation against ties needed here.
	}


	// Save the updated match with scores, winner, loser, status, and completed time
	err = s.matchRepo.Update(ctx, match)
	if err != nil {
		return fmt.Errorf("failed to update match %s: %w", match.ID, err)
	}


	// --- Post-Update Logic: Advancement and Tournament Completion ---
	// Only proceed with advancement if there was an actual winner assigned to the match object
	if match.WinnerID != nil {
		// For double elimination tournaments: Move loser
		if tournament.Format == domain.DoubleElimination && match.LoserID != nil && match.LoserNextMatchID != nil {
			loserMatch, errGetLoser := s.matchRepo.GetByID(ctx, *match.LoserNextMatchID)
			if errGetLoser != nil {
				log.Printf("Warning (TID: %s, MID: %s): Failed to get loser's next match %s: %v", tournamentID, matchID, *match.LoserNextMatchID, errGetLoser)
			} else {
				assigned := false
				if loserMatch.Participant1ID == nil {
					loserMatch.Participant1ID = match.LoserID
					assigned = true
				} else if loserMatch.Participant2ID == nil { // Check if second slot is free
					loserMatch.Participant2ID = match.LoserID
					assigned = true
				} else {
					log.Printf("Warning (TID: %s, MID: %s): Loser's next match %s already has both participants assigned.", tournamentID, matchID, loserMatch.ID)
				}

				if assigned { // Only update if we actually placed the participant
					if errUpdateLoser := s.matchRepo.Update(ctx, loserMatch); errUpdateLoser != nil {
						log.Printf("Warning (TID: %s, MID: %s): Failed to update loser's next match %s with participant %s: %v", tournamentID, matchID, loserMatch.ID, *match.LoserID, errUpdateLoser)
					}
				}
			}
		}

		// Advance winner to next match if applicable
		if match.NextMatchID != nil {
			nextMatch, errGetNext := s.matchRepo.GetByID(ctx, *match.NextMatchID)
			if errGetNext != nil {
				// This is generally a more critical error if a next match is defined but not found
				return fmt.Errorf("error getting next match %s for winner of %s (TID: %s): %w", *match.NextMatchID, matchID, tournamentID, errGetNext)
			}
			assigned := false
			if nextMatch.Participant1ID == nil {
				nextMatch.Participant1ID = match.WinnerID
				assigned = true
			} else if nextMatch.Participant2ID == nil { // Check if second slot is free
				nextMatch.Participant2ID = match.WinnerID
				assigned = true
			} else {
				log.Printf("Warning (TID: %s, MID: %s): Winner's next match %s already has both participants assigned.", tournamentID, matchID, nextMatch.ID)
			}

			if assigned { // Only update if we actually placed the participant
				if errUpdateNext := s.matchRepo.Update(ctx, nextMatch); errUpdateNext != nil {
					return fmt.Errorf("error updating next match %s with winner %s from match %s (TID: %s): %w", nextMatch.ID, *match.WinnerID, matchID, tournamentID, errUpdateNext)
				}
			}
		}
	} // End of advancement logic (if match.WinnerID != nil)

	// Check if tournament is complete. This is called for any completed match (win, loss, or draw).
	completed, errCheck := s.checkTournamentCompletion(ctx, tournament.ID)
	if errCheck != nil {
		// Log this as a warning, but the primary score update was successful.
		log.Printf("Warning (TID: %s): Failed to check tournament completion after match %s update: %v", tournamentID, matchID, errCheck)
	} else if completed {
		// Ensure your tournamentRepo has UpdateTournamentStatus and it's correctly defined
		if errStatusUpdate := s.UpdateTournamentStatus(ctx, tournament.ID, domain.Completed); errStatusUpdate != nil {
			log.Printf("Warning (TID: %s): Failed to update tournament status to COMPLETED: %v", tournamentID, errStatusUpdate)
		}
	}

	return nil
}

// checkTournamentCompletion checks if all matches in a tournament are completed
// func (s *tournamentService) checkTournamentCompletion(ctx context.Context, tournamentID uuid.UUID) (bool, error) {
// 	allMatches, err := s.matchRepo.GetByTournamentID(ctx, tournamentID) // s.matchRepo must have this method
// 	if err != nil {
// 		return false, fmt.Errorf("failed to get matches for tournament %s during completion check: %w", tournamentID, err)
// 	}

// 	// If there are no matches at all for the tournament (e.g., bracket not generated), it's not "completed" in terms of play.
// 	if len(allMatches) == 0 {
// 		// This scenario depends on your system's definition of a tournament lifecycle.
// 		// If generating a bracket always creates matches, then 0 matches means not started.
// 		return false, nil
// 	}

// 	for _, m := range allMatches {
// 		if m.Status != domain.MatchCompleted {
// 			return false, nil // Found at least one match that is not yet completed
// 		}
// 	}

// 	return true, nil // All matches found are in 'COMPLETED' status
// }

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
