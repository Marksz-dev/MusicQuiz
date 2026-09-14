import { Track } from '../types/game';
import { isYouTubeGenre, getYouTubeTracksForGenre, searchYouTubeTracks } from './youtube';

export { isYouTubeGenre };

// Standard genres for Room creation and Single Player
export interface GenreCategory {
  id: string;
  name: string;
  description: string;
  searchQueries: string[];
  icon: string;
}

export const GENRE_CATEGORIES: GenreCategory[] = [
  {
    id: 'pop_hits',
    name: 'Top Pop Hits',
    description: 'Modern global chart toppers from today and recent years',
    searchQueries: ['Taylor Swift', 'Dua Lipa', 'The Weeknd', 'Bruno Mars', 'Ed Sheeran', 'Ariana Grande', 'Harry Styles', 'Billie Eilish'],
    icon: 'Sparkles',
  },
  {
    id: 'anime_opening',
    name: 'Anime Opening',
    description: '100 iconic anime openings and viral intros from the curated YouTube playlist',
    searchQueries: [
      'King Gnu SPECIALZ',
      'Kenshi Yonezu Kick Back',
      'Eve Kaikai Kitan',
      'SiM The Rumbling',
      'Mrs. GREEN APPLE Inferno',
      'Creepy Nuts Bling-Bang-Bang-Born',
      'T.M.Revolution Resonance',
      'Linked Horizon Shinzou wo Sasageyo',
      'Who-ya Extended VIVID VICE',
      'ALI Wild Side',
      'TK Unravel',
      'Tatsuya Kitani Where Our Blue Is',
      'supercell My Dearest',
      'YOASOBI Idol',
      'KANA-BOON Silhouette',
      'Kenshi Yonezu Peace Sign',
      'Namie Amuro Hope',
      'Hiroshi Kitadani We Are',
      'amazarashi Sora ni Utaeba',
      'OxT Clattanoia',
      'Porno Graffitti THE DAY',
      'BURNOUT SYNDROMES Good Morning World',
      'Tommy heavenly6 PAPERMOON',
      'BRADIO Flyers',
      'Snow Man Grandeur',
      'MOB CHOIR 99',
      'Official HIGE DANdism Cry Baby',
      'chelmico Easy Breezy',
      'Dean Fujioka History Maker',
      'Ryokuoushoku Shakai Hana ni Natte',
      'the peggies Centimeter',
      'KANA-BOON Song of the Dead',
      'Konomi Suzuki This game',
      'Fear and Loathing in Las Vegas Let Me Hear',
      'MADKID RISE',
      'Cidergirl Cinderella',
      'YOSHIKI HYDE Red Swan',
      'millennium parade Sheena Ringo WORK',
      'Aimer SPARK-AGAIN',
      'Nujabes Battlecry',
      'Ado Kura Kura',
      'SawanoHiroyuki TOMORROW X TOGETHER LEveL',
      'Machico Fantastic Dreamer',
      'SID ENAMEL',
      'Mili Rightfully',
      'Stray Kids TOP',
      'Vaundy Naked Hero',
      'Vivy Sing My Pleasure',
      'BUMP OF CHICKEN Hello World',
      'Queen Bee 01'
    ],
    icon: 'Tv',
  },
  {
    id: 'anime_ost',
    name: 'Anime OST',
    description: 'Legendary anime background scores, emotional themes, and battle soundtracks',
    searchQueries: [
      'Hiroyuki Sawano',
      'Joe Hisaishi',
      'SEAT BELTS Tank!',
      'Yuki Hayashi You Say Run',
      'Shiro Sagisu Bleach',
      'Radwimps Sparkle',
      'Kevin Penkin Made in Abyss',
      'Yasuharu Takanashi Fairy Tail',
      'Kenji Kawai Ghost in the Shell',
      'Susumu Hirasawa Berserk',
      'Yoko Kanno'
    ],
    icon: 'Music',
  },
  {
    id: 'videogames_ost',
    name: 'Videogames OST',
    description: 'Legendary gaming soundtracks, epic boss themes, and nostalgic tunes',
    searchQueries: [
      'Toby Fox Megalovania',
      'Koji Kondo Zelda',
      'Nobuo Uematsu',
      'Mick Gordon Doom',
      'Christopher Larkin Hollow Knight',
      'Persona 5 Last Surprise',
      'Lena Raine Celeste',
      'Yuka Kitamura Dark Souls',
      'Martin ODonnell Halo',
      'Marcin Przybylowicz Witcher',
      'Super Mario Bros Theme',
      'David Wise Donkey Kong'
    ],
    icon: 'Gamepad2',
  },
  {
    id: 'classics_80s',
    name: '80s Rewind',
    description: 'Iconic anthems from synth-pop and 80s golden age',
    searchQueries: ['Michael Jackson', 'Queen', 'Madonna', 'Cyndi Lauper', 'Toto', 'Wham', 'A-ha', 'Whitney Houston', 'Bon Jovi'],
    icon: 'Disc',
  },
  {
    id: 'nostalgia_90s_00s',
    name: '90s & 2000s Nostalgia',
    description: 'Millennial pop, boybands, punk rock, and alt anthems',
    searchQueries: ['Britney Spears', 'Backstreet Boys', 'Eminem', 'Avril Lavigne', 'Green Day', 'Linkin Park', 'Destinys Child', 'Outkast'],
    icon: 'Radio',
  },
  {
    id: 'rock_classics',
    name: 'Rock & Legends',
    description: 'Stadium guitar riffs, legendary bands, and rock classics',
    searchQueries: ['AC/DC', 'Nirvana', 'Red Hot Chili Peppers', 'The Killers', 'Queen', 'Guns N Roses', 'Led Zeppelin', 'Foo Fighters'],
    icon: 'Guitar',
  },
  {
    id: 'hiphop_rnb',
    name: 'Hip-Hop & R&B',
    description: 'Beats, flow, and modern rhythm anthems',
    searchQueries: ['Drake', 'Kendrick Lamar', 'Rihanna', 'Beyonce', 'Post Malone', 'SZA', 'Usher', 'The Weeknd'],
    icon: 'Headphones',
  },
  {
    id: 'edm_dance',
    name: 'EDM & Electronic',
    description: 'Club bangers, festival drops, and dance hits',
    searchQueries: ['Avicii', 'Daft Punk', 'Calvin Harris', 'David Guetta', 'The Chainsmokers', 'Swedish House Mafia', 'Kygo', 'Tiesto'],
    icon: 'Zap',
  },
];

