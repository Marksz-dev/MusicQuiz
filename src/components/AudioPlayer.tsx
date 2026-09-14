import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Youtube, Music } from 'lucide-react';
import { extractYouTubeId } from '../services/youtube';
import { getPreloadedAudio } from '../services/audioPreloader';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export interface AudioPlayerProps {
  previewUrl: string;
  source?: 'itunes' | 'youtube';
  youtubeId?: string;
  maxPlaySeconds?: number; // In Single Player Heardle mode (e.g. 1s, 2s, 4s, 7s, 11s, 16s)
  startFromSeconds?: number; // Starting offset (0s or previous unlocked duration)
  synchronizedStartTime?: number; // In Multiplayer mode (Epoch ms)
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  onSnippetEnded?: () => void;
  showEqualizer?: boolean;
  showControls?: boolean;
  autoPlay?: boolean;
  className?: string;
  extraControls?: React.ReactNode;
  rightControls?: React.ReactNode;
}

// Load YouTube Iframe API once
let isYtApiLoading = false;
let isYtApiReady = false;
const ytReadyCallbacks: Array<() => void> = [];

// Session-persistent volume and mute settings
const VOLUME_SESSION_KEY = 'songspot_audio_volume';
const MUTED_SESSION_KEY = 'songspot_audio_muted';

let sessionVolume = 0.85;
let sessionMuted = false;

if (typeof window !== 'undefined') {
  try {
    const savedVol = sessionStorage.getItem(VOLUME_SESSION_KEY) || localStorage.getItem(VOLUME_SESSION_KEY);
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        sessionVolume = parsed;
      }
    }
    const savedMute = sessionStorage.getItem(MUTED_SESSION_KEY) || localStorage.getItem(MUTED_SESSION_KEY);
    if (savedMute !== null) {
      sessionMuted = savedMute === 'true';
    }
  } catch {}
}

