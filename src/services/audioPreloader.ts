import { Track } from '../types/game';

// In-memory cache for preloaded and buffered HTMLAudioElements
const audioCache = new Map<string, HTMLAudioElement>();

// Max cached elements to prevent unbounded memory usage
const MAX_CACHED_ELEMENTS = 10;

/**
 * Preloads and buffers a track's audio before playback starts.
 * For HTML5 audio (iTunes, mp3, m4a), waits for 'canplaythrough' or 'canplay'.
 * For YouTube, ensures the YouTube Iframe API is ready.
 * Resolves with true if successfully buffered, or false if safety timeout/error occurred.
 */
export function preloadAndBufferTrack(track: Track): Promise<boolean> {
  return new Promise((resolve) => {
    if (!track || !track.previewUrl) {
      resolve(false);
      return;
    }

    const isYouTube =
      track.source === 'youtube' ||
      Boolean(track.youtubeId) ||
      track.previewUrl.includes('youtube.com') ||
      track.previewUrl.includes('youtu.be') ||
      track.previewUrl.startsWith('yt_');

    if (isYouTube) {
      // For YouTube, ensure Iframe API script is loaded
      if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
        resolve(true);
        return;
      }
      // Load YouTube API if needed
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript && typeof document !== 'undefined') {
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
      // YouTube videos stream dynamically; resolve within 1s once API is ready
      const checkYt = window.setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkYt);
          resolve(true);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkYt);
        resolve(true);
      }, 1500);
      return;
    }

    // Check if we already have an existing buffered element for this URL
    const existing = audioCache.get(track.previewUrl);
    if (existing && existing.readyState >= 3) {
      // HAVE_FUTURE_DATA (3) or HAVE_ENOUGH_DATA (4)
      resolve(true);
      return;
    }

    // Create a new Audio element to preload and buffer into cache
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = track.previewUrl;

    let isResolved = false;

    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
    };

    const finish = (success: boolean) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      if (success) {
        // Enforce cache limit
        if (audioCache.size >= MAX_CACHED_ELEMENTS) {
          const oldestKey = audioCache.keys().next().value;
          if (oldestKey) {
            const oldAudio = audioCache.get(oldestKey);
            if (oldAudio) {
              oldAudio.pause();
              oldAudio.src = '';
            }
            audioCache.delete(oldestKey);
          }
        }
        audioCache.set(track.previewUrl, audio);
      }
      resolve(success);
    };

    const onCanPlay = () => {
      finish(true);
    };

    const onError = () => {
      // If error occurs, do not block the game indefinitely
      finish(false);
    };

    audio.addEventListener('canplaythrough', onCanPlay);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);

    // Safety timeout: max 3.5 seconds so slow connections do not block the game
    setTimeout(() => {
      finish(audio.readyState >= 2);
    }, 3500);

    // Trigger load
    try {
      audio.load();
    } catch {
      finish(false);
    }
  });
}

/**
 * Retrieves the preloaded, buffered HTMLAudioElement for a given URL if available.
 */
export function getPreloadedAudio(previewUrl: string): HTMLAudioElement | null {
  if (!previewUrl) return null;
  const audio = audioCache.get(previewUrl);
  if (audio && audio.readyState >= 2) {
    return audio;
  }
  return null;
}

/**
 * Clears cached audio elements to free resources.
 */
export function clearPreloadedAudio(previewUrl?: string): void {
  if (previewUrl) {
    const audio = audioCache.get(previewUrl);
    if (audio) {
      audio.pause();
      audio.src = '';
      audioCache.delete(previewUrl);
    }
  } else {
    audioCache.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    audioCache.clear();
  }
}
