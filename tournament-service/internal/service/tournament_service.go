package service

import (
	"context"
	"errors"
	"fmt"
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
		ID:                  uuid.New(),
		Name:                request.Name,
		Description:         request.Description,
		Game:                request.Game,
		Format:              request.Format,
		Status:              domain.Draft,
		MaxParticipants:     request.MaxParticipants,
		RegistrationDeadline: request.RegistrationDeadline,
		StartTime:           request.StartTime,
		CreatedBy:           creatorID,
		Rules:               request.Rules,
		PrizePool:           request.PrizePool,
		CustomFields:        request.CustomFields,
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
		ID:                  tournament.ID,
		Name:                tournament.Name,
		Description:         tournament.Description,
		Game:                tournament.Game,
		Format:              tournament.Format,
		Status:              tournament.Status,
		MaxParticipants:     tournament.MaxParticipants,
		CurrentParticipants: participantCount,
		RegistrationDeadline: tournament.RegistrationDeadline,
		StartTime:           tournament.StartTime,
		EndTime:             tournament.EndTime,
		CreatedAt:           tournament.CreatedAt,
		Rules:               tournament.Rules,
		PrizePool:           tournament.PrizePool,
		CustomFields:        tournament.CustomFields,
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
			ID:                  tournament.ID,
			Name:                tournament.Name,
			Description:         tournament.Description,
			Game:                tournament.Game,
			Format:              tournament.Format,
			Status:              tournament.Status,
			MaxParticipants:     tournament.MaxParticipants,
			CurrentParticipants: participantCount,
			RegistrationDeadline: tournament.RegistrationDeadline,
			StartTime:           tournament.StartTime,
			EndTime:             tournament.EndTime,
			CreatedAt:           tournament.CreatedAt,
			Rules:               tournament.Rules,
			PrizePool:           tournament.PrizePool,
			CustomFields:        tournament.CustomFields,
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
	
	// Perform additional validation based on status
	switch status {
	case domain.Registration:
		// Nothing special needed
	case domain.InProgress:
		// Check if bracket has been generated
		matches, err := s.matchRepo.ListByTournament(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to check matches: %w", err)
		}
		if len(matches) == 0 {
			return errors.New("cannot start tournament without generating brackets")
		}
		
		// Set start time if not set
		if tournament.StartTime == nil {
			now := time.Now()
			tournament.StartTime = &now
			err = s.tournamentRepo.Update(ctx, tournament)
			if err != nil {
				return fmt.Errorf("failed to update tournament start time: %w", err)
			}
		}
	case domain.Completed:
		// Set end time
		now := time.Now()
		tournament.EndTime = &now
		err = s.tournamentRepo.Update(ctx, tournament)
		if err != nil {
			return fmt.Errorf("failed to update tournament end time: %w", err)
		}
	}
	
	// Update status
	err = s.tournamentRepo.UpdateStatus(ctx, id, status)
	if err != nil {
		return fmt.Errorf("failed to update tournament status: %w", err)
	}
	
	return nil
}

// RegisterParticipant registers a user for a tournament
func (s *tournamentService) RegisterParticipant(ctx context.Context, tournamentID uuid.UUID, request *domain.ParticipantRequest) (*domain.Participant, error) {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get tournament: %w", err)
	}
	
	// Check tournament status
	if tournament.Status != domain.Draft && tournament.Status != domain.Registration {
		return nil, errors.New("tournament is not open for registration")
	}
	
	// Check registration deadline
	if tournament.RegistrationDeadline != nil && time.Now().After(*tournament.RegistrationDeadline) {
		return nil, errors.New("registration deadline has passed")
	}
	
	// Check if tournament is full
	if tournament.MaxParticipants > 0 {
		count, err := s.tournamentRepo.GetParticipantCount(ctx, tournamentID)
		if err != nil {
			return nil, fmt.Errorf("failed to get participant count: %w", err)
		}
		if count >= tournament.MaxParticipants {
			return nil, errors.New("tournament is full")
		}
	}
	
	// Check if user is already registered
	_, err = s.participantRepo.GetByTournamentAndUser(ctx, tournamentID, request.UserID)
	if err == nil {
		return nil, errors.New("user is already registered for this tournament")
	}
	
	// Create participant
	participant := &domain.Participant{
		ID:          uuid.New(),
		TournamentID: tournamentID,
		UserID:      request.UserID,
		TeamName:    request.TeamName,
		IsCheckedIn: false,
	}
	
	// Save to database
	err = s.participantRepo.Create(ctx, participant)
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
func (s *tournamentService) GetParticipants(ctx context.Context, tournamentID uuid.UUID) ([]*domain.ParticipantResponse, error) {
	// Get participants
	participants, err := s.participantRepo.ListByTournament(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get participants: %w", err)
	}
	
	// Map to response
	responses := make([]*domain.ParticipantResponse, len(participants))
	for i, participant := range participants {
		// In a real implementation, you would fetch username from a user service
		// For now, we'll use "User-" + userId
		username := fmt.Sprintf("User-%s", participant.UserID.String()[:8])
		
		responses[i] = &domain.ParticipantResponse{
			ID:         participant.ID,
			UserID:     participant.UserID,
			Username:   username,
			TeamName:   participant.TeamName,
			IsCheckedIn: participant.IsCheckedIn,
			Seed:       participant.Seed,
		}
	}
	
	return responses, nil
}

