import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { VERIFIED_YOUTUBE_TRACKS } from './src/services/youtubeTracks';

// Sanitize Supabase URL if provided with trailing /rest/v1/ or slashes
if (process.env.VITE_SUPABASE_URL) {
  try {
    process.env.VITE_SUPABASE_URL = new URL(process.env.VITE_SUPABASE_URL.trim()).origin;
  } catch {
    process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to detect and filter out remixes
function isRemix(title: string, channel: string = ''): boolean {
  const t = title.toLowerCase();
  const c = channel.toLowerCase();
  const remixRegex =
    /\b(re-?mix(ed|es)?|club\s+mix|extended\s+mix|dance\s+mix|dub\s+mix|disco\s+mix|house\s+mix|trance\s+mix|vip\s+(mix|edit)|mash-?up|bootleg|nightcore|daycore|slowed\s*(\+|and)?\s*reverb|speed(ed)?\s*up)\b/i;
  if (remixRegex.test(t)) return true;
  if (/[(\[][^)]*?\b(remix|re-mix|club\s+mix|extended\s+mix|dub\s+mix)\b[^)]*?[)\]]/i.test(title)) return true;
  if (remixRegex.test(c)) return true;
  return false;
}

// Clean title and artist extracted from YouTube video
function cleanYouTubeTrack(rawTitle: string, rawChannel: string) {
  let title = rawTitle
    .replace(/\[(Official|MV|Full|Non-Credit|Opening|Ending|OST|Audio|Music Video|HD|4K|Lyrics)[^\]]*\]/gi, '')
    .replace(/\((Official|MV|Full|Non-Credit|Opening|Ending|OST|Audio|Music Video|HD|4K|Lyrics)[^)]*\)/gi, '')
    .replace(/【[^】]*】/g, '')
    .trim();

  let artist = rawChannel.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();

  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  } else if (title.includes('「') && title.includes('」')) {
    const match = title.match(/(.*?)「(.*?)」/);
    if (match) {
      if (match[1].trim()) artist = match[1].trim();
      title = match[2].trim();
    }
  }

  return { title: title || rawTitle, artist: artist || rawChannel };
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. YouTube Search API for Anime & Videogames
app.get('/api/youtube/search', async (req, res) => {
  const query = ((req.query.query as string) || '').trim();
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '10', 10), 1), 25);
  const genre = (req.query.genre as string) || '';

  if (!query) {
    return res.json({ tracks: [] });
  }

  const genreSuffix =
    genre === 'anime_opening'
      ? ' anime opening'
      : genre === 'anime_ost'
      ? ' anime ost'
      : genre === 'videogames_ost'
      ? ' videogame ost'
      : '';
  const effectiveQuery =
    query.toLowerCase().includes('anime') ||
    query.toLowerCase().includes('ost') ||
    query.toLowerCase().includes('soundtrack') ||
    query.toLowerCase().includes('theme')
      ? query
      : `${query}${genreSuffix}`;

  const apiKey = process.env.YOUTUBE_API_KEY;

  // A. Official Google YouTube Data API v3 if API key provided
  if (apiKey) {
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=${Math.max(
        limit * 2,
        15
      )}&q=${encodeURIComponent(effectiveQuery)}&key=${apiKey}`;
      const ytRes = await fetch(searchUrl);
      if (ytRes.ok) {
        const data = await ytRes.json();
        const items = (data.items || [])
          .filter((item: any) => item.id?.videoId && item.snippet?.title)
          .filter((item: any) => !isRemix(item.snippet.title, item.snippet.channelTitle))
          .map((item: any) => {
            const parsed = cleanYouTubeTrack(item.snippet.title, item.snippet.channelTitle);
            return {
              id: `yt_${item.id.videoId}`,
              title: parsed.title,
              artist: parsed.artist,
              album: item.snippet.channelTitle || 'YouTube',
              previewUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
              artworkUrl:
                item.snippet.thumbnails?.high?.url ||
                item.snippet.thumbnails?.medium?.url ||
                `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
              genre: genre === 'anime_opening' ? 'Anime Opening' : genre === 'anime_ost' ? 'Anime OST' : 'Videogames OST',
              category: genre || 'anime_opening',
              source: 'youtube',
              youtubeId: item.id.videoId,
            };
          })
          .slice(0, limit);

        if (items.length > 0) {
          return res.json({ tracks: items });
        }
      }
    } catch (err) {
      console.warn('YouTube Data API v3 search error:', err);
    }
  }

  // B. Server-side YouTube Search without API key
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(effectiveQuery)}`;
    const ytRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (ytRes.ok) {
      const html = await ytRes.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
      if (match) {
        const data = JSON.parse(match[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        const itemSection = contents?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer?.contents || [];

        const scrapedTracks: any[] = [];
        for (const item of itemSection) {
          const vr = item.videoRenderer;
          if (vr && vr.videoId && vr.title?.runs?.[0]?.text) {
            const rawTitle = vr.title.runs.map((r: any) => r.text).join('');
            const rawChannel = vr.ownerText?.runs?.[0]?.text || '';

            // Skip remixes
            if (isRemix(rawTitle, rawChannel)) continue;

            const parsed = cleanYouTubeTrack(rawTitle, rawChannel);
            scrapedTracks.push({
              id: `yt_${vr.videoId}`,
              title: parsed.title,
              artist: parsed.artist,
              album: rawChannel || 'YouTube',
              previewUrl: `https://www.youtube.com/watch?v=${vr.videoId}`,
              artworkUrl: `https://img.youtube.com/vi/${vr.videoId}/hqdefault.jpg`,
              genre: genre === 'anime_opening' ? 'Anime Opening' : genre === 'anime_ost' ? 'Anime OST' : 'Videogames OST',
              category: genre || 'anime_opening',
              source: 'youtube',
              youtubeId: vr.videoId,
            });

            if (scrapedTracks.length >= limit) break;
          }
        }

        if (scrapedTracks.length > 0) {
          return res.json({ tracks: scrapedTracks });
        }
      }
    }
  } catch (err) {
    console.warn('YouTube scraping search error:', err);
  }

  // C. Fallback to local verified YouTube catalog
  const filtered = VERIFIED_YOUTUBE_TRACKS.filter((t) => {
    const matchesGenre = !genre || t.category === genre;
    const matchesQuery =
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase()) ||
      (t.album && t.album.toLowerCase().includes(query.toLowerCase()));
    return matchesGenre && matchesQuery;
  }).slice(0, limit);

  return res.json({ tracks: filtered });
});

// 3. YouTube Genre Tracks API for Anime & Videogames
app.get('/api/youtube/genre', async (req, res) => {
  const genreId = (req.query.genreId as string) || 'anime_opening';
  const count = Math.min(Math.max(parseInt((req.query.count as string) || '5', 10), 1), 20);

  const matched = VERIFIED_YOUTUBE_TRACKS.filter((t) => t.category === genreId);
  const pool = matched.length > 0 ? matched : VERIFIED_YOUTUBE_TRACKS;

  const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
  return res.json({ tracks: shuffled });
});

// Start Express server and mount Vite
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
