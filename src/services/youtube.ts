import { Track } from '../types/game';
import { VERIFIED_YOUTUBE_TRACKS } from './youtubeTracks';

/**
 * The ONLY 3 genres that must use the YouTube API per user requirement:
 * 1. Anime Opening
 * 2. Anime OST
 * 3. Videogames OST
 */
export const YOUTUBE_GENRE_IDS = ['anime_opening', 'anime_ost', 'videogames_ost'] as const;

export type YouTubeGenreId = typeof YOUTUBE_GENRE_IDS[number];

/**
 * Checks whether a given genre is one of the 3 designated YouTube genres.
 */
export function isYouTubeGenre(genreId?: string | null): boolean {
  if (!genreId) return false;
  return YOUTUBE_GENRE_IDS.includes(genreId as YouTubeGenreId);
}

/**
 * Extracts an 11-character YouTube video ID from a URL, embed URL, or direct ID.
 */
export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();

  // If already pure 11 char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // If prefixed with yt_ (e.g. yt_ZRtdQ81jPUQ)
  if (clean.startsWith('yt_') && clean.length === 14) {
    return clean.slice(3);
  }

  // Standard YouTube URL formats
  const match = clean.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Fetches tracks for an Anime Opening, Anime OST, or Videogames OST genre using YouTube.
 */
export async function getYouTubeTracksForGenre(genreId: string, count: number = 5): Promise<Track[]> {
  const matchingPool = VERIFIED_YOUTUBE_TRACKS.filter((t) => t.category === genreId);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`/api/youtube/genre?genreId=${encodeURIComponent(genreId)}&count=${count}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        return data.tracks;
      }
    }
  } catch (err) {
    console.warn('YouTube API genre endpoint fallback to verified local catalog:', err);
  }

  // High-availability fallback from verified YouTube tracks
  const pool = matchingPool.length > 0 ? matchingPool : VERIFIED_YOUTUBE_TRACKS;
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
}

/**
 * Searches tracks via the YouTube API for anime / videogame songs (remixes excluded).
 */
export async function searchYouTubeTracks(query: string, limit: number = 10, genreId?: string): Promise<Track[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const params = new URLSearchParams({
      query: trimmed,
      limit: String(limit),
      genre: genreId || '',
    });

    const res = await fetch(`/api/youtube/search?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        return data.tracks;
      }
    }
  } catch (err) {
    console.warn('YouTube API search endpoint fallback to local verified tracks:', err);
  }

  // Local search against verified YouTube tracks catalog
  return VERIFIED_YOUTUBE_TRACKS.filter((t) => {
    if (genreId && t.category && t.category !== genreId) {
      // Prioritize same genre if supplied
      return false;
    }
    return (
      t.title.toLowerCase().includes(trimmed) ||
      t.artist.toLowerCase().includes(trimmed) ||
      (t.album && t.album.toLowerCase().includes(trimmed))
    );
  }).slice(0, limit);
}
