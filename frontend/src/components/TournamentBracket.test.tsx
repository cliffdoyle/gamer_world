import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TournamentBracket from './TournamentBracket';

const mockMatches = [
  {
    id: '1',
    tournamentId: 'tournament1',
    round: 1,
    participant1Id: 'p1',
    participant2Id: 'p2',
    winnerId: 'p1',
    status: 'completed',
    score: {
      participant1: 2,
      participant2: 1
    },
    createdAt: '2024-03-15T12:00:00Z'
  },
  {
    id: '2',
    tournamentId: 'tournament1',
    round: 1,
    participant1Id: 'p3',
    participant2Id: 'p4',
    status: 'in_progress',
    createdAt: '2024-03-15T12:00:00Z'
  }
];

const mockParticipants = [
  { id: 'p1', userId: 'user1', status: 'active' },
  { id: 'p2', userId: 'user2', status: 'active' },
  { id: 'p3', userId: 'user3', status: 'active' },
  { id: 'p4', userId: 'user4', status: 'active' }
];

describe('TournamentBracket', () => {
  it('renders loading state', () => {
    render(
      <TournamentBracket
        matches={[]}
        participants={[]}
        isLoading={true}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading tournament bracket...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const errorMessage = 'Failed to load tournament';
    render(
      <TournamentBracket
        matches={[]}
        participants={[]}
        error={errorMessage}
      />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('renders matches correctly', () => {
    render(
      <TournamentBracket
        matches={mockMatches}
        participants={mockParticipants}
      />
    );
    
    expect(screen.getByText('user1')).toBeInTheDocument();
    expect(screen.getByText('user2')).toBeInTheDocument();
    expect(screen.getByText('user3')).toBeInTheDocument();
    expect(screen.getByText('user4')).toBeInTheDocument();
  });

  it('shows match details on hover', () => {
    render(
      <TournamentBracket
        matches={mockMatches}
        participants={mockParticipants}
      />
    );

    const match = screen.getAllByRole('button')[0];
    fireEvent.mouseEnter(match);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
  });

  it('calls onMatchClick when match is clicked', () => {
    const handleMatchClick = jest.fn();
    render(
      <TournamentBracket
        matches={mockMatches}
        participants={mockParticipants}
        onMatchClick={handleMatchClick}
      />
    );

    const match = screen.getAllByRole('button')[0];
    fireEvent.click(match);
    
    expect(handleMatchClick).toHaveBeenCalledWith(mockMatches[0]);
  });

  it('displays correct round labels', () => {
    render(
      <TournamentBracket
        matches={mockMatches}
        participants={mockParticipants}
      />
    );
    
    expect(screen.getByText('Round 1')).toBeInTheDocument();
  });

  it('validates and displays scores correctly', () => {
    render(
      <TournamentBracket
        matches={mockMatches}
        participants={mockParticipants}
      />
    );
    
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    const handleMatchClick = jest.fn();
    render(
      <TournamentBracket
        matches={mockMatches}
        participants={mockParticipants}
        onMatchClick={handleMatchClick}
      />
    );

    const match = screen.getAllByRole('button')[0];
    fireEvent.keyPress(match, { key: 'Enter', code: 'Enter' });
    
    expect(handleMatchClick).toHaveBeenCalledWith(mockMatches[0]);
  });
}); 