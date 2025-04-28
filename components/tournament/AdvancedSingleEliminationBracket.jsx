import React, { useRef, useEffect, useState } from 'react';
import Match from './Match';
import BracketLine from './BracketLine';

const AdvancedSingleEliminationBracket = ({ matches, participants, onMatchClick }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ matches: {}, container: null });
  
  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});
  
  // Get participant objects by ID
  const participantsById = participants.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});
  
  // Prepare matches with participant info
  const preparedMatches = matches.map(match => ({
    ...match,
    participant1: match.participant1ID ? participantsById[match.participant1ID] : null,
    participant2: match.participant2ID ? participantsById[match.participant2ID] : null
  }));
  
  // Get max round number
  const maxRound = Math.max(...matches.map(m => m.round));
  
  // Calculate match positions after render
  useEffect(() => {
    if (containerRef.current) {
      const matchElements = containerRef.current.querySelectorAll('.match-container');
      const matchPositions = {};
      
      // Get positions of all matches
      matchElements.forEach(element => {
        const matchId = element.dataset.matchId;
        const rect = element.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        matchPositions[matchId] = {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          right: rect.right - containerRect.left,
          bottom: rect.bottom - containerRect.top,
          width: rect.width,
          height: rect.height,
          center: {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
          }
        };
      });
      
      setDimensions({
        matches: matchPositions,
        container: {
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        }
      });
    }
  }, [matches, preparedMatches]);
  
  // Create connection lines between matches
  const renderConnectorLines = () => {
    if (!dimensions.container) return null;
    
    const lines = [];
    
    matches.forEach(match => {
      if (match.nextMatchID) {
        const currentMatchDim = dimensions.matches[match.id];
        const nextMatchDim = dimensions.matches[match.nextMatchID];
        
        if (currentMatchDim && nextMatchDim) {
          // Draw a line from current match to next match
          const startX = currentMatchDim.right;
          const startY = currentMatchDim.center.y;
          const endX = nextMatchDim.left;
          const endY = nextMatchDim.center.y;
          
          // Add a corner line if matches are not on the same level
          if (Math.abs(startY - endY) > 10) {
            lines.push(
              <BracketLine 
                key={`${match.id}-to-${match.nextMatchID}`} 
                x1={startX} 
                y1={startY} 
                x2={endX} 
                y2={endY} 
                type="corner" 
              />
            );
          } else {
            // Straight line if matches are roughly on the same level
            lines.push(
              <BracketLine 
                key={`${match.id}-to-${match.nextMatchID}`} 
                x1={startX} 
                y1={startY} 
                x2={endX} 
                y2={endY} 
                type="horizontal" 
              />
            );
          }
        }
      }
    });
    
    return (
      <svg className="bracket-lines" width={dimensions.container.width} height={dimensions.container.height}>
        {lines}
      </svg>
    );
  };
  
  return (
    <div className="advanced-single-elimination-bracket" ref={containerRef}>
      <div className="rounds-container">
        {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => (
          <div key={round} className="round">
            <h3 className="round-title">
              {round === maxRound ? 'Final' : round === maxRound - 1 ? 'Semifinals' : `Round ${round}`}
            </h3>
            <div className="matches">
              {matchesByRound[round]?.sort((a, b) => a.matchNumber - b.matchNumber).map(match => {
                const preparedMatch = preparedMatches.find(m => m.id === match.id);
                return (
                  <div className="match-wrapper" key={match.id}>
                    <Match match={preparedMatch} onClick={onMatchClick} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {dimensions.container && renderConnectorLines()}
    </div>
  );
};

export default AdvancedSingleEliminationBracket; 