import React, { useState } from 'react';
import { Users, Crown, Copy, Check, Play, Settings2, Sparkles, ExternalLink, Music2 } from 'lucide-react';
import { Player, RoomSettings } from '../types/game';
import { GENRE_CATEGORIES } from '../services/itunes';

export interface MultiplayerLobbyProps {
  roomCode: string;
  players: Player[];
  currentPlayer: Player;
  isHost: boolean;
  settings: RoomSettings;
  onUpdateSettings: (settings: RoomSettings) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  roomCode,
  players,
  currentPlayer,
  isHost,
  settings,
  onUpdateSettings,
  onStartGame,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyRoomCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-5 sm:gap-6">
      {/* Top Banner: Room Code & Quick Share */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="flex flex-col">
            <span className="text-xs font-mono uppercase tracking-widest text-purple-400 font-semibold">
              Multiplayer Room Code
            </span>
            <span
              id="lobby-room-code-display"
              className="text-3xl sm:text-4xl font-black tracking-wider text-white font-mono drop-shadow-sm"
            >
              {roomCode}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <button
            id="lobby-copy-code-btn"
            onClick={handleCopyRoomCode}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs sm:text-sm font-semibold border border-zinc-700 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Copy Room Code"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-purple-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            id="lobby-share-link-btn"
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs sm:text-sm font-semibold border border-purple-500/50 shadow-md shadow-purple-950/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Copy Link to share with friends"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Share Link</span>
          </button>
        </div>
      </div>

      {/* Grid: Room Settings (Host) & Participant Roster */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Connected Players Roster (md:col-span-7) */}
        <div className="md:col-span-7 bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-700/80 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white text-base">
                Players in Lobby ({players.length})
              </h3>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Live Presence Sync
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {players.map((p) => {
              const isMe = p.id === currentPlayer.id;
              return (
                <div
                  key={p.id}
                  id={`lobby-player-row-${p.id}`}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-purple-950/40 border-purple-500/50 text-white shadow-sm'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label="avatar">
                      {p.avatar || '🎵'}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {p.name}
                        </span>
                        {isMe && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40">
                            YOU
                          </span>
                        )}
                        {p.isHost && (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-semibold border border-purple-400/50">
                            <Crown className="w-3 h-3" /> HOST
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">
                        Ready to Guess
                      </span>
                    </div>
                  </div>

                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-zinc-400 text-center mt-2">
            💡 <strong className="text-white">Multiplayer Tip:</strong> You can open another tab in your browser with this room code to test live competitive guessing against yourself!
          </p>
        </div>

        {/* Right: Match Configuration (md:col-span-5) */}
        <div className="md:col-span-5 bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-zinc-700/80 pb-3">
              <Settings2 className="w-5 h-5 text-rose-400" />
              <h3 className="font-bold text-white text-base">
                Match Settings
              </h3>
            </div>

            {/* Genre Pack Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Music Genre Category
              </label>
              <select
                id="lobby-genre-select"
                disabled={!isHost}
                value={settings.genre}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, genre: e.target.value })
                }
                className="bg-zinc-900 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-rose-500 cursor-pointer disabled:opacity-60"
              >
                {GENRE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Round Count Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Rounds Per Game
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    disabled={!isHost}
                    onClick={() =>
                      onUpdateSettings({ ...settings, totalRounds: count })
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      settings.totalRounds === count
                        ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black border-rose-400 shadow-md'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    } disabled:cursor-not-allowed`}
                  >
                    {count} Rounds
                  </button>
                ))}
              </div>
            </div>

            {/* Decaying Score Info */}
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-700 text-xs text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Time-Attack Scoring
              </div>
              <p>
                Each track plays for 30s. The score starts at <strong className="text-white">1,000 points</strong> and decays every second. The faster you guess the song, the higher your score!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-700/80">
            {isHost ? (
              <button
                id="lobby-start-game-btn"
                onClick={onStartGame}
                disabled={players.length < 1}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white font-black rounded-xl shadow-lg shadow-rose-950/40 active:scale-98 transition-all cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Start Match ({players.length} {players.length === 1 ? 'Player' : 'Players'})</span>
              </button>
            ) : (
              <div className="py-3 px-4 bg-zinc-900 border border-zinc-700 rounded-xl text-center text-xs text-zinc-400 font-medium">
                Waiting for host to start the game...
              </div>
            )}

            <button
              id="lobby-leave-room-btn"
              onClick={onLeaveRoom}
              className="w-full py-2.5 px-4 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
