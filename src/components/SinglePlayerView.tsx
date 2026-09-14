import React, { useState, useEffect, useCallback } from 'react';
import { Play, Volume2, SkipForward, CheckCircle2, XCircle, RotateCcw, Award, Copy, Check, Music, Sparkles, Youtube } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Track, GuessAttempt, SinglePlayerStats } from '../types/game';
import { AudioPlayer } from './AudioPlayer';
import { AutocompleteInput } from './AutocompleteInput';
import { getTracksForGenre, GENRE_CATEGORIES, isCorrectGuess } from '../services/itunes';

const SNIPPET_DURATIONS = [1, 2, 4, 8, 16]; // 5 attempts Heardle progression in seconds
const MAX_ATTEMPTS = 5;
const STATS_STORAGE_KEY = 'songspot_singleplayer_stats';

export interface SinglePlayerViewProps {
  onOpenStats?: () => void;
}

export const SinglePlayerView: React.FC<SinglePlayerViewProps> = ({ onOpenStats }) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('pop_hits');
  const [targetTrack, setTargetTrack] = useState<Track | null>(null);
  const [attempts, setAttempts] = useState<GuessAttempt[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [isLoadingSong, setIsLoadingSong] = useState(true);
  const [copiedSong, setCopiedSong] = useState(false);

  // Load and save stats from localStorage
  const getStoredStats = (): SinglePlayerStats => {
    try {
      const data = localStorage.getItem(STATS_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  };

  const updateStats = useCallback((won: boolean, attemptCount: number) => {
    const stats = getStoredStats();
    stats.gamesPlayed += 1;

    if (won) {
      stats.gamesWon += 1;
      stats.currentStreak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.guessDistribution[attemptCount] = (stats.guessDistribution[attemptCount] || 0) + 1;
    } else {
      stats.currentStreak = 0;
    }
    stats.lastPlayedTimestamp = Date.now();

    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch a new random track
  const loadNewTrack = useCallback(async (genreId: string) => {
    setIsLoadingSong(true);
    setIsGameOver(false);
    setHasWon(false);
    setAttempts([]);

    try {
      const tracks = await getTracksForGenre(genreId, 6);
      if (tracks.length > 0) {
        // Pick one at random
        const chosen = tracks[Math.floor(Math.random() * tracks.length)];
        setTargetTrack(chosen);
      }
    } catch (err) {
      console.error('Failed to load track:', err);
    } finally {
      setIsLoadingSong(false);
    }
  }, []);

  useEffect(() => {
    loadNewTrack(selectedGenre);
  }, [selectedGenre, loadNewTrack]);

  // Current unlocked snippet length based on number of attempts made
  const currentAttemptIndex = attempts.length;
  const currentMaxDuration = SNIPPET_DURATIONS[Math.min(currentAttemptIndex, SNIPPET_DURATIONS.length - 1)];

  // Handling player guess
  const handleGuess = (guessText: string) => {
    if (!targetTrack || isGameOver || attempts.length >= MAX_ATTEMPTS) return;

    const correct = isCorrectGuess(guessText, targetTrack);
    const newAttempt: GuessAttempt = {
      attemptNumber: attempts.length + 1,
      guessText,
      isCorrect: correct,
      isSkipped: false,
      timestamp: Date.now(),
    };

    const nextAttempts = [...attempts, newAttempt];
    setAttempts(nextAttempts);

    if (correct) {
      setHasWon(true);
      setIsGameOver(true);
      updateStats(true, nextAttempts.length);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    } else if (nextAttempts.length >= MAX_ATTEMPTS) {
      setIsGameOver(true);
      updateStats(false, nextAttempts.length);
    }
  };

  // Handling skip
  const handleSkip = () => {
    if (!targetTrack || isGameOver || attempts.length >= MAX_ATTEMPTS) return;

    const newAttempt: GuessAttempt = {
      attemptNumber: attempts.length + 1,
      guessText: 'Skipped',
      isCorrect: false,
      isSkipped: true,
      timestamp: Date.now(),
    };

    const nextAttempts = [...attempts, newAttempt];
    setAttempts(nextAttempts);

    if (nextAttempts.length >= MAX_ATTEMPTS) {
      setIsGameOver(true);
      updateStats(false, nextAttempts.length);
    }
  };

  const copySongName = () => {
    if (!targetTrack) return;
    
    // Include song title, artist, and album if present
    let copyText = targetTrack.title;
    if (targetTrack.artist) {
      copyText += ` - ${targetTrack.artist}`;
    }
    if (targetTrack.album) {
      const albumClean = targetTrack.album.trim();
      if (albumClean.startsWith('(') && albumClean.endsWith(')')) {
        copyText += ` ${albumClean}`;
      } else {
        copyText += ` (${albumClean})`;
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copyText).then(() => {
        setCopiedSong(true);
        setTimeout(() => setCopiedSong(false), 2500);
      }).catch(() => {
        fallbackCopyText(copyText);
      });
    } else {
      fallbackCopyText(copyText);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSong(true);
      setTimeout(() => setCopiedSong(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col items-center">
      {/* Genre Selector Header */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-5 sm:mb-6 pb-3 sm:pb-4 border-b border-zinc-700/80">
        <div className="flex items-center gap-2 max-w-full">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-zinc-300 whitespace-nowrap">Genre:</span>
          <select
            id="singleplayer-genre-select"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            disabled={isLoadingSong}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs sm:text-sm font-medium rounded-xl px-2.5 sm:px-3 py-1.5 focus:outline-none focus:border-rose-500 cursor-pointer shadow-sm max-w-[140px] sm:max-w-none truncate"
          >
            {GENRE_CATEGORIES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <button
          id="singleplayer-new-song-btn"
          onClick={() => loadNewTrack(selectedGenre)}
          disabled={isLoadingSong}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer font-medium shrink-0 ml-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoadingSong ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap">New Song</span>
        </button>
      </div>

      {isLoadingSong ? (
        <div className="py-20 flex flex-col items-center gap-3 text-center px-4">
          <div className="w-10 h-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm font-medium">Fetching 30s track preview from iTunes...</p>
        </div>
      ) : targetTrack ? (
        <div className="w-full flex flex-col gap-5 sm:gap-6">
          {/* Segmented Timeline (1s, 2s, 4s, 8s, 16s) */}
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
              <span>Attempt {attempts.length} of {MAX_ATTEMPTS}</span>
              <span className="text-rose-400 font-bold">{currentMaxDuration}s Unlocked</span>
            </div>

            {/* Segmented visual progress blocks */}
            <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full h-2.5 sm:h-3">
              {SNIPPET_DURATIONS.map((dur, idx) => {
                const isUnlocked = idx <= currentAttemptIndex || isGameOver;
                const isCurrent = idx === currentAttemptIndex && !isGameOver;
                return (
                  <div
                    key={dur}
                    className={`relative rounded-full transition-all duration-200 overflow-hidden ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-rose-500 to-orange-400 shadow-sm'
                        : 'bg-zinc-900 border border-zinc-700'
                    } ${isCurrent ? 'ring-2 ring-rose-400' : ''}`}
                    title={`${dur} second snippet`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono px-1">
              {SNIPPET_DURATIONS.map((dur) => (
                <span key={dur}>{dur}s</span>
              ))}
            </div>
          </div>

          {/* Audio Player Controls */}
          <div className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-3.5 sm:p-5 shadow-xl">
            <AudioPlayer
              previewUrl={targetTrack.previewUrl}
              source={targetTrack.source}
              youtubeId={targetTrack.youtubeId}
              maxPlaySeconds={isGameOver ? 30 : currentMaxDuration}
              showEqualizer={true}
              showControls={true}
              extraControls={
                !isGameOver && (
                  <button
                    id="singleplayer-skip-btn"
                    type="button"
                    onClick={handleSkip}
                    disabled={attempts.length >= MAX_ATTEMPTS}
                    className="flex items-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white rounded-full text-xs font-semibold border border-zinc-700 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none shrink-0 whitespace-nowrap"
                    title="Skip to unlock more audio"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      Skip
                      {currentAttemptIndex < SNIPPET_DURATIONS.length - 1
                        ? ` (+${SNIPPET_DURATIONS[currentAttemptIndex + 1] - currentMaxDuration}s)`
                        : ''}
                    </span>
                  </button>
                )
              }
              rightControls={
                isGameOver && (
                  <button
                    id="singleplayer-play-next-top-btn"
                    type="button"
                    onClick={() => loadNewTrack(selectedGenre)}
                    className="flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-3.5 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white font-black rounded-full text-xs shadow-lg shadow-rose-950/40 active:scale-95 transition-all cursor-pointer whitespace-nowrap animate-in fade-in zoom-in-95 duration-200"
                    title="Play next song"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Next Song</span>
                  </button>
                )
              }
            />
          </div>

          {/* Game Outcome Card (Song Reveal & Stats) - Placed BEFORE the guesses as requested */}
          {isGameOver && (
            <div
              id="singleplayer-gameover-card"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-300"
            >
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  hasWon
                    ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}
              >
                {hasWon ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span>Correct - Fantastic Guess!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Better Luck Next Time!</span>
                  </>
                )}
              </div>

              {/* Album Art & Track Meta */}
              <div className="flex flex-col items-center gap-3">
                {targetTrack.artworkUrl ? (
                  <img
                    src={targetTrack.artworkUrl}
                    alt={targetTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl shadow-xl object-cover border border-zinc-700"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500">
                    <Music className="w-12 h-12" />
                  </div>
                )}

                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {targetTrack.title}
                  </h3>
                  <p className="text-rose-400 text-sm sm:text-base font-semibold">
                    {targetTrack.artist}
                  </p>
                  <p className="text-zinc-400 text-xs mt-1">
                    Album: {targetTrack.album} {targetTrack.releaseDate ? `(${targetTrack.releaseDate})` : ''}
                  </p>
                  {targetTrack.source === 'youtube' && (
                    <div className="mt-2 flex items-center justify-center">
                      <a
                        href={targetTrack.previewUrl}
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

              {/* Action Buttons */}
              <div className="flex items-center justify-center w-full pt-2">
                <button
                  id="singleplayer-copy-song-name-btn"
                  onClick={copySongName}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95"
                  title="Copy song name, artist, and album to clipboard"
                >
                  {copiedSong ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" />
                      <span>Copy Song Name</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Search / Guess Input - Placed ON TOP of Attempts as requested */}
          {!isGameOver && (
            <div className="w-full">
              <AutocompleteInput
                onSelectTrack={(t) => handleGuess(`${t.title} - ${t.artist}`)}
                onSubmitGuess={handleGuess}
                placeholder="Know the song? Type artist or title..."
                autoFocus={true}
                genreId={selectedGenre}
              />
            </div>
          )}

          {/* Guess Attempt Rows (5 slots) */}
          <div className="flex flex-col gap-2 w-full">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, idx) => {
              const attempt = attempts[idx];
              if (attempt) {
                return (
                  <div
                    key={idx}
                    id={`singleplayer-attempt-slot-${idx}`}
                    className={`flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all shadow-sm ${
                      attempt.isCorrect
                        ? 'bg-green-500/20 border-green-500/40 text-green-300'
                        : attempt.isSkipped
                        ? 'bg-zinc-900/80 border-zinc-700 text-zinc-400'
                        : 'bg-red-500/20 border-red-500/40 text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 truncate min-w-0 flex-1">
                      {attempt.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                      ) : attempt.isSkipped ? (
                        <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{attempt.guessText}</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-400 flex-shrink-0 ml-2">
                      {SNIPPET_DURATIONS[idx]}s
                    </span>
                  </div>
                );
              }

              // Empty Slot
              return (
                <div
                  key={idx}
                  id={`singleplayer-empty-slot-${idx}`}
                  className="flex items-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 text-zinc-500 text-xs sm:text-sm font-mono shadow-inner"
                >
                  Attempt {idx + 1}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