// Fallback high-quality curated tracks with direct Apple Music preview CDN URLs
// in case of any network/CORS or rate limit quirks
export const FALLBACK_TRACKS: Track[] = [
  {
    id: 1679278167,
    title: 'Idol',
    artist: 'YOASOBI',
    album: 'Idol - Single',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f0/db/16/f0db16be-457e-f10f-98b6-f30b11de34e4/mzaf_5189430943078523093.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/3a/17/eb/3a17eb30-eacb-82eb-51df-d1321dbb55bc/197188492205.jpg/300x300bb.jpg',
    releaseDate: '2023',
    genre: 'J-Pop',
    category: 'anime_opening'
  },
  {
    id: 1529543135,
    title: 'Gurenge',
    artist: 'LiSA',
    album: 'LEO-NiNE',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/02/9f/31/029f31d9-865f-8238-795d-0a69106cd7bd/mzaf_4087349157470098609.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/51/b3/58/51b35899-bda2-50d2-2c00-b2b95999b3c3/4547366473681.jpg/300x300bb.jpg',
    releaseDate: '2019',
    genre: 'J-Pop',
    category: 'anime_opening'
  },
  {
    id: 1538157315,
    title: 'Silhouette',
    artist: 'KANA-BOON',
    album: 'TIME',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/46/f6/8b/46f68b4a-fb0f-b118-4f1f-6b464e5e6579/mzaf_11941046521694916490.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/32/6b/cc/326bcc4d-5c22-1451-4935-4d693cde2ad1/jacket_KSCL02535B00Z_550.jpg/300x300bb.jpg',
    releaseDate: '2014',
    genre: 'Rock',
    category: 'anime_opening'
  },
  {
    id: 1521453384,
    title: 'Tank!',
    artist: 'SEAT BELTS',
    album: 'COWBOY BEBOP (Original Motion Picture Soundtrack)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5c/c4/94/5cc494a0-7e75-79cf-e48b-b100cbdd174e/mzaf_15399371244227236105.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5a/bb/df/5abbdf28-bf0e-0530-e5f8-0f0ca3150e0a/195081633657.jpg/300x300bb.jpg',
    releaseDate: '1998',
    genre: 'TV Soundtrack',
    category: 'anime_ost'
  },
  {
    id: 661050320,
    title: 'ətˈæk 0N tάɪtn',
    artist: 'Hiroyuki Sawano',
    album: 'TV Anime "Attack on Titan" (Original Soundtrack)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/42/64/e1/4264e16d-eed0-a646-af8e-3743f4ac4f1c/mzaf_7606856946232058909.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d8/58/18/d858188c-a96d-a98c-e8ca-ae6f70e2825e/PCCG_01351_itunes.png/300x300bb.jpg',
    releaseDate: '2013',
    genre: 'Soundtrack',
    category: 'anime_ost'
  },
  {
    id: 1810266875,
    title: 'Merry-Go-Round of Life [From "Howl\'s Moving Castle"]',
    artist: 'Ray Chen & Julien Quentin',
    album: 'Joe Hisaishi: Merry-Go-Round of Life - Single',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/43/58/51/435851ee-11b5-0b89-1729-dfb276a76135/mzaf_6921080918683117395.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e3/2a/fa/e32afa53-7de8-89cb-19c4-a5542433e587/24UMGIM95272.rgb.jpg/300x300bb.jpg',
    releaseDate: '2025',
    genre: 'Classical',
    category: 'anime_ost'
  },
  {
    id: 1528217897,
    title: 'Megalovania',
    artist: 'Toby Fox',
    album: 'Undertale Soundtrack',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7b/87/f7/7b87f7fd-8717-dd5f-ecc4-740af6750e55/mzaf_18160071326637017.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/d3/21/9f/d3219f8b-c2ff-2498-0e87-eb57873b6eca/841787181533.png/300x300bb.jpg',
    releaseDate: '2015',
    genre: 'Soundtrack',
    category: 'videogames_ost'
  },
  {
    id: 1435680187,
    title: 'Ocarina of Time',
    artist: 'Mikel & GameChops',
    album: 'Zelda & Chill',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9b/68/e2/9b68e2b9-7a21-718a-462d-533884a6bfbf/mzaf_3851028725982399444.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a2/fb/d3/a2fbd381-f5d3-f60a-a044-3cabb1678655/artwork.jpg/300x300bb.jpg',
    releaseDate: '2018',
    genre: 'Downtempo',
    category: 'videogames_ost'
  },
  {
    id: 1693892769,
    title: 'Super Mario Bros. - Ground Theme',
    artist: 'Ottawa Guitar Trio',
    album: 'Level 1',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/44/07/33/44073398-6d85-0d5a-78e3-c9d44abdb51b/mzaf_8342090457889497650.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/fc/b0/71/fcb0712d-c9f9-b0a8-6fa9-c0bc6ef9a1e8/2636eefe-c6e2-4703-b5b6-6bde928362c3.jpg/300x300bb.jpg',
    releaseDate: '2020',
    genre: 'Classical',
    category: 'videogames_ost'
  },
  {
    id: 1440857781,
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/71/c4/7b/71c47b59-a20c-cbe6-c566-0d6118aa5ce6/mzaf_10793618386341235128.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bf/fb/14/bffb149b-73f1-4db3-ae45-b461c3bf1ec4/20UMGIM10243.rgb.jpg/300x300bb.jpg',
    releaseDate: '2019',
    genre: 'Pop',
    category: 'pop_hits'
  },
  {
    id: 1440818817,
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/e5/22/8e/e5228e93-6bf2-6983-a759-450f63ea47c6/mzaf_15082121703212629853.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/cf/c9/79/cfc9795f-9f79-4545-e63b-63520bc324bc/190295286101.jpg/300x300bb.jpg',
    releaseDate: '2020',
    genre: 'Pop',
    category: 'pop_hits'
  },
  {
    id: 1440935467,
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    album: '÷ (Divide)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/58/b6/aa/58b6aa5a-b68e-ca3e-2575-b6951919dc5f/mzaf_1720816928509871587.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/30/1e/77/301e779a-e158-b6e2-2a78-b118b6ec1215/0190295851286.jpg/300x300bb.jpg',
    releaseDate: '2017',
    genre: 'Pop',
    category: 'pop_hits'
  },
  {
    id: 1440783617,
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/28/7f/00/287f005a-8b98-bc41-7dc8-c116d47b6a48/mzaf_16450654637494488397.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4a/01/a7/4a01a733-149b-73a7-05c0-f8231575ce23/074643811224.jpg/300x300bb.jpg',
    releaseDate: '1982',
    genre: 'Pop',
    category: 'classics_80s'
  },
  {
    id: 1440650816,
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b4/07/87/b4078734-118e-4a81-d13c-0c469f691684/mzaf_11303866160867015509.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f4/1a/0b/f41a0b32-e069-fb2d-0b73-0498b3c9b74d/00602527718021.rgb.jpg/300x300bb.jpg',
    releaseDate: '1975',
    genre: 'Rock',
    category: 'rock_classics'
  },
  {
    id: 1440763429,
    title: 'Mr. Brightside',
    artist: 'The Killers',
    album: 'Hot Fuss',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/7e/17/aa/7e17aa6b-2804-b97c-9b4f-a78b4ecf16d7/mzaf_11068894236522332158.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d1/85/66/d185669b-e85d-c6a6-0684-26610757a3e7/00602537482318.rgb.jpg/300x300bb.jpg',
    releaseDate: '2004',
    genre: 'Rock',
    category: 'rock_classics'
  },
  {
    id: 1440783619,
    title: 'Wake Me Up',
    artist: 'Avicii',
    album: 'True',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/80/7e/f6/807ef602-0e98-35aa-cbb4-7126eb3907c1/mzaf_7889146200216172605.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/05/cf/a1/05cfa1ee-1250-98ff-89d6-56c52a0a256d/00602537535564.rgb.jpg/300x300bb.jpg',
    releaseDate: '2013',
    genre: 'Dance',
    category: 'edm_dance'
  },
  {
    id: 1440810022,
    title: 'Lose Yourself',
    artist: 'Eminem',
    album: 'Curtain Call: The Hits',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/10/d7/f6/10d7f6c3-108b-6f17-bb9b-b271d4aa8f26/mzaf_13508119102434680879.plus.aac.p.m4a',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/44/7f/7f/447f7fe5-0b0b-cf15-d41f-8556f8f4a3bf/00602517034445.rgb.jpg/300x300bb.jpg',
    releaseDate: '2002',
    genre: 'Hip-Hop',
    category: 'nostalgia_90s_00s'
  }
];

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string;
  primaryGenreName?: string;
}

