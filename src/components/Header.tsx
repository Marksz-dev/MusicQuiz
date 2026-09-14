import React from 'react';
import { Music2, User, Users, BarChart2 } from 'lucide-react';

export interface HeaderProps {
  activeTab: 'single' | 'multiplayer';
  onTabChange: (tab: 'single' | 'multiplayer') => void;
  onOpenStats: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenStats,
}) => {
  return (
    <header className="w-full border-b border-zinc-700/80 bg-zinc-800/95 backdrop-blur-md sticky top-0 z-40 shadow-xl shadow-black/30">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-0 min-h-14 sm:h-16 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 order-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-rose-950/40">
            <Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-tight text-white font-sans">
                SongFight
              </span>
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 tracking-wider">
                LIVE
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 -mt-1 hidden md:inline">
              Interactive Music Guessing
            </span>
          </div>
        </div>

        {/* Action Controls (Stats Button) - Placed top-right on mobile next to brand */}
        <div className="flex items-center gap-2 order-2 sm:order-3">
          <button
            id="header-open-stats-btn"
            onClick={onOpenStats}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Single Player Stats"
          >
            <BarChart2 className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-semibold">Stats</span>
          </button>
        </div>

        {/* Mode Selector Tabs - Wraps cleanly to full width on mobile, inline on desktop */}
        <div className="w-full sm:w-auto order-3 sm:order-2 flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-700 max-w-full">
          <button
            id="header-tab-single-btn"
            onClick={() => onTabChange('single')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Single Player</span>
          </button>

          <button
            id="header-tab-multiplayer-btn"
            onClick={() => onTabChange('multiplayer')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'multiplayer'
                ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Multiplayer</span>
          </button>
        </div>
      </div>
    </header>
  );
};
