import React from 'react';
import Match from './Match';

const DoubleEliminationBracket = ({ matches, participants, onMatchClick }) => {
  // Group matches by bracket type and round
  const winnersBracket = matches.filter(m => m.bracketType === 'WINNERS' || m.matchNotes?.includes('WINNERS'));
  const losersBracket = matches.filter(m => m.bracketType === 'LOSERS' || m.matchNotes?.includes('LOSERS'));
  const grandFinals = matches.filter(m => m.bracketType === 'GRAND_FINALS' || m.matchNotes?.includes('GRAND_FINALS'));

  // Get participant objects by ID for displaying names
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

  // Get matches by round for winners bracket
  const winnerMatchesByRound = winnersBracket.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  // Get matches by round for losers bracket
  const loserMatchesByRound = losersBracket.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});
  
  // Get max round numbers
  const maxWinnerRound = Math.max(...winnersBracket.map(m => m.round), 0);
  const maxLoserRound = Math.max(...losersBracket.map(m => m.round), 0);

  return (
    <div className="double-elimination-bracket">
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
                {winnerMatchesByRound[round]?.sort((a, b) => a.matchNumber - b.matchNumber).map(match => {
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
      </div>

      <div className="losers-bracket">
        <h2 className="bracket-title">Losers Bracket</h2>
        <div className="bracket-rounds">
          {Array.from({ length: maxLoserRound }, (_, i) => i + 1).map(round => (
            <div key={`l-${round}`} className="round">
              <h3 className="round-title">
                {round === maxLoserRound ? 'Losers Finals' : `Round ${round}`}
              </h3>
              <div className="matches">
                {loserMatchesByRound[round]?.sort((a, b) => a.matchNumber - b.matchNumber).map(match => {
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
      </div>

      <div className="grand-finals">
        <h2 className="bracket-title">Grand Finals</h2>
        <div className="bracket-rounds">
          <div className="matches">
            {grandFinals.sort((a, b) => a.round - b.round).map(match => {
              const preparedMatch = preparedMatches.find(m => m.id === match.id);
              return (
                <div className="match-wrapper" key={match.id}>
                  <Match match={preparedMatch} onClick={onMatchClick} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoubleEliminationBracket; 