// CheckInParticipant marks a participant as checked in
func (s *tournamentService) CheckInParticipant(ctx context.Context, tournamentID, userID uuid.UUID) error {
	// Get tournament
	tournament, err := s.tournamentRepo.GetByID(ctx, tournamentID)
	if err != nil {
		return fmt.Errorf("failed to get tournament: %w", err)
	}
	
	// Check tournament status
	if tournament.Status != domain.Registration {
		return errors.New("check-in is only available during registration period")
	}
	
	// Get participant
	participant, err := s.participantRepo.GetByTournamentAndUser(ctx, tournamentID, userID)
	if err != nil {
		return fmt.Errorf("failed to get participant: %w", err)
	}
	
	// Mark as checked in
	err = s.participantRepo.CheckIn(ctx, participant.ID)
	if err != nil {
		return fmt.Errorf("failed to check in participant: %w", err)
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
	err = s.matchRepo.DeleteByTournament(ctx, tournamentID)
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
		participant1Name := ""
		participant2Name := ""
		
		// Get participant names
		if match.Participant1ID != nil {
			p1, err := s.participantRepo.GetByID(ctx, *match.Participant1ID)
			if err == nil {
				participant1Name = p1.TeamName
			}
		}
		
		if match.Participant2ID != nil {
			p2, err := s.participantRepo.GetByID(ctx, *match.Participant2ID)
			if err == nil {
				participant2Name = p2.TeamName
			}
		}
		
		responses[i] = &domain.MatchResponse{
			ID:              match.ID,
			Round:           match.Round,
			MatchNumber:     match.MatchNumber,
			Participant1ID:  match.Participant1ID,
			Participant1Name: participant1Name,
			Participant2ID:  match.Participant2ID,
			Participant2Name: participant2Name,
			Score1:          match.Score1,
			Score2:          match.Score2,
			Status:          match.Status,
			StartTime:       match.StartTime,
			EndTime:         match.EndTime,
		}
	}
	
	return responses, nil
}

// GetMatchesByRound retrieves matches for a specific round
func (s *tournamentService) GetMatchesByRound(ctx context.Context, tournamentID uuid.UUID, round int) ([]*domain.MatchResponse, error) {
	// Get matches
	matches, err := s.matchRepo.ListByTournamentAndRound(ctx, tournamentID, round)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	
	// Map to response
	responses := make([]*domain.MatchResponse, len(matches))
	for i, match := range matches {
		participant1Name := ""
		participant2Name := ""
		
		// Get participant names
		if match.Participant1ID != nil {
			p1, err := s.participantRepo.GetByID(ctx, *match.Participant1ID)
			if err == nil {
				participant1Name = p1.TeamName
			}
		}
		
		if match.Participant2ID != nil {
			p2, err := s.participantRepo.GetByID(ctx, *match.Participant2ID)
			if err == nil {
				participant2Name = p2.TeamName
			}
		}
		
		responses[i] = &domain.MatchResponse{
			ID:              match.ID,
			Round:           match.Round,
			MatchNumber:     match.MatchNumber,
			Participant1ID:  match.Participant1ID,
			Participant1Name: participant1Name,
			Participant2ID:  match.Participant2ID,
			Participant2Name: participant2Name,
			Score1:          match.Score1,
			Score2:          match.Score2,
			Status:          match.Status,
			StartTime:       match.StartTime,
			EndTime:         match.EndTime,
		}
	}
	
	return responses, nil
}

