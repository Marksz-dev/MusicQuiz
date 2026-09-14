import React from 'react';
import { Trophy, CheckCircle, Clock, Zap, Crown } from 'lucide-react';
import { Player } from '../types/game';

export interface LeaderboardProps {
  players: Player[];
  currentUserId: string;
  showRoundStatus?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  currentUserId,
  showRoundStatus = true,
}) => {
  // Sort players by total score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-zinc-700/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-purple-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Live Scoreboard
          </h4>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono">
          {players.length} Players
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {sortedPlayers.map((player, index) => {
          const isMe = player.id === currentUserId;
          const rank = index + 1;

          return (
            <div
              key={player.id}
              id={`leaderboard-player-${player.id}`}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                isMe
                  ? 'bg-purple-950/40 border-purple-500/50 shadow-sm'
                  : 'bg-zinc-900 border-zinc-700'
              }`}
            >
              {/* Rank & Player Info */}
              <div className="flex items-center gap-2.5 truncate">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                    rank === 1
                      ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black'
                      : rank === 2
                      ? 'bg-zinc-700 text-zinc-200 font-bold'
                      : rank === 3
                      ? 'bg-zinc-800 text-zinc-300 font-bold border border-zinc-600'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  {rank}
                </span>

                <span className="text-base" role="img" aria-label="avatar">
                  {player.avatar || '🎵'}
                </span>

                <div className="flex items-center gap-1.5 truncate">
                  <span className={`truncate font-semibold ${isMe ? 'text-purple-200' : 'text-zinc-200'}`}>
                    {player.name}
                  </span>
                  {player.isHost && (
                    <Crown className="w-3 h-3 text-amber-300 flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Status & Points */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {showRoundStatus && (
                  <div>
                    {player.hasGuessedCorrect ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/20 text-green-300 text-[11px] font-bold border border-green-500/40">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span>+{player.roundScore || 0}</span>
                      </span>
                    ) : player.hasSubmittedGuess ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[11px] font-medium border border-zinc-700">
                        <span>Passed</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                        <Clock className="w-3 h-3 animate-spin text-rose-400" /> Guessing...
                      </span>
                    )}
                  </div>
                )}

                <div className="text-right">
                  <span className="font-mono font-bold text-white text-sm">
                    {player.score.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-zinc-400 ml-1">pts</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
