import React from 'react';
import { BarChart3, Trophy, Flame, Target, X } from 'lucide-react';
import { SinglePlayerStats } from '../types/game';

export interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats?: SinglePlayerStats;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose, stats }) => {
  if (!isOpen) return null;

  const currentStats: SinglePlayerStats = stats || (() => {
    try {
      const data = localStorage.getItem('songspot_singleplayer_stats');
      if (data) return JSON.parse(data);
    } catch {}
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  })();

  const winPercentage = currentStats.gamesPlayed > 0
    ? Math.round((currentStats.gamesWon / currentStats.gamesPlayed) * 100)
    : 0;

  const maxFreq = Math.max(...Object.values(currentStats.guessDistribution || {}), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#471C00] border border-[#CC5500]/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#8C3700]/60 bg-[#361300]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-white text-base">Player Statistics</h3>
          </div>
          <button
            onClick={onClose}
            className="text-orange-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-[#361300] p-2.5 rounded-xl border border-[#6E2900]">
              <span className="text-xl sm:text-2xl font-black text-white font-mono">
                {currentStats.gamesPlayed}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-orange-200/80 block mt-0.5">
                Played
              </span>
            </div>

            <div className="bg-[#361300] p-2.5 rounded-xl border border-[#6E2900]">
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {winPercentage}%
              </span>
              <span className="text-[10px] uppercase tracking-wider text-orange-200/80 block mt-0.5">
                Win Rate
              </span>
            </div>

            <div className="bg-[#361300] p-2.5 rounded-xl border border-[#6E2900]">
              <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                {currentStats.currentStreak}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-orange-200/80 block mt-0.5">
                Streak
              </span>
            </div>

            <div className="bg-[#361300] p-2.5 rounded-xl border border-[#6E2900]">
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                {currentStats.maxStreak}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-orange-200/80 block mt-0.5">
                Max
              </span>
            </div>
          </div>

          {/* Guess Distribution Histogram */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-100">
              Guess Distribution
            </h4>
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              {[1, 2, 3, 4, 5].map((attempt) => {
                const count = currentStats.guessDistribution?.[attempt] || 0;
                const widthPercent = Math.max(8, (count / maxFreq) * 100);
                return (
                  <div key={attempt} className="flex items-center gap-2">
                    <span className="w-3 text-right text-orange-200 font-semibold">
                      {attempt}
                    </span>
                    <div className="flex-1 bg-[#2E1000] border border-[#6E2900] rounded-md h-5 overflow-hidden flex items-center">
                      <div
                        className={`h-full flex items-center justify-end px-2 text-[11px] font-black text-stone-950 transition-all duration-300 ${
                          count > 0 ? 'bg-gradient-to-r from-amber-400 to-[#FF7700]' : 'bg-[#361300] text-orange-200/50'
                        }`}
                        style={{ width: `${widthPercent}%` }}
                      >
                        {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#8C3700]/50 bg-[#361300] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#521E00] hover:bg-[#6E2900] text-white rounded-lg text-xs font-semibold border border-[#8C3700] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
