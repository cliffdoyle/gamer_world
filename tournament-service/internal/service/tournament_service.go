package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/cliffdoyle/tournament-service/internal/domain"
	"github.com/cliffdoyle/tournament-service/internal/repository"
	"github.com/google/uuid"
)

// TournamentService defines methods for tournament business logic
type TournamentService interface {
	CreateTournament(ctx context.Context, request *domain.CreateTournamentRequest, creatorID uuid.UUID) (*domain.Tournament, error)
	GetTournament(ctx context.Context, id uuid.UUID) (*domain.TournamentResponse, error)
	ListTournaments(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*domain.TournamentResponse, int, error)
	UpdateTournament(ctx context.Context, id uuid.UUID, request *domain.UpdateTournamentRequest) (*domain.Tournament, error)
	DeleteTournament(ctx context.Context, id uuid.UUID) error
	UpdateTournamentStatus(ctx context.Context, id uuid.UUID, status domain.TournamentStatus) error

	// Participant operations
	RegisterParticipant(ctx context.Context, tournamentID uuid.UUID, request *domain.ParticipantRequest) (*domain.Participant, error)
	UnregisterParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error
	GetParticipants(ctx context.Context, tournamentID uuid.UUID) ([]*domain.ParticipantResponse, error)
	CheckInParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error
	UpdateParticipantSeed(ctx context.Context, tournamentID uuid.UUID, participantID uuid.UUID, seed int) error

	// Bracket operations
	GenerateBracket(ctx context.Context, tournamentID uuid.UUID) error
	GetMatches(ctx context.Context, tournamentID uuid.UUID) ([]*domain.MatchResponse, error)
	GetMatchesByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.MatchResponse, error)
	GetMatchesByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.MatchResponse, error)
	UpdateMatchScore(ctx context.Context, matchID uuid.UUID, userID uuid.UUID, request *domain.ScoreUpdateRequest) error

	// Chat operations
	SendMessage(ctx context.Context, tournamentID uuid.UUID, userID uuid.UUID, request *domain.MessageRequest) (*domain.Message, error)
	GetMessages(ctx context.Context, tournamentID uuid.UUID, limit, offset int) ([]*domain.MessageResponse, error)
}

// tournamentService implements TournamentService
type tournamentService struct {
	tournamentRepo  repository.TournamentRepository
	participantRepo repository.ParticipantRepository
	matchRepo       repository.MatchRepository
	messageRepo     repository.MessageRepository
	bracketGen      BracketGenerator
}

// NewTournamentService creates a new tournament service
func NewTournamentService(
	tournamentRepo repository.TournamentRepository,
	participantRepo repository.ParticipantRepository,
	matchRepo repository.MatchRepository,
	messageRepo repository.MessageRepository,
	bracketGen BracketGenerator,
) TournamentService {
	return &tournamentService{
		tournamentRepo:  tournamentRepo,
		participantRepo: participantRepo,
		matchRepo:       matchRepo,
		messageRepo:     messageRepo,
		bracketGen:      bracketGen,
	}
}

