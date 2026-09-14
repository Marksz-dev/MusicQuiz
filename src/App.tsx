/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  PlusCircle,
  LogIn,
  Sparkles,
  Music2,
  Dice5,
  Crown,
  Volume2,
  Radio,
} from 'lucide-react';
import { Header } from './components/Header';
import { SinglePlayerView } from './components/SinglePlayerView';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { MultiplayerGame } from './components/MultiplayerGame';
import { StatsModal } from './components/StatsModal';
import { useSupabaseRoom } from './hooks/useSupabaseRoom';
import { Player, RoomSettings, Track } from './types/game';
import { getTracksForGenre } from './services/itunes';

const DEFAULT_AVATARS = ['🎵', '🎧', '🎸', '🎹', '🎷', '🎤', '🥁', '⚡', '🔥', '✨'];
const DEFAULT_NAMES = [
  'GrooveKing',
  'BeatMaster',
  'MelodyHero',
  'RhythmRider',
  'DiscoWizard',
  'TuneSeeker',
  'SoundSurfer',
  'BassDrop',
];

function generateRandomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'multiplayer'>('single');
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Player identity for multiplayer
  const [playerId] = useState(() => {
    const existing = localStorage.getItem('songspot_player_id');
    if (existing) return existing;
    const newId = 'p_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('songspot_player_id', newId);
    return newId;
  });

  const [playerName, setPlayerName] = useState(() => {
    return (
      localStorage.getItem('songspot_player_name') ||
      DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)]
    );
  });

  const [playerAvatar, setPlayerAvatar] = useState(() => {
    return (
      localStorage.getItem('songspot_player_avatar') ||
      DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]
    );
  });

  // Room State
  const [activeRoomCode, setActiveRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    genre: 'pop_hits',
    totalRounds: 5,
    roundDuration: 30,
  });

  // Host match playlist
  const matchPlaylistRef = useRef<Track[]>([]);
  const currentRoundIndexRef = useRef<number>(1);

  // Auto-detect room code from URL ?room=CODE
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setJoinCodeInput(roomParam.toUpperCase());
      setActiveTab('multiplayer');
    }
  }, []);

  const handleSavePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('songspot_player_name', name);
  };

  const handleSavePlayerAvatar = (avatar: string) => {
    setPlayerAvatar(avatar);
    localStorage.setItem('songspot_player_avatar', avatar);
  };

  // Host creates new room
  const handleCreateRoom = () => {
    const code = generateRandomRoomCode();
    setIsHost(true);
    setActiveRoomCode(code);
  };

  // Player joins existing room
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCodeInput.trim().toUpperCase();
    if (clean.length < 4) {
      setJoinError('Please enter a valid room code (min 4 characters)');
      return;
    }
    setJoinError(null);
    setIsHost(false);
    setActiveRoomCode(clean);
  };

  const handleLeaveRoom = () => {
    setActiveRoomCode('');
    setIsHost(false);
    matchPlaylistRef.current = [];
    currentRoundIndexRef.current = 1;
  };

  // Current Player Profile object
  const currentPlayer: Player = {
    id: playerId,
    name: playerName,
    avatar: playerAvatar,
    color: '#A855F7',
    score: 0,
    roundScore: 0,
    hasGuessedCorrect: false,
    isHost,
    joinedAt: Date.now(),
  };

  // Supabase Realtime Room Hook
  const {
    players,
    roomStatus,
    currentRoundPayload,
    myScore,
    hasGuessedCorrect,
    availableScore,
    roundTimeRemaining,
    isCountingDown,
    countdownSeconds,
    revealedTrack,
    recentScorer,
    isSupabaseConnected,
    submitCorrectGuess,
    startNextRound,
    endRound,
    endGame,
    returnToLobby,
  } = useSupabaseRoom({
    roomCode: activeRoomCode,
    currentPlayer: {
      id: playerId,
      name: playerName,
      avatar: playerAvatar,
      color: '#A855F7',
      isHost,
    },
  });

  // Host: Starts the multiplayer match
  const handleHostStartGame = async () => {
    if (!isHost) return;

    try {
      const tracks = await getTracksForGenre(roomSettings.genre, roomSettings.totalRounds);
      if (tracks.length === 0) return;

      matchPlaylistRef.current = tracks;
      currentRoundIndexRef.current = 1;

      // Start round 1
      startNextRound(1, roomSettings.totalRounds, tracks[0]);
    } catch (err) {
      console.error('Error starting game:', err);
    }
  };

  // Host: Advance to next round or trigger game over
  const handleHostNextRound = () => {
    if (!isHost) return;

    const nextIndex = currentRoundIndexRef.current + 1;
    if (nextIndex <= roomSettings.totalRounds && matchPlaylistRef.current[nextIndex - 1]) {
      currentRoundIndexRef.current = nextIndex;
      startNextRound(
        nextIndex,
        roomSettings.totalRounds,
        matchPlaylistRef.current[nextIndex - 1]
      );
    } else {
      // All rounds completed -> Game Over Podium
      endGame(players);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col font-sans selection:bg-rose-500 selection:text-white overflow-x-hidden w-full max-w-full">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenStats={() => setIsStatsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start w-full max-w-full overflow-x-hidden">
        {activeTab === 'single' ? (
          /* ================= SINGLE PLAYER MODE ================= */
          <div className="w-full max-w-full flex flex-col items-center py-2 sm:py-4">
            <SinglePlayerView onOpenStats={() => setIsStatsOpen(true)} />
          </div>
        ) : (
          /* ================= MULTIPLAYER ROOM MODE ================= */
          <div className="w-full max-w-full flex flex-col items-center py-2 sm:py-4">
            {!activeRoomCode ? (
              /* Room Join & Creation Gate */
              <div className="w-full max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">
                {/* Intro Card */}
                <div className="text-center flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-xl shadow-rose-950/30 mb-1">
                    <Radio className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-sm">
                    Multiplayer Time-Attack
                  </h2>
                  <p className="text-sm text-zinc-400 max-w-sm">
                    Compete in real-time with friends. Fast guesses score up to 1,000 decaying points per song!
                  </p>
                </div>

                {/* Profile Customization */}
                <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Your Player Identity
                  </span>

                  <div className="flex items-center gap-3">
                    {/* Avatar picker dropdown/bubble */}
                    <div className="relative">
                      <button
                        type="button"
                        className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-2xl shadow hover:border-purple-500 transition-colors cursor-pointer"
                        title="Change Avatar"
                        onClick={() => {
                          const nextIdx =
                            (DEFAULT_AVATARS.indexOf(playerAvatar) + 1) % DEFAULT_AVATARS.length;
                          handleSavePlayerAvatar(DEFAULT_AVATARS[nextIdx]);
                        }}
                      >
                        {playerAvatar}
                      </button>
                    </div>

                    <div className="flex-1">
                      <input
                        id="player-name-input"
                        type="text"
                        maxLength={20}
                        value={playerName}
                        onChange={(e) => handleSavePlayerName(e.target.value)}
                        placeholder="Enter nickname..."
                        className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 font-semibold text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Click avatar emoji to shuffle</span>
                    <button
                      type="button"
                      onClick={() => {
                        const randomName =
                          DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
                        handleSavePlayerName(randomName);
                      }}
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium transition-colors"
                    >
                      <Dice5 className="w-3.5 h-3.5" /> Random Nickname
                    </button>
                  </div>
                </div>

                {/* Create or Join Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Create Room */}
                  <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-1">
                        <PlusCircle className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white text-base">Host a Room</h3>
                      <p className="text-xs text-zinc-400">
                        Choose genre, invite friends with a 6-character room code.
                      </p>
                    </div>

                    <button
                      id="create-room-btn"
                      onClick={handleCreateRoom}
                      className="w-full py-3 px-4 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white font-black rounded-xl shadow-lg shadow-rose-950/40 active:scale-95 transition-all cursor-pointer text-sm"
                    >
                      Create Room
                    </button>
                  </div>

                  {/* Join Room */}
                  <form
                    onSubmit={handleJoinRoom}
                    className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4 text-center"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-1">
                        <LogIn className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white text-base">Join Match</h3>
                      <p className="text-xs text-zinc-400">
                        Got a code from a friend? Enter it below to jump in!
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <input
                        id="join-room-code-input"
                        type="text"
                        maxLength={6}
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        placeholder="e.g. SPOT42"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-center text-white placeholder-zinc-600 font-mono font-bold tracking-widest text-base uppercase focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40"
                      />
                      {joinError && (
                        <span className="text-[11px] text-red-400 font-medium">{joinError}</span>
                      )}
                      <button
                        type="submit"
                        id="join-room-submit-btn"
                        disabled={!joinCodeInput.trim()}
                        className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl border border-purple-500/50 shadow-lg shadow-purple-950/40 text-sm transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                      >
                        Join Room
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : roomStatus === 'lobby' ? (
              /* Active Room Lobby */
              <MultiplayerLobby
                roomCode={activeRoomCode}
                players={players}
                currentPlayer={currentPlayer}
                isHost={isHost}
                settings={roomSettings}
                onUpdateSettings={setRoomSettings}
                onStartGame={handleHostStartGame}
                onLeaveRoom={handleLeaveRoom}
              />
            ) : (
              /* Active Match (Countdown / Playing / Reveal / Podium) */
              <MultiplayerGame
                roomCode={activeRoomCode}
                currentPlayer={currentPlayer}
                players={players}
                roomStatus={roomStatus}
                currentRoundPayload={currentRoundPayload}
                availableScore={availableScore}
                roundTimeRemaining={roundTimeRemaining}
                isCountingDown={isCountingDown}
                countdownSeconds={countdownSeconds}
                hasGuessedCorrect={hasGuessedCorrect}
                revealedTrack={revealedTrack}
                recentScorer={recentScorer}
                onSubmitCorrectGuess={submitCorrectGuess}
                onHostNextRound={handleHostNextRound}
                onHostReturnToLobby={returnToLobby}
              />
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />
    </div>
  );
}
