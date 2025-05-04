import React, { useEffect, useRef } from 'react';
import Match from './Match';
import { Match as MatchType, Participant } from '@/types/tournament';

interface DoubleEliminationBracketProps {
  matches: MatchType[];
  participants: Participant[];
  onMatchClick?: (match: MatchType) => void;
}

const DoubleEliminationBracket: React.FC<DoubleEliminationBracketProps> = ({ 
  matches, 
  participants, 
  onMatchClick 
}) => {
  const bracketRef = useRef<HTMLDivElement>(null);

  // Group matches by bracket type and round
  const winnersBracket = matches.filter(m => m.match_notes?.includes('WINNERS') || (!m.match_notes?.includes('LOSERS') && !m.match_notes?.includes('GRAND_FINALS')));
  const losersBracket = matches.filter(m => m.match_notes?.includes('LOSERS'));
  const grandFinals = matches.filter(m => m.match_notes?.includes('GRAND_FINALS'));

  // Get participant objects by ID for displaying names
  const participantsById = participants.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, Participant>);

  // Prepare matches with participant info
  const preparedMatches = matches.map(match => ({
    ...match,
    participant1: match.participant1_id ? participantsById[match.participant1_id] : null,
    participant2: match.participant2_id ? participantsById[match.participant2_id] : null
  }));

  // Get matches by round for winners bracket
  const winnerMatchesByRound = winnersBracket.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, MatchType[]>);

  // Get matches by round for losers bracket
  const loserMatchesByRound = losersBracket.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, MatchType[]>);
  
  // Get max round numbers
  const maxWinnerRound = Math.max(...winnersBracket.map(m => m.round), 0);
  const maxLoserRound = Math.max(...losersBracket.map(m => m.round), 0);

  // Draw connections between matches
  useEffect(() => {
    if (!bracketRef.current) return;

    const drawConnections = () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      
      // Remove any existing SVG
      const existingSvg = bracketRef.current?.querySelector('svg');
      if (existingSvg) {
        existingSvg.remove();
      }

      matches.forEach(match => {
        if (match.next_match_id || match.loser_next_match_id) {
          const currentMatch = document.querySelector(`[data-match-id="${match.id}"]`);
          const nextMatch = match.next_match_id ? 
            document.querySelector(`[data-match-id="${match.next_match_id}"]`) :
            document.querySelector(`[data-match-id="${match.loser_next_match_id}"]`);

          if (currentMatch && nextMatch) {
            const currentRect = currentMatch.getBoundingClientRect();
            const nextRect = nextMatch.getBoundingClientRect();
            const bracketRect = bracketRef.current!.getBoundingClientRect();

            const startX = currentRect.right - bracketRect.left;
            const startY = currentRect.top + (currentRect.height / 2) - bracketRect.top;
            const endX = nextRect.left - bracketRect.left;
            const endY = nextRect.top + (nextRect.height / 2) - bracketRect.top;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const controlX = startX + (endX - startX) * 0.5;
            
            path.setAttribute('d', `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`);
            path.setAttribute('stroke', match.loser_next_match_id ? '#ff4444' : '#666');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-width', '2');

            svg.appendChild(path);
          }
        }
      });

      bracketRef.current?.appendChild(svg);
    };

    // Draw initial connections
    drawConnections();

    // Redraw on window resize
    window.addEventListener('resize', drawConnections);
    return () => window.removeEventListener('resize', drawConnections);
  }, [matches]);

  return (
    <div className="double-elimination-bracket" ref={bracketRef}>
      <style jsx>{`
        .double-elimination-bracket {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          background: #1a1a1a;
          color: #fff;
        }

        .bracket-title {
          color: #fff;
          font-size: 1.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #333;
        }

        .bracket-rounds {
          display: flex;
          gap: 2rem;
        }

        .round {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 250px;
        }

        .round-title {
          color: #888;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .matches {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .match-wrapper {
          position: relative;
        }

        :global(.match-container) {
          background: #2a2a2a;
          border-radius: 4px;
          padding: 0.5rem;
        }

        :global(.match) {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        :global(.participant) {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          background: #333;
          border-radius: 2px;
        }

        :global(.participant.winner) {
          background: #2c5282;
        }

        :global(.seed) {
          width: 24px;
          text-align: center;
          margin-right: 0.5rem;
          color: #666;
        }

        :global(.name) {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        :global(.score) {
          width: 32px;
          text-align: right;
          margin-left: 0.5rem;
        }

        :global(.match-info) {
          display: flex;
          justify-content: center;
          margin-top: 0.25rem;
          font-size: 0.8rem;
          color: #666;
        }
      `}</style>

      <div className="winners-bracket">
        <h2 className="bracket-title">Winners Bracket</h2>
        <div className="bracket-rounds">
          {Array.from({ length: maxWinnerRound }, (_, i) => i + 1).map(round => (
            <div key={`w-${round}`} className="round">
              <h3 className="round-title">
                {round === maxWinnerRound ? 'Winners Finals' : 
                 round === maxWinnerRound - 1 ? 'Winners Semifinals' : `Round ${round}`}
              </h3>
              <div className="matches">
                {winnerMatchesByRound[round]?.sort((a, b) => a.match_number - b.match_number).map(match => {
                  const preparedMatch = preparedMatches.find(m => m.id === match.id);
                  return (
                    <div className="match-wrapper" key={match.id}>
                      <Match match={preparedMatch!} onClick={onMatchClick} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {losersBracket.length > 0 && (
        <div className="losers-bracket">
          <h2 className="bracket-title">Losers Bracket</h2>
          <div className="bracket-rounds">
            {Array.from({ length: maxLoserRound }, (_, i) => i + 1).map(round => (
              <div key={`l-${round}`} className="round">
                <h3 className="round-title">
                  {round === maxLoserRound ? 'Losers Finals' : `Round ${round}`}
                </h3>
                <div className="matches">
                  {loserMatchesByRound[round]?.sort((a, b) => a.match_number - b.match_number).map(match => {
                    const preparedMatch = preparedMatches.find(m => m.id === match.id);
                    return (
                      <div className="match-wrapper" key={match.id}>
                        <Match match={preparedMatch!} onClick={onMatchClick} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {grandFinals.length > 0 && (
        <div className="grand-finals">
          <h2 className="bracket-title">Grand Finals</h2>
          <div className="bracket-rounds">
            <div className="matches">
              {grandFinals.sort((a, b) => a.round - b.round).map(match => {
                const preparedMatch = preparedMatches.find(m => m.id === match.id);
                return (
                  <div className="match-wrapper" key={match.id}>
                    <Match match={preparedMatch!} onClick={onMatchClick} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoubleEliminationBracket; 