// CreateTournament creates a new tournament
func (s *tournamentService) CreateTournament(ctx context.Context, request *domain.CreateTournamentRequest, creatorID uuid.UUID) (*domain.Tournament, error) {
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
func (s *tournamentService) ListTournaments(ctx context.Context, filters map[string]interface{}, page, pageSize int) ([]*domain.TournamentResponse, int, error) {
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
func (s *tournamentService) UpdateTournament(ctx context.Context, id uuid.UUID, request *domain.UpdateTournamentRequest) (*domain.Tournament, error) {
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
func (s *tournamentService) UpdateTournamentStatus(ctx context.Context, id uuid.UUID, status domain.TournamentStatus) error {
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
		if tournament.RegistrationDeadline != nil && time.Now().After(*tournament.RegistrationDeadline) {
			return errors.New("cannot start registration after deadline has passed")
		}
	case domain.InProgress:
		if tournament.StartTime != nil && time.Now().Before(*tournament.StartTime) {
			return errors.New("cannot start tournament before scheduled start time")
		}
		// Check if minimum participants are registered
		count, err := s.tournamentRepo.GetParticipantCount(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get participant count: %w", err)
		}
		if count < 2 {
			return errors.New("cannot start tournament with less than 2 participants")
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
	validTransitions := map[domain.TournamentStatus][]domain.TournamentStatus{
		domain.Draft: {
			domain.Registration,
			domain.Cancelled,
		},
		domain.Registration: {
			domain.InProgress,
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

// RegisterParticipant registers a user for a tournament
func (s *tournamentService) RegisterParticipant(ctx context.Context, tournamentID uuid.UUID, request *domain.ParticipantRequest) (*domain.Participant, error) {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}

	// Validate tournament status
	if tournament.Status != domain.Registration {
		return nil, errors.New("tournament is not open for registration")
	}

	// Check registration deadline
	if tournament.RegistrationDeadline != nil && time.Now().After(*tournament.RegistrationDeadline) {
		return nil, errors.New("registration deadline has passed")
	}

	// Check if user is already registered
	existingParticipant, err := s.participantRepo.GetByTournamentAndUser(ctx, tournamentID, request.UserID)
	if err == nil && existingParticipant != nil {
		return nil, errors.New("user is already registered for this tournament")
	}

	// Get current participant count
	count, err := s.tournamentRepo.GetParticipantCount(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participant count: %w", err)
	}

	// Create participant
	participant := &domain.Participant{
		ID:           uuid.New(),
		TournamentID: tournamentID,
		UserID:       request.UserID,
		Seed:         request.Seed,
		Status:       domain.ParticipantRegistered,
		IsWaitlisted: false,
		CreatedAt:    time.Now(),
	}

	// Check if tournament is full
	if count >= tournament.MaxParticipants {
		// Add to waitlist
		participant.IsWaitlisted = true
		participant.Status = domain.ParticipantWaitlisted
	}

	// Save participant
	err = s.participantRepo.Create(ctx, participant)
	if err != nil {
		return nil, fmt.Errorf("failed to create participant: %w", err)
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
func (s *tournamentService) GetParticipants(ctx context.Context, tournamentID uuid.UUID) ([]*domain.ParticipantResponse, error) {
	// Get participants
	participants, err := s.participantRepo.ListByTournament(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}

	// Map to response
	responses := make([]*domain.ParticipantResponse, len(participants))
	for i, participant := range participants {
		responses[i] = &domain.ParticipantResponse{
			ID:           participant.ID,
			TournamentID: participant.TournamentID,
			UserID:       participant.UserID,
			Seed:         participant.Seed,
			Status:       participant.Status,
			IsWaitlisted: participant.IsWaitlisted,
			CreatedAt:    participant.CreatedAt,
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
func (s *tournamentService) UpdateParticipantSeed(ctx context.Context, tournamentID uuid.UUID, participantID uuid.UUID, seed int) error {
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

// GenerateBracket creates matches for a tournament
func (s *tournamentService) GenerateBracket(ctx context.Context, tournamentID uuid.UUID) error {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}
	// Check tournament status
	if tournament.Status != domain.Draft && tournament.Status != domain.Registration {
		return errors.New("cannot generate bracket after tournament has started")
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

	// Sort participants by seed
	// In real implementation, sort by a specific algorithm based on seeds

	// Delete existing matches if any
	err = s.matchRepo.Delete(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to clear existing matches: %w", err)
	}

	// Generate matches based on format
	var matches []*domain.Match

	switch tournament.Format {
	case domain.SingleElimination:
		matches, err = s.bracketGen.GenerateSingleElimination(ctx, tournamentID, participants)
	case domain.DoubleElimination:
		matches, err = s.bracketGen.GenerateDoubleElimination(ctx, tournamentID, participants)
	case domain.RoundRobin:
		matches, err = s.bracketGen.GenerateRoundRobin(ctx, tournamentID, participants)
	case domain.Swiss:
		// Default to log2(n) rounds for Swiss
		rounds := int(math.Ceil(math.Log2(float64(len(participants)))))
		matches, err = s.bracketGen.GenerateSwiss(ctx, tournamentID, participants, rounds)
	default:
		return fmt.Errorf("unsupported tournament format: %s", tournament.Format)
	}

	if err != nil {
		return fmt.Errorf("failed to generate bracket: %w", err)
	}

	// Save matches to database
	for _, match := range matches {
		err = s.matchRepo.Create(ctx, match)
		if err != nil {
			return fmt.Errorf("failed to save match: %w", err)
		}
	}

	return nil
}

// GetMatches retrieves all matches for a tournament
func (s *tournamentService) GetMatches(ctx context.Context, tournamentID uuid.UUID) ([]*domain.MatchResponse, error) {
	// Get matches
	matches, err := s.matchRepo.ListByTournament(ctx, tournamentID)
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
			CreatedAt:         match.CreatedAt,
			MatchNotes:        match.MatchNotes,
			MatchProofs:       match.MatchProofs,
		}
	}

	return responses, nil
}

// GetMatchesByRound retrieves matches for a specific round
func (s *tournamentService) GetMatchesByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.MatchResponse, error) {
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
			CreatedAt:         match.CreatedAt,
			MatchNotes:        match.MatchNotes,
			MatchProofs:       match.MatchProofs,
		}
	}

	return responses, nil
}

// GetMatchesByParticipant retrieves matches for a specific participant
func (s *tournamentService) GetMatchesByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.MatchResponse, error) {
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
			CreatedAt:         match.CreatedAt,
			MatchNotes:        match.MatchNotes,
			MatchProofs:       match.MatchProofs,
		}
	}

	return responses, nil
}

// UpdateMatchScore updates the score of a match and advances winners if needed
func (s *tournamentService) UpdateMatchScore(ctx context.Context, matchID uuid.UUID, userID uuid.UUID, request *domain.ScoreUpdateRequest) error {
	// Get match
	match, err := s.matchRepo.GetByID(ctx, matchID)
	if err != nil {
		return fmt.Errorf("failed to get match: %w", err)
	}

	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, match.TournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}

	// Validate tournament status
	if tournament.Status != domain.InProgress {
		return errors.New("tournament is not in progress")
	}

	// Validate user is a participant
	if match.Participant1ID != nil && *match.Participant1ID != userID &&
		match.Participant2ID != nil && *match.Participant2ID != userID {
		return errors.New("user is not a participant in this match")
	}

	// Update scores
	match.ScoreParticipant1 = request.ScoreParticipant1
	match.ScoreParticipant2 = request.ScoreParticipant2
	match.MatchNotes = request.MatchNotes
	match.MatchProofs = request.MatchProofs

	// Determine winner based on tournament format
	var winnerID, loserID *uuid.UUID
	switch tournament.Format {
	case domain.SingleElimination, domain.DoubleElimination:
		// Higher score wins
		if match.ScoreParticipant1 > match.ScoreParticipant2 {
			winnerID = match.Participant1ID
			loserID = match.Participant2ID
		} else if match.ScoreParticipant2 > match.ScoreParticipant1 {
			winnerID = match.Participant2ID
			loserID = match.Participant1ID
		}
	case domain.RoundRobin:
		// No winner determination needed for round robin
		match.Status = domain.MatchCompleted
	case domain.Swiss:
		// Higher score wins
		if match.ScoreParticipant1 > match.ScoreParticipant2 {
			winnerID = match.Participant1ID
			loserID = match.Participant2ID
		} else if match.ScoreParticipant2 > match.ScoreParticipant1 {
			winnerID = match.Participant2ID
			loserID = match.Participant1ID
		}
	}

	// If we have a winner, update match status and advance
	if winnerID != nil {
		match.WinnerID = winnerID
		match.LoserID = loserID
		match.Status = domain.MatchCompleted
		match.CompletedTime = &time.Time{}
		*match.CompletedTime = time.Now()

		// Update match
		err = s.matchRepo.Update(ctx, match)
		if err != nil {
			return fmt.Errorf("failed to update match: %w", err)
		}

		// Advance winner to next match if applicable
		if match.NextMatchID != nil {
			nextMatch, err := s.matchRepo.GetByID(ctx, *match.NextMatchID)
			if err != nil {
				return fmt.Errorf("failed to get next match: %w", err)
			}

			// Determine which slot to put the winner in
			if nextMatch.Participant1ID == nil {
				nextMatch.Participant1ID = winnerID
			} else {
				nextMatch.Participant2ID = winnerID
			}

			// Update next match
			err = s.matchRepo.Update(ctx, nextMatch)
			if err != nil {
				return fmt.Errorf("failed to update next match: %w", err)
			}
		}

		// Check if tournament is complete
		completed, err := s.checkTournamentCompletion(ctx, tournament.ID)
		if err != nil {
			return fmt.Errorf("failed to check tournament completion: %w", err)
		}
		if completed {
			err = s.UpdateTournamentStatus(ctx, tournament.ID, domain.Completed)
			if err != nil {
				return fmt.Errorf("failed to update tournament status: %w", err)
			}
		}
	} else {
		// No winner yet, just update the match
		err = s.matchRepo.Update(ctx, match)
		if err != nil {
			return fmt.Errorf("failed to update match: %w", err)
		}
	}

	return nil
}

// checkTournamentCompletion checks if all matches are completed
func (s *tournamentService) checkTournamentCompletion(ctx context.Context, tournamentID uuid.UUID) (bool, error) {
	matches, err := s.matchRepo.ListByTournament(ctx, tournamentID)
	if err != nil {
		return false, fmt.Errorf("failed to get matches: %w", err)
	}

	if len(matches) == 0 {
		return false, nil
	}

	for _, match := range matches {
		if match.Status != domain.MatchCompleted {
			return false, nil
		}
	}

	return true, nil
}

// SendMessage sends a message to the tournament chat
func (s *tournamentService) SendMessage(ctx context.Context, tournamentID uuid.UUID, userID uuid.UUID, request *domain.MessageRequest) (*domain.Message, error) {
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
func (s *tournamentService) GetMessages(ctx context.Context, tournamentID uuid.UUID, limit, offset int) ([]*domain.MessageResponse, error) {
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
