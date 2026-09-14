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
    <div className="w-full bg-[#471C00]/95 border border-[#8C3700]/70 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-[#8C3700]/50 pb-2.5">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-300" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-orange-100">
            Live Scoreboard
          </h4>
        </div>
        <span className="text-[11px] text-orange-200/80 font-mono">
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
                  ? 'bg-[#5C2300] border-[#CC5500]/70 shadow-sm'
                  : 'bg-[#361300] border-[#6E2900]'
              }`}
            >
              {/* Rank & Player Info */}
              <div className="flex items-center gap-2.5 truncate">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                    rank === 1
                      ? 'bg-amber-400 text-stone-950 font-black'
                      : rank === 2
                      ? 'bg-stone-200 text-stone-950 font-bold'
                      : rank === 3
                      ? 'bg-amber-600 text-stone-950 font-bold'
                      : 'bg-[#2E1000] text-orange-200/70 border border-[#6E2900]'
                  }`}
                >
                  {rank}
                </span>

                <span className="text-base" role="img" aria-label="avatar">
                  {player.avatar || '🎵'}
                </span>

                <div className="flex items-center gap-1.5 truncate">
                  <span className={`truncate font-semibold ${isMe ? 'text-amber-200' : 'text-stone-200'}`}>
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
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>+{player.roundScore || 0}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-orange-200/60 font-mono">
                        <Clock className="w-3 h-3 animate-spin text-amber-400" /> Guessing...
                      </span>
                    )}
                  </div>
                )}

                <div className="text-right">
                  <span className="font-mono font-bold text-white text-sm">
                    {player.score.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-orange-200/70 ml-1">pts</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
