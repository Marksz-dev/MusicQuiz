import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSavedSupabaseConfig(): { url: string; key: string } {
  let envUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

  // Normalize project URL: Supabase client requires root domain (e.g. https://xxx.supabase.co)
  // Strips any accidental /rest/v1/ or trailing slashes copied from Supabase dashboard
  if (envUrl) {
    try {
      envUrl = new URL(envUrl).origin;
    } catch {
      envUrl = envUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    }
  }

  return {
    url: envUrl,
    key: envKey,
  };
}

let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSavedSupabaseConfig();
  if (!url || !key) {
    return null;
  }

  if (cachedClient && lastUsedUrl === url && lastUsedKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * The complete Supabase SQL Schema for SongFight:
 * Includes rooms, players, and rounds tables, foreign keys, indexes,
 * row level security (RLS) policies for anonymous party play,
 * and Supabase Realtime publication setup.
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- SongFight: Supabase Schema with Realtime Channels, Presence & Broadcast
-- Run this script in the Supabase SQL Editor (Database -> SQL Editor)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Rooms Table
-- Stores active party lobbies, settings, host, and round state
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(6) UNIQUE NOT NULL,
  host_id TEXT NOT NULL,
  genre VARCHAR(50) NOT NULL DEFAULT 'pop_hits',
  total_rounds INTEGER NOT NULL DEFAULT 5,
  round_duration INTEGER NOT NULL DEFAULT 30,
  current_round INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'lobby', 
  -- Allowed statuses: 'lobby', 'countdown', 'playing', 'round_reveal', 'game_over'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast room code lookups
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms (code);

-- 3. Players Table
-- Stores participant details, scores, and active status per room
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(6) NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name VARCHAR(50) NOT NULL,
  avatar VARCHAR(20) NOT NULL DEFAULT '🎵',
  color VARCHAR(30) NOT NULL DEFAULT '#8b5cf6',
  score INTEGER NOT NULL DEFAULT 0,
  round_score INTEGER NOT NULL DEFAULT 0,
  has_guessed_correct BOOLEAN NOT NULL DEFAULT FALSE,
  guess_time_seconds NUMERIC(5,2),
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_client_per_room UNIQUE (room_code, client_id)
);

CREATE INDEX IF NOT EXISTS idx_players_room_code ON public.players (room_code);

-- 4. Rounds Table
-- Stores current round audio payload, timestamps for timer synchronization
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(6) NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  round_index INTEGER NOT NULL,
  track_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  artwork_url TEXT,
  start_time BIGINT NOT NULL, -- Epoch milliseconds for millisecond-precision audio sync
  duration INTEGER NOT NULL DEFAULT 30,
  winner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_room ON public.rounds (room_code, round_index);

-- 5. Row Level Security (RLS) Policies
-- Enables open anonymous party room participation without requiring user authentication
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

-- Rooms RLS: Allow anyone to create, view, and update rooms
DROP POLICY IF EXISTS "Public can view rooms" ON public.rooms;
CREATE POLICY "Public can view rooms" ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can create rooms" ON public.rooms;
CREATE POLICY "Public can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update rooms" ON public.rooms;
CREATE POLICY "Public can update rooms" ON public.rooms FOR UPDATE USING (true);

-- Players RLS: Allow anyone to view and participate in room rosters
DROP POLICY IF EXISTS "Public can view players" ON public.players;
CREATE POLICY "Public can view players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can join rooms" ON public.players;
CREATE POLICY "Public can join rooms" ON public.players FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update player scores" ON public.players;
CREATE POLICY "Public can update player scores" ON public.players FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can leave rooms" ON public.players;
CREATE POLICY "Public can leave rooms" ON public.players FOR DELETE USING (true);

-- Rounds RLS: Allow reading and writing rounds for active matches
DROP POLICY IF EXISTS "Public can view rounds" ON public.rounds;
CREATE POLICY "Public can view rounds" ON public.rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can record rounds" ON public.rounds;
CREATE POLICY "Public can record rounds" ON public.rounds FOR INSERT WITH CHECK (true);

-- 6. Supabase Realtime Replication
-- Enable postgres change replication for Realtime listeners
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;

-- Note on Supabase Presence & Broadcast:
-- Supabase Channels ('room:ROOM_CODE') handle Presence tracking (online roster)
-- and Broadcast events (live score updates, round countdowns) directly in memory
-- without hitting the database on every microsecond tick.
`;