/**
 * Detects whether a song is a remix, club mix, dub mix, speed/slowed edit, or mashup.
 * Ensures the game only selects and suggests original album / single tracks.
 */
export function isRemix(title: string, album?: string): boolean {
  const t = title.toLowerCase();
  const a = album ? album.toLowerCase() : '';

  // Title remix indicators
  const titleRemixRegex = /\b(re-?mix(ed|es)?|club\s+mix|extended\s+mix|dance\s+mix|dub\s+mix|disco\s+mix|house\s+mix|trance\s+mix|vip\s+(mix|edit)|mash-?up|bootleg|nightcore|daycore|slowed\s*(\+|and)?\s*reverb|speed(ed)?\s*up)\b/i;
  if (titleRemixRegex.test(t)) {
    return true;
  }

  // Bracketed or parenthetical remix signatures e.g. "(DJ Snake Remix)" or "[Steve Aoki Club Mix]"
  if (/[(\[][^)]*?\b(remix|re-mix|club\s+mix|extended\s+mix|dub\s+mix)\b[^)]*?[)\]]/i.test(title)) {
    return true;
  }

  // Album explicitly designated as a remixes compilation
  const albumRemixRegex = /\b(remixes|the\s+remixes|remix\s+album|remix\s+ep|the\s+remix\s+collection|remixed)\b/i;
  if (albumRemixRegex.test(a)) {
    return true;
  }

  return false;
}

