import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Youtube, Music } from 'lucide-react';
import { extractYouTubeId } from '../services/youtube';

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

  useEffect(() => {
    startFromSecondsRef.current = startFromSeconds;
    if (!isPlaying) {
      if (isYouTube && ytPlayerRef.current?.seekTo) {
        try {
          ytPlayerRef.current.seekTo(startFromSeconds, true);
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = startFromSeconds;
      }
      setCurrentTime(startFromSeconds);
    }
  }, [startFromSeconds, isPlaying, isYouTube]);

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

      // 1. Single Player: Stop snippet when reaching max seconds
      if (maxSec && current >= maxSec) {
        const resetTo = startFromSecondsRef.current || 0;
        if (isYouTube && ytPlayerRef.current) {
          try {
            ytPlayerRef.current.pauseVideo();
            ytPlayerRef.current.seekTo(resetTo, true);
          } catch {}
        } else if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = resetTo;
        }

        setCurrentTime(resetTo);
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
          if (Math.abs(current - expected) > 0.5) {
            if (isYouTube && ytPlayerRef.current) {
              try {
                ytPlayerRef.current.seekTo(expected, true);
              } catch {}
            } else if (audioRef.current) {
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

    const audio = new Audio(previewUrl);
    audio.preload = 'auto';
    audio.volume = isMutedRef.current ? 0 : volumeRef.current;
    audio.currentTime = initialSec;
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 30);
    };

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
      audio.src = '';
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
    const expected = (Date.now() - synchronizedStartTime) / 1000;
    if (expected >= 0 && expected < 30) {
      if (isYouTube && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.seekTo(expected, true);
          ytPlayerRef.current.playVideo();
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = expected;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [synchronizedStartTime, isYouTube]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (isYouTube) {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      try {
        const state = yt.getPlayerState();
        if (state === 1) {
          yt.pauseVideo();
        } else {
          const maxSec = maxPlaySecondsRef.current;
          const minSec = startFromSecondsRef.current || 0;
          const cur = yt.getCurrentTime() || 0;
          if (maxSec && cur >= maxSec) {
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
      if (maxSec && audio.currentTime >= maxSec) {
        audio.currentTime = minSec;
        setCurrentTime(minSec);
      } else if (audio.currentTime < minSec) {
        audio.currentTime = minSec;
        setCurrentTime(minSec);
      }
      audio.play().catch(() => {});
    } else {
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

  const currentLimit = maxPlaySeconds || duration;
  const progressPercent = Math.min(100, (currentTime / currentLimit) * 100);

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
        <div className="flex items-center justify-between px-4 py-2 bg-[#361300] rounded-xl border border-[#6E2900]">
          <div className="flex items-center gap-1.5 h-8">
            {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75].map((height, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-300 ${
                  isPlaying
                    ? 'bg-gradient-to-t from-amber-400 to-[#FF7700] animate-pulse'
                    : 'bg-[#5A2400]'
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
          <div className="flex items-center gap-1">
            {isYouTube ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-950/70 text-red-300 border border-red-800/60 shadow-sm">
                <Youtube className="w-3 h-3 text-red-500" />
                <span>YouTube Audio</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-stone-900/70 text-stone-300 border border-[#6E2900] shadow-sm">
                <Music className="w-3 h-3 text-amber-400" />
                <span>iTunes Audio</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="relative h-2.5 w-full bg-[#2E1000] border border-[#6E2900] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-[#FF7700] to-amber-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-orange-200/90 px-0.5">
          <span>{currentTime.toFixed(1)}s</span>
          <span>{currentLimit.toFixed(1)}s max</span>
        </div>
      </div>

      {/* Player Controls */}
      {showControls && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              id="audio-play-toggle-btn"
              type="button"
              onClick={togglePlay}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-r from-amber-400 to-[#FF7700] hover:from-amber-300 hover:to-orange-500 text-stone-950 shadow-lg shadow-black/25 active:scale-95 transition-all cursor-pointer font-black"
              title={isPlaying ? 'Pause Snippet' : 'Play Snippet'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
            </button>

            {maxPlaySeconds && (
              <button
                id="audio-restart-btn"
                type="button"
                onClick={restartSnippet}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-[#361300] hover:bg-[#521E00] text-stone-200 hover:text-white border border-[#8C3700] transition-colors cursor-pointer"
                title="Restart snippet"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {extraControls}
          </div>

          {/* Right Controls & Volume Slider */}
          <div className="flex items-center gap-2 sm:gap-3">
            {rightControls}

            <div className="flex items-center gap-2">
              <button
                id="audio-mute-btn"
                type="button"
                onClick={toggleMute}
                className="text-orange-200 hover:text-white transition-colors cursor-pointer"
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
                className="w-16 sm:w-20 h-1.5 accent-amber-400 bg-[#2E1000] rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {hasError && (
        <p className="text-xs text-amber-300 text-center">
          Audio stream is buffering or connecting... click Play to listen.
        </p>
      )}
    </div>
  );
};