// GetMatchesByParticipant retrieves matches for a specific participant
func (s *tournamentService) GetMatchesByParticipant(ctx context.Context, tournamentID, participantID uuid.UUID) ([]*domain.MatchResponse, error) {
	// Get matches
	matches, err := s.matchRepo.ListByTournamentAndParticipant(ctx, tournamentID, participantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get matches: %w", err)
	}
	
	// Map to response
	responses := make([]*domain.MatchResponse, len(matches))
	for i, match := range matches {
		participant1Name := ""
		participant2Name := ""
		
		// Get participant names
		if match.Participant1ID != nil {
			p1, err := s.participantRepo.GetByID(ctx, *match.Participant1ID)
			if err == nil {
				participant1Name = p1.TeamName
			}
		}
		
		if match.Participant2ID != nil {
			p2, err := s.participantRepo.GetByID(ctx, *match.Participant2ID)
			if err == nil {
				participant2Name = p2.TeamName
			}
		}
		
		responses[i] = &domain.MatchResponse{
			ID:              match.ID,
			Round:           match.Round,
			MatchNumber:     match.MatchNumber,
			Participant1ID:  match.Participant1ID,
			Participant1Name: participant1Name,
			Participant2ID:  match.Participant2ID,
			Participant2Name: participant2Name,
			Score1:          match.Score1,
			Score2:          match.Score2,
			Status:          match.Status,
			StartTime:       match.StartTime,
			EndTime:         match.EndTime,
		}
	}
	
	return responses, nil
}

// UpdateMatchScore updates the score of a match and advances winners if needed
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
	
	// Check tournament status
	if tournament.Status != domain.InProgress {
		return errors.New("cannot update scores when tournament is not in progress")
	}
	
	// Check if user is an admin or participant
	isAdmin := false // In real implementation, check if user is admin
	isParticipant := false
	
	if match.Participant1ID != nil && *match.Participant1ID == userID {
		isParticipant = true
	}
	if match.Participant2ID != nil && *match.Participant2ID == userID {
		isParticipant = true
	}
	
	if !isAdmin && !isParticipant {
		return errors.New("user is not authorized to update match scores")
	}
	
	// Validate scores
	if request.ScoreParticipant1 < 0 || request.ScoreParticipant2 < 0 {
		return errors.New("scores cannot be negative")
	}
	
	// Update match
	match.ScoreParticipant1 = request.ScoreParticipant1
	match.ScoreParticipant2 = request.ScoreParticipant2
	
	// Determine winner
	var winnerID *uuid.UUID
	var loserID *uuid.UUID
	
	if request.ScoreParticipant1 > request.ScoreParticipant2 {
		winnerID = match.Participant1ID
		loserID = match.Participant2ID
	} else if request.ScoreParticipant2 > request.ScoreParticipant1 {
		winnerID = match.Participant2ID
		loserID = match.Participant1ID
	}
	
	// Update match status
	if winnerID != nil {
		match.Status = domain.MatchCompleted
		match.WinnerID = winnerID
		match.LoserID = loserID
		
		// Set end time
		now := time.Now()
		match.CompletedTime = &now
		
		// Advance winner to next match if exists
		if match.NextMatchID != nil {
			nextMatch, err := s.matchRepo.GetByID(ctx, *match.NextMatchID)
			if err != nil {
				return fmt.Errorf("failed to get next match: %w", err)
			}
			
			// Assign winner to appropriate spot in next match
			if nextMatch.Participant1ID == nil {
				nextMatch.Participant1ID = winnerID
			} else {
				nextMatch.Participant2ID = winnerID
			}
			
			// Update next match
			err = s.matchRepo.(ctx, nextMatch)
			if err != nil {
				return fmt.Errorf("failed to update next match: %w", err)
			}
		}
		
		// Handle loser bracket advancement for double elimination
		if tournament.Format == domain.DoubleElimination && loserID != nil {
			// In real implementation, handle loser bracket logic
		}
	} else {
		// Tie, wait for admin resolution or additional rules
		match.Status = domain.MatchPending
	}
	
	// Save match
	err = s.matchRepo.Update(ctx, match)
	if err != nil {
		return fmt.Errorf("failed to update match: %w", err)
	}
	
	// Check if tournament is complete
	complete, err := s.checkTournamentCompletion(ctx, tournament.ID)
	if err != nil {
		return fmt.Errorf("failed to check tournament completion: %w", err)
	}
	
	if complete {
		err = s.UpdateTournamentStatus(ctx, tournament.ID, domain.Completed)
		if err != nil {
			return fmt.Errorf("failed to update tournament status: %w", err)
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
		ID:          uuid.New(),
		TournamentID: tournamentID,
		UserID:      userID,
		Content:     request.Content,
		CreatedAt:   time.Now(),
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

// isValidStatusTransition checks if a status transition is valid
func isValidStatusTransition(from, to domain.TournamentStatus) bool {
	switch from {
	case domain.Draft:
		return to == domain.Registration
	case domain.Registration:
		return to == domain.InProgress || to == domain.Cancelled
	case domain.InProgress:
		return to == domain.Completed || to == domain.Cancelled
	case domain.Completed:
		return to == domain.Archived
	case domain.Cancelled:
		return to == domain.Archived
	case domain.Archived:
		return false
	default:
		return false
	}
}