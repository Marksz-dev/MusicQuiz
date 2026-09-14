import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Flame,
  CheckCircle2,
  Volume2,
  Clock,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Music,
  Crown,
  Medal,
  Zap,
  Youtube,
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
  onHostNextRound,
  onHostReturnToLobby,
}) => {
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);

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
          <div className="w-32 h-32 rounded-full border-4 border-[#CC5500]/40 border-t-amber-400 animate-spin" />
          <span className="absolute text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-[#FF7700] font-mono">
            {countdownSeconds > 0 ? countdownSeconds : 'GO!'}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-white mt-6">Get Ready to Guess!</h3>
        <p className="text-orange-200 text-sm mt-1">
          Round {currentRoundPayload?.roundIndex || 1} of {currentRoundPayload?.totalRounds || 5} is starting...
        </p>
      </div>
    );
  }

  // 2. ROUND REVEAL SCREEN
  if (roomStatus === 'round_reveal' && revealedTrack) {
    const sortedRoundPlayers = [...players].sort((a, b) => b.score - a.score);
    const roundWinner = sortedRoundPlayers.find((p) => p.hasGuessedCorrect);

    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-6 flex flex-col items-center gap-6">
        <div className="w-full bg-gradient-to-b from-[#4A1C00] to-[#2E1000] border border-[#CC5500]/60 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            Round {currentRoundPayload?.roundIndex} Complete
          </div>

          <div className="flex flex-col items-center gap-3">
            {revealedTrack.artworkUrl ? (
              <img
                src={revealedTrack.artworkUrl}
                alt={revealedTrack.title}
                referrerPolicy="no-referrer"
                className="w-32 h-32 rounded-2xl shadow-xl object-cover border border-[#8C3700]"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-[#361300] flex items-center justify-center text-orange-200">
                <Music className="w-12 h-12" />
              </div>
            )}

            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                {revealedTrack.title}
              </h3>
              <p className="text-amber-300 text-lg font-semibold">
                {revealedTrack.artist}
              </p>
              <p className="text-orange-200 text-xs mt-0.5">
                Album: {revealedTrack.album} {revealedTrack.releaseDate ? `(${revealedTrack.releaseDate})` : ''}
              </p>
              {revealedTrack.source === 'youtube' && (
                <div className="mt-2 flex items-center justify-center">
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

          {/* Winner Banner */}
          {roundWinner ? (
            <div className="w-full py-2.5 px-4 bg-amber-500/20 border border-amber-400/40 rounded-xl flex items-center justify-center gap-2 text-amber-200 text-sm font-semibold">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>
                Fastest Guess: <strong>{roundWinner.name}</strong> (+{roundWinner.roundScore} pts)
              </span>
            </div>
          ) : (
            <div className="w-full py-2.5 px-4 bg-[#361300] rounded-xl text-orange-200/80 text-xs border border-[#6E2900]">
              No one guessed this track in time!
            </div>
          )}

          {/* Full Audio Player to enjoy */}
          <div className="w-full max-w-md pt-2">
            <AudioPlayer
              previewUrl={revealedTrack.previewUrl}
              source={revealedTrack.source}
              youtubeId={revealedTrack.youtubeId}
              isPlaying={true}
              showEqualizer={false}
              showControls={true}
            />
          </div>

          {/* Host Next Round Button */}
          {currentPlayer.isHost ? (
            <button
              id="game-host-next-round-btn"
              onClick={onHostNextRound}
              className="mt-2 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-[#FF7700] hover:from-amber-300 hover:to-orange-500 text-stone-950 font-black rounded-xl shadow-lg shadow-black/25 active:scale-95 transition-all cursor-pointer"
            >
              <span>Next Round</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <p className="text-xs text-orange-200/70 font-mono">
              Waiting for host to trigger the next track...
            </p>
          )}
        </div>

        {/* Interim Leaderboard */}
        <div className="w-full max-w-xl">
          <Leaderboard
            players={players}
            currentUserId={currentPlayer.id}
            showRoundStatus={false}
          />
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
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-widest border border-amber-400/40">
            <Trophy className="w-4 h-4" /> Tournament Results
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Match Champions!
          </h2>
          <p className="text-orange-200 text-sm">
            All rounds completed. Here is the final podium standing:
          </p>
        </div>

        {/* 3D-Style Podium Standings */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-lg pt-8 pb-4">
          {/* 2nd Place */}
          {second ? (
            <div className="flex-1 flex flex-col items-center gap-2">
              <span className="text-2xl">{second.avatar}</span>
              <span className="text-xs font-bold text-stone-200 truncate max-w-[80px]">
                {second.name}
              </span>
              <span className="text-[11px] font-mono text-orange-200">
                {second.score.toLocaleString()} pts
              </span>
              <div className="w-full h-24 bg-gradient-to-t from-[#361300] to-[#4A1C00] rounded-t-xl flex items-center justify-center font-black text-xl text-stone-200 border-t-2 border-[#8C3700] shadow-lg">
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
              <span className="text-xs font-mono font-bold text-amber-300">
                {first.score.toLocaleString()} pts
              </span>
              <div className="w-full h-36 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-2xl flex items-center justify-center font-black text-3xl text-stone-950 border-t-4 border-white shadow-xl shadow-black/25">
                1
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {third ? (
            <div className="flex-1 flex flex-col items-center gap-2">
              <span className="text-2xl">{third.avatar}</span>
              <span className="text-xs font-bold text-stone-200 truncate max-w-[80px]">
                {third.name}
              </span>
              <span className="text-[11px] font-mono text-orange-200">
                {third.score.toLocaleString()} pts
              </span>
              <div className="w-full h-18 bg-gradient-to-t from-[#2E1000] to-[#361300] rounded-t-xl flex items-center justify-center font-black text-lg text-amber-500 border-t-2 border-[#6E2900] shadow-md">
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
            className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-400 to-[#FF7700] hover:from-amber-300 hover:to-orange-500 text-stone-950 font-black rounded-xl shadow-lg shadow-black/25 active:scale-95 transition-all cursor-pointer"
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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 flex flex-col gap-5">
      {/* Top Banner: Round Tracker & Recent Scorer Notification */}
      <div className="flex items-center justify-between gap-3 bg-[#471C00]/90 border border-[#8C3700]/70 rounded-xl px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-orange-200">
            Round
          </span>
          <span className="text-base font-black text-white font-mono">
            {roundIndex} / {totalRounds}
          </span>
        </div>

        {/* Realtime Notification of other players scoring */}
        {recentScorer && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 text-amber-200 rounded-full text-xs font-semibold animate-pulse border border-amber-400/40">
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {recentScorer.name} got it! (+{recentScorer.points} pts)
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 font-mono text-xs text-orange-200">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>{roundTimeRemaining}s remaining</span>
        </div>
      </div>

      {/* Main Grid: Audio & Guessing (col-span-7) + Live Scoreboard (col-span-5) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: Audio Player & Input */}
        <div className="md:col-span-7 flex flex-col gap-5">
          {/* Decaying Score Gauge Banner */}
          <div className="bg-gradient-to-r from-[#4A1C00] via-[#5C2300] to-[#4A1C00] border border-[#CC5500]/60 rounded-2xl p-5 shadow-2xl flex flex-col items-center text-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-300 font-semibold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" /> Available Points Right Now
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-sm">
              {availableScore.toLocaleString()}
              <span className="text-sm font-sans font-semibold text-orange-200 ml-1">pts</span>
            </div>

            {/* Time progress bar */}
            <div className="w-full bg-[#2E1000] border border-[#6E2900] h-2 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-[#FF7700] to-amber-300 transition-all duration-100"
                style={{ width: `${(roundTimeRemaining / 30) * 100}%` }}
              />
            </div>
          </div>

          {/* Synchronized Drift-Aware Audio Player */}
          {currentRoundPayload && (
            <div className="bg-[#471C00]/95 border border-[#8C3700]/70 rounded-2xl p-4 shadow-2xl">
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
              <div className="w-full py-4 px-5 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl flex items-center justify-center gap-3 text-emerald-200 font-bold text-center shadow-lg animate-in zoom-in-95">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-base sm:text-lg">Solved! Points Locked In!</div>
                  <div className="text-xs font-medium text-emerald-300/80 mt-0.5">
                    Sit back and enjoy the track while other players finish guessing.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <AutocompleteInput
                  onSelectTrack={(t) => handleGuessSubmit(`${t.title} - ${t.artist}`)}
                  onSubmitGuess={handleGuessSubmit}
                  disabled={hasGuessedCorrect || roundTimeRemaining <= 0}
                  placeholder="Type song title or artist..."
                  autoFocus={true}
                  genreId={currentRoundPayload?.track?.category}
                />

                {guessFeedback && (
                  <div
                    className={`text-xs text-center font-semibold py-1.5 px-3 rounded-lg ${
                      guessFeedback.startsWith('Correct')
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
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