/**
 * Searches tracks with autocomplete support.
 * For Anime Opening, Anime OST, and Videogames OST, searches via the YouTube API.
 * For all other genres, searches the iTunes API.
 * Returns up to `limit` clean Track items with valid audio, excluding remixes.
 */
export async function searchTracks(query: string, limit: number = 10, genreId?: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  // 1. YouTube API ONLY for Anime Opening, Anime OST, and Videogames OST
  if (isYouTubeGenre(genreId)) {
    return searchYouTubeTracks(trimmed, limit, genreId);
  }

  // 2. iTunes API for all other genres
  // Request extra items to ensure we fulfill `limit` after filtering out remixes
  const requestLimit = Math.max(limit * 3, 25);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&media=music&entity=song&limit=${requestLimit}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`iTunes search error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    const validTracks: Track[] = (data.results as ITunesResult[])
      .filter((item) => item.trackName && item.artistName && item.previewUrl)
      // Exclude remixes of songs
      .filter((item) => !isRemix(item.trackName, item.collectionName))
      .map((item) => ({
        id: item.trackId,
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || 'Single',
        previewUrl: item.previewUrl!,
        artworkUrl: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '300x300bb') : '',
        releaseDate: item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : undefined,
        genre: item.primaryGenreName,
        source: 'itunes' as const,
      }));

    // Deduplicate by title + artist
    const seen = new Set<string>();
    return validTracks.filter((t) => {
      const key = `${t.title.toLowerCase()} - ${t.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  } catch (err) {
    console.warn('iTunes API search fallback to local filter:', err);
    // Filter fallback tracks for seamless testing if offline, excluding remixes
    return FALLBACK_TRACKS.filter(
      (t) =>
        !isRemix(t.title, t.album) &&
        (t.title.toLowerCase().includes(trimmed.toLowerCase()) ||
         t.artist.toLowerCase().includes(trimmed.toLowerCase()))
    );
  }
}

