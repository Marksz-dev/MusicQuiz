import React, { useEffect, useState, useRef } from 'react';
import {
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  Volume2,
  Clock,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Music,
  Crown,
  Medal,
  Zap,
  Youtube,
  Timer,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Track, Player, RoundPayload, RoomStatus } from '../types/game';
import { AudioPlayer } from './AudioPlayer';
import { AutocompleteInput } from './AutocompleteInput';
import { Leaderboard } from './Leaderboard';
import { isCorrectGuess } from '../services/itunes';

export interface MultiplayerGameProps {
  roomCode: string;
  currentPlayer: Player;
  players: Player[];
  roomStatus: RoomStatus;
  currentRoundPayload: RoundPayload | null;
  availableScore: number;
  roundTimeRemaining: number;
  isCountingDown: boolean;
  countdownSeconds: number;
  hasGuessedCorrect: boolean;
  revealedTrack: Track | null;
  recentScorer: { name: string; points: number } | null;
  onSubmitCorrectGuess: (guessText: string) => void;
  onSubmitSkipGuess?: () => void;
  onHostNextRound: () => void;
  onHostReturnToLobby: () => void;
}

export const MultiplayerGame: React.FC<MultiplayerGameProps> = ({
  roomCode,
  currentPlayer,
  players,
  roomStatus,
  currentRoundPayload,
  availableScore,
  roundTimeRemaining,
  isCountingDown,
  countdownSeconds,
  hasGuessedCorrect,
  revealedTrack,
  recentScorer,
  onSubmitCorrectGuess,
  onSubmitSkipGuess,
  onHostNextRound,
  onHostReturnToLobby,
}) => {
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number>(5);
  const hasProgressedRoundRef = useRef<number | null>(null);
  const onHostNextRoundRef = useRef(onHostNextRound);

  // Keep latest reference to onHostNextRound without restarting timers
  useEffect(() => {
    onHostNextRoundRef.current = onHostNextRound;
  }, [onHostNextRound]);

  // Reset progression tracker whenever entering active play, countdown, or lobby
  useEffect(() => {
    if (roomStatus === 'playing' || roomStatus === 'countdown' || roomStatus === 'lobby') {
      hasProgressedRoundRef.current = null;
      setRevealCountdown(5);
    }
  }, [roomStatus]);

  // Trigger podium confetti when game concludes
  useEffect(() => {
    if (roomStatus === 'game_over') {
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {}
    }
  }, [roomStatus]);

  // Unified 5-second countdown timer on round reveal screen for ALL rounds (even and odd)
  useEffect(() => {
    if (roomStatus !== 'round_reveal' || !revealedTrack) {
      return;
    }

    const currentRoundIdx = currentRoundPayload?.roundIndex ?? 1;
    setRevealCountdown(5);

    let remaining = 5;
    const interval = window.setInterval(() => {
      remaining -= 1;
      setRevealCountdown(Math.max(0, remaining));

      if (remaining <= 0) {
        clearInterval(interval);
        if (currentPlayer.isHost && hasProgressedRoundRef.current !== currentRoundIdx) {
          hasProgressedRoundRef.current = currentRoundIdx;
          onHostNextRoundRef.current();
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [roomStatus, revealedTrack, currentRoundPayload?.roundIndex, currentPlayer.isHost]);

  // Host manual skip during reveal screen
  const handleHostManualNextRound = () => {
    if (!currentPlayer.isHost) return;
    const currentRoundIdx = currentRoundPayload?.roundIndex ?? 1;
    if (hasProgressedRoundRef.current !== currentRoundIdx) {
      hasProgressedRoundRef.current = currentRoundIdx;
      onHostNextRoundRef.current();
    }
  };

  // Handle local player guess submission
  const handleGuessSubmit = (guessText: string) => {
    if (hasGuessedCorrect || !currentRoundPayload || roomStatus !== 'playing') return;

    const correct = isCorrectGuess(guessText, currentRoundPayload.track);
    if (correct) {
      onSubmitCorrectGuess(guessText);
      setGuessFeedback(`Correct! +${availableScore} points`);
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {}
    } else {
      setGuessFeedback(`Wrong guess: "${guessText}"`);
      setTimeout(() => setGuessFeedback(null), 2500);
    }
  };

  // 1. COUNTDOWN SCREEN
  if (isCountingDown || roomStatus === 'countdown') {
    return (
      <div className="w-full max-w-xl mx-auto py-20 px-4 flex flex-col items-center justify-center text-center">
        <div className="relative flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-4 border-rose-500/30 border-t-rose-500 animate-spin" />
          <span className="absolute text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400 font-mono">
            {countdownSeconds > 0 ? countdownSeconds : 'GO!'}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-white mt-6">Get Ready to Guess!</h3>
        <p className="text-zinc-400 text-sm mt-1">
          Round {currentRoundPayload?.roundIndex || 1} of {currentRoundPayload?.totalRounds || 5} is starting...
        </p>
      </div>
    );
  }

  // 2. ROUND REVEAL SCREEN (5-Second Transition with Audio Stopped)
  if (roomStatus === 'round_reveal' && revealedTrack) {
    const isFinalRound =
      currentRoundPayload &&
      currentRoundPayload.roundIndex >= currentRoundPayload.totalRounds;

    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // Personal result calculation
    const myPlayer = players.find((p) => p.id === currentPlayer.id) || currentPlayer;
    const didSolve = myPlayer.hasGuessedCorrect || (hasGuessedCorrect && (myPlayer.roundScore ?? 0) > 0);
    const roundPtsEarned = myPlayer.roundScore ?? 0;

    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-4 sm:py-6 flex flex-col items-center gap-5">
        {/* Visible 5-second Countdown Header */}
        <div className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-4 shadow-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-rose-400 animate-spin" />
              <span className="text-sm sm:text-base font-bold text-white">
                {isFinalRound
                  ? `Final podium in ${revealCountdown}s...`
                  : `Next round in ${revealCountdown}s...`}
              </span>
            </div>

            {/* Host Skip Button */}
            {currentPlayer.isHost && (
              <button
                id="host-skip-reveal-btn"
                onClick={handleHostManualNextRound}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 border border-rose-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <span>{isFinalRound ? 'View Podium Now' : 'Next Round Now'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 5-second Animated Progress Bar */}
          <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-700/60">
            <div
              className="bg-gradient-to-r from-rose-500 to-orange-400 h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.max(0, (revealCountdown / 5) * 100)}%` }}
            />
          </div>
        </div>

        {/* Recap Card */}
        <div className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col items-center gap-5">
          {/* Round Pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/40">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            Round {currentRoundPayload?.roundIndex || 1} Recap
          </div>

          {/* Track Artwork, Title & Artist */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left w-full">
            {revealedTrack.artworkUrl ? (
              <img
                src={revealedTrack.artworkUrl}
                alt={revealedTrack.title}
                referrerPolicy="no-referrer"
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl shadow-xl object-cover border border-zinc-700 shrink-0"
              />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 shrink-0">
                <Music className="w-12 h-12" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-bold text-zinc-400 font-mono">
                The Song Was
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate mt-0.5">
                {revealedTrack.title}
              </h3>
              <p className="text-rose-400 text-base sm:text-lg font-semibold truncate">
                {revealedTrack.artist}
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                Album: {revealedTrack.album || 'Unknown Album'}{' '}
                {revealedTrack.releaseDate ? `(${revealedTrack.releaseDate})` : ''}
              </p>

              {revealedTrack.source === 'youtube' && (
                <div className="mt-2.5">
                  <a
                    href={revealedTrack.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-950/70 hover:bg-red-900 text-red-200 text-xs font-semibold rounded-lg border border-red-800/60 shadow-sm transition-colors"
                  >
                    <Youtube className="w-3.5 h-3.5 text-red-500" /> Watch on YouTube
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Personal Result Indicator */}
          <div className="w-full">
            {didSolve && roundPtsEarned > 0 ? (
              <div className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm sm:text-base text-white">
                      Correct! +{roundPtsEarned.toLocaleString()} points
                    </div>
                    <div className="text-xs text-emerald-300/80">
                      {myPlayer.guessTimeSeconds
                        ? `Solved in ${myPlayer.guessTimeSeconds}s`
                        : 'Points locked in!'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono font-black text-lg sm:text-xl text-emerald-400">
                  +{roundPtsEarned}
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-zinc-300">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm sm:text-base text-zinc-200">
                      Wrong / Time out! 0 points
                    </div>
                    <div className="text-xs text-zinc-400">
                      Ready for the next round!
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-base sm:text-lg text-zinc-500">
                  0 pts
                </div>
              </div>
            )}
          </div>

          {/* Updated Mini Leaderboard */}
          <div className="w-full flex flex-col gap-2 pt-2 border-t border-zinc-700/60">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider font-bold text-zinc-400 px-1">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-purple-400" /> Room Standings
              </span>
              <span>Points</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {sortedPlayers.map((player, idx) => {
                const isMe = player.id === currentPlayer.id;
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs sm:text-sm transition-all ${
                      isMe
                        ? 'bg-purple-950/40 border-purple-500/50 text-white'
                        : 'bg-zinc-900/60 border-zinc-700/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-4 text-center font-mono font-bold text-zinc-400 text-xs">
                        #{idx + 1}
                      </span>
                      <span className="text-base">{player.avatar}</span>
                      <span className="font-semibold truncate max-w-[120px] sm:max-w-[180px]">
                        {player.name} {isMe && <span className="text-purple-300 text-[11px]">(You)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {player.roundScore > 0 ? (
                        <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                          +{player.roundScore}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-500">
                          +0
                        </span>
                      )}
                      <span className="font-mono font-bold text-white min-w-[55px] text-right">
                        {player.score.toLocaleString()} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. FINAL GAME OVER PODIUM SCREEN
  if (roomStatus === 'game_over') {
    const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
    const first = rankedPlayers[0];
    const second = rankedPlayers[1];
    const third = rankedPlayers[2];

    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-8 flex flex-col items-center text-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-widest border border-purple-500/40">
            <Trophy className="w-4 h-4 text-purple-400" /> Tournament Results
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Match Champions!
          </h2>
          <p className="text-zinc-400 text-sm">
            All rounds completed. Here is the final podium standing:
          </p>
        </div>

        {/* 3D-Style Podium Standings */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-lg pt-8 pb-4">
          {/* 2nd Place */}
          {second ? (
            <div className="flex-1 flex flex-col items-center gap-2">
              <span className="text-2xl">{second.avatar}</span>
              <span className="text-xs font-bold text-zinc-300 truncate max-w-[80px]">
                {second.name}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {second.score.toLocaleString()} pts
              </span>
              <div className="w-full h-24 bg-zinc-800 border-t-2 border-zinc-600 rounded-t-xl flex items-center justify-center font-black text-xl text-zinc-300 shadow-lg">
                2
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* 1st Place Champion */}
          {first && (
            <div className="flex-1 flex flex-col items-center gap-2">
              <Crown className="w-7 h-7 text-amber-300 animate-bounce" />
              <span className="text-3xl">{first.avatar}</span>
              <span className="text-sm font-black text-white truncate max-w-[100px]">
                {first.name}
              </span>
              <span className="text-xs font-mono font-bold text-rose-400">
                {first.score.toLocaleString()} pts
              </span>
              <div className="w-full h-36 bg-gradient-to-t from-rose-500 to-orange-400 rounded-t-2xl flex items-center justify-center font-black text-3xl text-white border-t-4 border-white shadow-xl shadow-rose-950/40">
                1
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {third ? (
            <div className="flex-1 flex flex-col items-center gap-2">
              <span className="text-2xl">{third.avatar}</span>
              <span className="text-xs font-bold text-zinc-300 truncate max-w-[80px]">
                {third.name}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {third.score.toLocaleString()} pts
              </span>
              <div className="w-full h-18 bg-zinc-800/90 border-t-2 border-zinc-700 rounded-t-xl flex items-center justify-center font-black text-lg text-zinc-400 shadow-md">
                3
              </div>
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* Complete Leaderboard */}
        <div className="w-full">
          <Leaderboard
            players={players}
            currentUserId={currentPlayer.id}
            showRoundStatus={false}
          />
        </div>

        {/* Action Button */}
        {currentPlayer.isHost && (
          <button
            id="game-return-to-lobby-btn"
            onClick={onHostReturnToLobby}
            className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white font-black rounded-xl shadow-lg shadow-rose-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again in Lobby</span>
          </button>
        )}
      </div>
    );
  }

  // 4. ACTIVE TIME-ATTACK GUESSING SCREEN
  const roundIndex = currentRoundPayload?.roundIndex || 1;
  const totalRounds = currentRoundPayload?.totalRounds || 5;

  // Smooth color transition from #10B981 (green) down to #EF4444 (red) as time runs out
  const timeFraction = Math.max(0, Math.min(1, roundTimeRemaining / 30));
  const timerR = Math.round(239 + (16 - 239) * timeFraction);
  const timerG = Math.round(68 + (185 - 68) * timeFraction);
  const timerB = Math.round(68 + (129 - 68) * timeFraction);
  const timerBarColor = `rgb(${timerR}, ${timerG}, ${timerB})`;

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-4 sm:gap-5">
      {/* Top Banner: Round Tracker & Recent Scorer Notification */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-3 sm:px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Round
          </span>
          <span className="text-sm sm:text-base font-black text-white font-mono">
            {roundIndex} / {totalRounds}
          </span>
        </div>

        {/* Realtime Notification of other players scoring */}
        {recentScorer && (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-purple-500/20 text-purple-200 rounded-full text-xs font-semibold animate-pulse border border-purple-500/40 order-3 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
            <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">
              {recentScorer.name} got it! (+{recentScorer.points} pts)
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs text-zinc-400 order-2 sm:order-3">
          <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{roundTimeRemaining}s remaining</span>
        </div>
      </div>

      {/* Main Grid: Audio & Guessing (col-span-7) + Live Scoreboard (col-span-5) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: Audio Player & Input */}
        <div className="md:col-span-7 flex flex-col gap-5">
          {/* Decaying Score Gauge Banner */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-5 shadow-xl flex flex-col items-center text-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-rose-400 font-semibold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-400" /> Available Points Right Now
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-sm">
              {availableScore.toLocaleString()}
              <span className="text-sm font-sans font-semibold text-zinc-400 ml-1">pts</span>
            </div>

            {/* Time progress bar with smooth transition from #10B981 to #EF4444 */}
            <div className="w-full bg-zinc-900 border border-zinc-700 h-2.5 rounded-full overflow-hidden mt-1">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${timeFraction * 100}%`,
                  backgroundColor: timerBarColor,
                }}
              />
            </div>
          </div>

          {/* Synchronized Drift-Aware Audio Player */}
          {currentRoundPayload && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 shadow-xl">
              <AudioPlayer
                previewUrl={currentRoundPayload.track.previewUrl}
                source={currentRoundPayload.track.source}
                youtubeId={currentRoundPayload.track.youtubeId}
                synchronizedStartTime={currentRoundPayload.startTime}
                isPlaying={true}
                showEqualizer={true}
                showControls={false}
              />
            </div>
          )}

          {/* Guessing Mechanism */}
          <div className="flex flex-col gap-3">
            {hasGuessedCorrect ? (
              <div className="w-full py-4 px-5 bg-green-500/20 border border-green-500/50 rounded-2xl flex items-center justify-center gap-3 text-green-300 font-bold text-center shadow-lg animate-in zoom-in-95">
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                <div>
                  <div className="text-base sm:text-lg">Solved! Points Locked In!</div>
                  <div className="text-xs font-medium text-green-300/80 mt-0.5">
                    Sit back while other players finish guessing or round ends.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <AutocompleteInput
                      onSelectTrack={(t) => handleGuessSubmit(`${t.title} - ${t.artist}`)}
                      onSubmitGuess={handleGuessSubmit}
                      disabled={hasGuessedCorrect || roundTimeRemaining <= 0}
                      placeholder="Type song title or artist..."
                      autoFocus={true}
                      genreId={currentRoundPayload?.track?.category}
                    />
                  </div>
                  {onSubmitSkipGuess && (
                    <button
                      type="button"
                      id="game-pass-round-btn"
                      onClick={onSubmitSkipGuess}
                      disabled={hasGuessedCorrect || roundTimeRemaining <= 0}
                      className="px-3.5 py-3 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white text-xs font-bold rounded-xl border border-zinc-700 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                      title="Pass / Give Up this round (0 points)"
                    >
                      Pass
                    </button>
                  )}
                </div>

                {guessFeedback && (
                  <div
                    className={`text-xs text-center font-semibold py-1.5 px-3 rounded-lg ${
                      guessFeedback.startsWith('Correct')
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {guessFeedback}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Scoreboard */}
        <div className="md:col-span-5 flex flex-col gap-4">
          <Leaderboard
            players={players}
            currentUserId={currentPlayer.id}
            showRoundStatus={true}
          />
        </div>
      </div>
    </div>
  );
};