function ensureYouTubeIframeApi(callback: () => void) {
  if (typeof window === 'undefined') return;

  if (window.YT && window.YT.Player) {
    callback();
    return;
  }

  ytReadyCallbacks.push(callback);

  if (isYtApiLoading) return;
  isYtApiLoading = true;

  const prevHandler = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    isYtApiReady = true;
    if (typeof prevHandler === 'function') prevHandler();
    while (ytReadyCallbacks.length > 0) {
      const cb = ytReadyCallbacks.shift();
      cb?.();
    }
  };

  const existingScript = document.getElementById('youtube-iframe-api-script');
  if (!existingScript) {
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(tag, firstScript);
    } else {
      document.head.appendChild(tag);
    }
  }
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  previewUrl,
  source,
  youtubeId: explicitYoutubeId,
  maxPlaySeconds,
  startFromSeconds = 0,
  synchronizedStartTime,
  isPlaying: externalIsPlaying,
  onPlayStateChange,
  onSnippetEnded,
  showEqualizer = true,
  showControls = true,
  autoPlay = false,
  className = '',
  extraControls,
  rightControls,
}) => {
  // Determine if this track is YouTube-sourced
  const parsedYtId = explicitYoutubeId || extractYouTubeId(previewUrl);
  const isYouTube =
    source === 'youtube' ||
    Boolean(parsedYtId) ||
    previewUrl.includes('youtube.com') ||
    previewUrl.includes('youtu.be') ||
    previewUrl.startsWith('yt_');

  const ytVideoId = parsedYtId || (isYouTube ? previewUrl.replace(/^yt_/, '') : null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startFromSeconds);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(() => sessionVolume);
  const [isMuted, setIsMuted] = useState(() => sessionMuted);
  const [hasError, setHasError] = useState(false);
  const [isYtReady, setIsYtReady] = useState(false);

  // Keep volume and mute refs synchronized for player setup events
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const animFrameRef = useRef<number | null>(null);
  const prevExternalIsPlayingRef = useRef<boolean | undefined>(externalIsPlaying);

  // Synchronized prop refs so callbacks and loop ticks always access the latest values
  const maxPlaySecondsRef = useRef(maxPlaySeconds);
  const startFromSecondsRef = useRef(startFromSeconds);
  const onPlayStateChangeRef = useRef(onPlayStateChange);
  const onSnippetEndedRef = useRef(onSnippetEnded);
  const synchronizedStartTimeRef = useRef(synchronizedStartTime);

  useEffect(() => {
    maxPlaySecondsRef.current = maxPlaySeconds;
  }, [maxPlaySeconds]);

  const prevStartFromSecondsRef = useRef(startFromSeconds);

  useEffect(() => {
    startFromSecondsRef.current = startFromSeconds;
    if (prevStartFromSecondsRef.current !== startFromSeconds) {
      prevStartFromSecondsRef.current = startFromSeconds;
      if (isYouTube && ytPlayerRef.current?.seekTo) {
        try {
          ytPlayerRef.current.seekTo(startFromSeconds, true);
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = startFromSeconds;
      }
      setCurrentTime(startFromSeconds);
    }
  }, [startFromSeconds, isYouTube]);

  useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onPlayStateChange]);

  useEffect(() => {
    onSnippetEndedRef.current = onSnippetEnded;
  }, [onSnippetEnded]);

  useEffect(() => {
    synchronizedStartTimeRef.current = synchronizedStartTime;
  }, [synchronizedStartTime]);

  const stopMonitor = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const startMonitor = () => {
    stopMonitor();

    const tick = () => {
      let current = 0;
      let active = false;

      if (isYouTube) {
        const yt = ytPlayerRef.current;
        if (!yt || typeof yt.getPlayerState !== 'function') {
          animFrameRef.current = null;
          return;
        }
        const state = yt.getPlayerState();
        // 1 = PLAYING, 3 = BUFFERING
        active = state === 1 || state === 3;
        if (!active) {
          animFrameRef.current = null;
          return;
        }
        try {
          current = yt.getCurrentTime() || 0;
        } catch {
          current = 0;
        }
      } else {
        const audio = audioRef.current;
        if (!audio || audio.paused) {
          animFrameRef.current = null;
          return;
        }
        active = true;
        current = audio.currentTime;
      }

      const maxSec = maxPlaySecondsRef.current;

      // 1. Single Player: Stop snippet when reaching max seconds while keeping position reached
      if (maxSec && current >= maxSec) {
        if (isYouTube && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.pauseVideo();
            ytPlayerRef.current.seekTo(maxSec, true);
          } catch {}
        } else if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = maxSec;
        }

        setCurrentTime(maxSec);
        setIsPlaying(false);
        prevExternalIsPlayingRef.current = false;
        onPlayStateChangeRef.current?.(false);
        onSnippetEndedRef.current?.();
        animFrameRef.current = null;
        return;
      }

      setCurrentTime(current);

      // 2. Multiplayer: Synchronize playback against epoch timestamp
      const syncTime = synchronizedStartTimeRef.current;
      if (syncTime) {
        const expected = (Date.now() - syncTime) / 1000;
        if (expected >= 0 && expected < 30) {
          // Never skip the first seconds of the song!
          // Only correct drift if we are well into the track (expected >= 3s)
          // or if drift is catastrophic (> 3.5s). This prevents guests from skipping the intro.
          const tolerance = expected < 3 ? 3.5 : 1.2;
          if (Math.abs(current - expected) > tolerance) {
            if (isYouTube && ytPlayerRef.current) {
              try {
                ytPlayerRef.current.seekTo(expected, true);
              } catch {}
            } else if (audioRef.current && audioRef.current.readyState >= 3) {
              audioRef.current.currentTime = expected;
            }
          }
        } else if (expected >= 30) {
          if (isYouTube && ytPlayerRef.current) {
            try {
              ytPlayerRef.current.pauseVideo();
            } catch {}
          } else if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
          animFrameRef.current = null;
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  // ==========================================
  // 1. YouTube Player Initializer
  // ==========================================
  useEffect(() => {
    if (!isYouTube || !ytVideoId) return;

    let isSubscribed = true;
    const initialSec = startFromSecondsRef.current || 0;

    setIsYtReady(false);
    setHasError(false);
    setCurrentTime(initialSec);
    setIsPlaying(false);

    ensureYouTubeIframeApi(() => {
      if (!isSubscribed || !ytContainerRef.current) return;

      try {
        // Clean previous player instance if any
        if (ytPlayerRef.current?.destroy) {
          try {
            ytPlayerRef.current.destroy();
          } catch {}
          ytPlayerRef.current = null;
        }

        // Create container element for iframe
        const playerId = `yt-player-${Math.random().toString(36).slice(2, 9)}`;
        const hostElem = document.createElement('div');
        hostElem.id = playerId;
        ytContainerRef.current.innerHTML = '';
        ytContainerRef.current.appendChild(hostElem);

        ytPlayerRef.current = new window.YT.Player(playerId, {
          videoId: ytVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              setIsYtReady(true);
              setDuration(30);
              try {
                const effectiveMuted = isMutedRef.current;
                const effectiveVolume = volumeRef.current;
                event.target.setVolume(effectiveMuted ? 0 : effectiveVolume * 100);
                event.target.seekTo(initialSec, true);
                if (autoPlay || externalIsPlaying) {
                  event.target.playVideo();
                }
              } catch (e) {
                console.warn('YT ready config error:', e);
              }
            },
            onStateChange: (event: any) => {
              if (!isSubscribed) return;
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
              if (event.data === 1) {
                setIsPlaying(true);
                onPlayStateChangeRef.current?.(true);
                startMonitor();
              } else if (event.data === 2) {
                setIsPlaying(false);
                onPlayStateChangeRef.current?.(false);
                stopMonitor();
              } else if (event.data === 0) {
                const resetTo = startFromSecondsRef.current || 0;
                try {
                  event.target.seekTo(resetTo, true);
                } catch {}
                setCurrentTime(resetTo);
                setIsPlaying(false);
                onPlayStateChangeRef.current?.(false);
                onSnippetEndedRef.current?.();
                stopMonitor();
              }
            },
            onError: (err: any) => {
              console.warn('YouTube Player error code:', err.data);
              setHasError(true);
            },
          },
        });
      } catch (err) {
        console.error('Failed to instantiate YouTube player:', err);
        setHasError(true);
      }
    });

    return () => {
      isSubscribed = false;
      stopMonitor();
      if (ytPlayerRef.current?.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
      if (ytContainerRef.current) {
        ytContainerRef.current.innerHTML = '';
      }
    };
  }, [isYouTube, ytVideoId]);

  // ==========================================
  // 2. HTML5 Audio Initializer (iTunes tracks)
  // ==========================================
  useEffect(() => {
    if (isYouTube || !previewUrl) return;

    const initialSec = startFromSecondsRef.current || 0;
    setHasError(false);
    setCurrentTime(initialSec);
    setIsPlaying(false);

    const cachedAudio = getPreloadedAudio(previewUrl);
    const audio = cachedAudio || new Audio(previewUrl);
    audio.preload = 'auto';
    audio.volume = isMutedRef.current ? 0 : volumeRef.current;
    audio.currentTime = initialSec;
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 30);
    };

    if (audio.readyState >= 1) {
      setDuration(audio.duration || 30);
    }

    const onError = (e: any) => {
      console.warn('Audio preview error:', e);
      setHasError(true);
    };

    const onAudioPlay = () => {
      setIsPlaying(true);
      onPlayStateChangeRef.current?.(true);
      startMonitor();
    };

    const onAudioPause = () => {
      setIsPlaying(false);
      onPlayStateChangeRef.current?.(false);
      stopMonitor();
    };

    const onAudioEnded = () => {
      const resetTo = startFromSecondsRef.current || 0;
      audio.currentTime = resetTo;
      setCurrentTime(resetTo);
      setIsPlaying(false);
      onPlayStateChangeRef.current?.(false);
      onSnippetEndedRef.current?.();
      stopMonitor();
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onAudioPlay);
    audio.addEventListener('pause', onAudioPause);
    audio.addEventListener('ended', onAudioEnded);

    if (autoPlay || externalIsPlaying) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onAudioPlay);
      audio.removeEventListener('pause', onAudioPause);
      audio.removeEventListener('ended', onAudioEnded);
      stopMonitor();
      audio.pause();
      if (!cachedAudio) {
        audio.src = '';
      }
      audioRef.current = null;
    };
  }, [isYouTube, previewUrl]);

  // External play state synchronization
  useEffect(() => {
    if (externalIsPlaying === undefined) return;

    if (prevExternalIsPlayingRef.current !== externalIsPlaying) {
      prevExternalIsPlayingRef.current = externalIsPlaying;

      if (isYouTube) {
        const yt = ytPlayerRef.current;
        if (!yt) return;
        try {
          if (externalIsPlaying) {
            const maxSec = maxPlaySecondsRef.current;
            if (maxSec && (yt.getCurrentTime?.() || 0) >= maxSec) {
              yt.seekTo(0, true);
              setCurrentTime(0);
            }
            yt.playVideo();
          } else {
            yt.pauseVideo();
          }
        } catch {}
      } else {
        const audio = audioRef.current;
        if (!audio) return;
        if (externalIsPlaying) {
          const maxSec = maxPlaySecondsRef.current;
          if (maxSec && audio.currentTime >= maxSec) {
            audio.currentTime = 0;
            setCurrentTime(0);
          }
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      }
    }
  }, [externalIsPlaying, isYouTube]);

  // Synchronized playback trigger for multiplayer
  useEffect(() => {
    if (!synchronizedStartTime) return;

    let timeoutId: number | null = null;

    const playAtTime = () => {
      const now = Date.now();
      const expected = (now - synchronizedStartTime) / 1000;
      if (expected >= 0 && expected < 30) {
        // If the round just started (within the first 2.5 seconds), ALWAYS play from 0.0s
        // so guests do not skip the opening notes/intro of the song
        const targetPos = expected > 2.5 ? expected : 0;
        if (isYouTube && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.seekTo(targetPos, true);
            ytPlayerRef.current.playVideo();
          } catch {}
        } else if (audioRef.current) {
          audioRef.current.currentTime = targetPos;
          audioRef.current.play().catch(() => {});
        }
      }
    };

    const diff = synchronizedStartTime - Date.now();
    if (diff > 0) {
      // Start time is in the future (e.g. at the end of countdown)
      timeoutId = window.setTimeout(playAtTime, diff);
    } else {
      // Start time is already reached or in progress
      playAtTime();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [synchronizedStartTime, isYouTube]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (isYouTube) {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      try {
        const state = yt.getPlayerState();
        if (state === 1) {
          // Pause and keep the position reached
          yt.pauseVideo();
        } else {
          const maxSec = maxPlaySecondsRef.current;
          const minSec = startFromSecondsRef.current || 0;
          const cur = yt.getCurrentTime() || 0;
          // If already at or beyond current max limit, restart from minSec to replay
          if (maxSec && cur >= maxSec - 0.05) {
            yt.seekTo(minSec, true);
            setCurrentTime(minSec);
          } else if (cur < minSec) {
            yt.seekTo(minSec, true);
            setCurrentTime(minSec);
          }
          yt.playVideo();
        }
      } catch (err) {
        console.warn('YT toggle error:', err);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      const maxSec = maxPlaySecondsRef.current;
      const minSec = startFromSecondsRef.current || 0;
      // If already at or beyond current max limit, restart from minSec to replay
      if (maxSec && audio.currentTime >= maxSec - 0.05) {
        audio.currentTime = minSec;
        setCurrentTime(minSec);
      } else if (audio.currentTime < minSec) {
        audio.currentTime = minSec;
        setCurrentTime(minSec);
      }
      audio.play().catch(() => {});
    } else {
      // Pause and keep the position reached
      audio.pause();
    }
  };

  // Restart snippet from start
  const restartSnippet = () => {
    if (isYouTube) {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      try {
        yt.pauseVideo();
        yt.seekTo(0, true);
        setCurrentTime(0);
        yt.playVideo();
      } catch {}
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play().catch((e) => {
      console.warn('Playback interrupted:', e);
    });
  };

  // Mute toggle
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    sessionMuted = newMuted;
    try {
      sessionStorage.setItem(MUTED_SESSION_KEY, String(newMuted));
      localStorage.setItem(MUTED_SESSION_KEY, String(newMuted));
    } catch {}

    if (isYouTube && ytPlayerRef.current) {
      try {
        if (newMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(volume * 100);
        }
      } catch {}
    } else if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume;
    }
  };

  // Volume change slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(false);
    sessionVolume = newVol;
    sessionMuted = false;
    try {
      sessionStorage.setItem(VOLUME_SESSION_KEY, String(newVol));
      localStorage.setItem(VOLUME_SESSION_KEY, String(newVol));
      sessionStorage.setItem(MUTED_SESSION_KEY, 'false');
      localStorage.setItem(MUTED_SESSION_KEY, 'false');
    } catch {}

    if (isYouTube && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(newVol * 100);
      } catch {}
    } else if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const currentLimit = Math.max(0.1, maxPlaySeconds || duration);
  const progressPercent = Math.min(100, Math.max(0, (currentTime / currentLimit) * 100));

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Hidden container for YouTube Player (runs audio off-screen so answer is not visually spoiled) */}
      <div
        ref={ytContainerRef}
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-1 h-1 pointer-events-none opacity-0 overflow-hidden"
      />

      {/* Visual Equalizer / Sound Waves */}
      {showEqualizer && (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-zinc-900 rounded-xl border border-zinc-700/80 overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-1.5 h-8 overflow-hidden">
            {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75].map((height, i) => (
              <div
                key={i}
                className={`w-1 sm:w-1.5 rounded-full transition-all duration-300 ${
                  isPlaying
                    ? 'bg-gradient-to-t from-rose-500 via-pink-500 to-orange-400 animate-pulse'
                    : 'bg-zinc-700'
                }`}
                style={{
                  height: isPlaying ? `${height}%` : '25%',
                  animationDelay: `${(i % 6) * 0.12}s`,
                  animationDuration: `${0.8 + (i % 3) * 0.2}s`,
                }}
              />
            ))}
          </div>

          {/* Audio Source Badge */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {isYouTube ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-red-950/70 text-red-300 border border-red-800/60 shadow-sm whitespace-nowrap">
                <Youtube className="w-3 h-3 text-red-500" />
                <span>YouTube Audio</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 shadow-sm whitespace-nowrap">
                <Music className="w-3 h-3 text-rose-400" />
                <span>iTunes Audio</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar (pure visual playback indicator, non-interactive) */}
      <div className="space-y-1.5 select-none">
        <div
          id="audio-progress-bar-container"
          className="relative h-2.5 w-full bg-zinc-900 border border-zinc-700 rounded-full overflow-hidden pointer-events-none"
        >
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 rounded-full will-change-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-zinc-400 px-0.5">
          <span>{currentTime.toFixed(1)}s</span>
          <span>{currentLimit.toFixed(1)}s max</span>
        </div>
      </div>

      {/* Player Controls */}
      {showControls && (
        <div className="flex items-center justify-between gap-2 sm:gap-3 pt-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="audio-play-toggle-btn"
              type="button"
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 hover:from-rose-400 hover:to-orange-300 text-white shadow-lg shadow-rose-950/40 active:scale-95 transition-all cursor-pointer font-black shrink-0"
              title={isPlaying ? 'Pause Snippet' : 'Play Snippet'}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 fill-current" />}
            </button>

            {maxPlaySeconds && (
              <button
                id="audio-restart-btn"
                type="button"
                onClick={restartSnippet}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer shrink-0"
                title="Restart snippet"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {extraControls}
          </div>

          {/* Right Controls & Volume Slider */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {rightControls}

            <div className="flex items-center sm:gap-2">
              <button
                id="audio-mute-btn"
                type="button"
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                id="audio-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="hidden sm:block w-20 h-1.5 accent-rose-500 bg-zinc-900 rounded-lg cursor-pointer"
                title="Volume"
              />
            </div>
          </div>
        </div>
      )}

      {hasError && (
        <p className="text-xs text-rose-400 text-center">
          Audio stream is buffering or connecting... click Play to listen.
        </p>
      )}
    </div>
  );
};