/**
 * Fetches a random set of tracks for a given genre category.
 * Uses YouTube API ONLY for Anime Opening, Anime OST, and Videogames OST.
 * Uses iTunes API for all other genres.
 */
export async function getTracksForGenre(genreId: string, count: number = 5): Promise<Track[]> {
  // 1. YouTube API ONLY for Anime Opening, Anime OST, and Videogames OST
  if (isYouTubeGenre(genreId)) {
    return getYouTubeTracksForGenre(genreId, count);
  }

  // 2. iTunes API for all other genres
  const category = GENRE_CATEGORIES.find((g) => g.id === genreId) || GENRE_CATEGORIES[0];
  
  // Pick 2-3 random artist queries from the category to assemble a diverse pool
  const shuffledQueries = [...category.searchQueries].sort(() => 0.5 - Math.random());
  const selectedQueries = shuffledQueries.slice(0, 3);

  const gatheredTracks: Track[] = [];

  for (const query of selectedQueries) {
    try {
      const tracks = await searchTracks(query, 8);
      const filtered = tracks.filter((t) => !isRemix(t.title, t.album));
      gatheredTracks.push(...filtered);
    } catch {
      // Continue to next query
    }
  }

  // If iTunes returned enough non-remix tracks, shuffle and slice
  if (gatheredTracks.length >= count) {
    return gatheredTracks.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  // Otherwise mix with non-remix fallback tracks, prioritizing matching category
  const categoryFallbacks = FALLBACK_TRACKS.filter((t) => t.category === category.id && !isRemix(t.title, t.album));
  const fallbackPool = categoryFallbacks.length > 0
    ? [...categoryFallbacks, ...FALLBACK_TRACKS.filter((t) => !isRemix(t.title, t.album))]
    : FALLBACK_TRACKS.filter((t) => !isRemix(t.title, t.album));
  const combined = [...gatheredTracks, ...fallbackPool].sort(() => 0.5 - Math.random());
  return combined.slice(0, count);
}

/**
 * Normalizes title / artist for tolerant guessing comparison.
 * Ignores parenthetical text like "(feat. ...)", "[Remastered]", punctuation, spaces, etc.
 */
export function normalizeSongText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '') // remove (...)
    .replace(/\s*\[[^\]]*\]/g, '') // remove [...]
    .replace(/[^a-z0-9]/g, '') // remove punctuation & spaces
    .trim();
}

/**
 * Checks if a user's guess matches the target track.
 * Supports:
 * - Match against full "Track - Artist"
 * - Match against "Artist - Track"
 * - Match against Track Name alone (if distinct enough)
 */
export function isCorrectGuess(guess: string, target: Track): boolean {
  const normGuess = normalizeSongText(guess);
  if (!normGuess) return false;

  const normTitle = normalizeSongText(target.title);
  const normArtist = normalizeSongText(target.artist);
  const normCombined1 = normalizeSongText(`${target.title} ${target.artist}`);
  const normCombined2 = normalizeSongText(`${target.artist} ${target.title}`);

  // Exact combinations
  if (normGuess === normCombined1 || normGuess === normCombined2) return true;

  // Title match (if guess has at least 4 letters to prevent single common words)
  if (normTitle.length >= 4 && normGuess === normTitle) return true;

  // Substring tolerance if the normalized title is completely contained and guess is close
  if (normGuess.includes(normTitle) || normTitle.includes(normGuess)) {
    if (Math.min(normGuess.length, normTitle.length) >= 4) {
      return true;
    }
  }

  return false;
}
