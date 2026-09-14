import React from 'react';
import { Music2, Radio, User, Users, BarChart2, Database, ShieldCheck } from 'lucide-react';

export interface HeaderProps {
  activeTab: 'single' | 'multiplayer';
  onTabChange: (tab: 'single' | 'multiplayer') => void;
  onOpenStats: () => void;
  onOpenSchema: () => void;
  isSupabaseConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenStats,
  onOpenSchema,
  isSupabaseConnected,
}) => {
  return (
    <header className="w-full border-b border-[#8C3700]/70 bg-[#471C00]/95 backdrop-blur-md sticky top-0 z-40 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-black/30">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-lg tracking-tight text-white font-sans">
                SongSpot
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40">
                LIVE
              </span>
            </div>
            <span className="text-[11px] text-orange-200 -mt-1 hidden sm:inline">
              Interactive Music Guessing
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-[#2E1000] p-1 rounded-xl border border-[#6E2900]">
          <button
            id="header-tab-single-btn"
            onClick={() => onTabChange('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-gradient-to-r from-amber-400 to-[#FF7700] text-stone-950 font-black shadow-md'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Single Player</span>
          </button>

          <button
            id="header-tab-multiplayer-btn"
            onClick={() => onTabChange('multiplayer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'multiplayer'
                ? 'bg-gradient-to-r from-amber-400 to-[#FF7700] text-stone-950 font-black shadow-md'
                : 'text-orange-200 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Multiplayer Room</span>
          </button>
        </div>

        {/* Action Controls & Indicators */}
        <div className="flex items-center gap-2">
          {/* Supabase Status Button */}
          <button
            id="header-supabase-status-btn"
            onClick={onOpenSchema}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#361300] border border-[#8C3700] hover:border-amber-400 text-xs text-orange-100 transition-colors cursor-pointer"
            title="View Supabase Realtime Schema and Setup"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConnected
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="hidden md:inline font-mono text-[11px]">
              {isSupabaseConnected ? 'Supabase Live' : 'Realtime Hub'}
            </span>
            <Database className="w-3.5 h-3.5 text-orange-200" />
          </button>

          {/* Player Stats Button */}
          <button
            id="header-open-stats-btn"
            onClick={onOpenStats}
            className="p-2 rounded-lg bg-[#361300] border border-[#8C3700] hover:border-amber-400 text-orange-100 hover:text-white transition-colors cursor-pointer"
            title="Single Player Stats"
          >
            <BarChart2 className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
