export interface Track {
  id: number | string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  artworkUrl: string;
  releaseDate?: string;
  genre?: string;
  category?: string;
  source?: 'itunes' | 'youtube';
  youtubeId?: string;
}

export interface GuessAttempt {
  attemptNumber: number;
  guessText: string;
  isCorrect: boolean;
  isSkipped: boolean;
  timestamp: number;
}

export interface SinglePlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>;
  lastPlayedTimestamp?: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  score: number;
  roundScore: number;
  hasGuessedCorrect: boolean;
  hasSubmittedGuess?: boolean;
  guessTimeSeconds?: number;
  isHost: boolean;
  joinedAt: number;
}

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'round_reveal' | 'game_over';

export interface RoomSettings {
  genre: string;
  totalRounds: number;
  roundDuration: number; // 30s
}

export interface Room {
  code: string;
  hostId: string;
  settings: RoomSettings;
  currentRound: number;
  status: RoomStatus;
  createdAt: number;
}

export interface RoundPayload {
  roundIndex: number;
  totalRounds: number;
  track: Track;
  startTime: number; // Epoch timestamp ms
  duration: number; // 30 seconds
}

export interface PlayerScoreEvent {
  playerId: string;
  playerName: string;
  roundIndex: number;
  pointsAwarded: number;
  guessTimeSeconds: number;
  totalScore: number;
}

export interface RoundResultSummary {
  roundIndex: number;
  track: Track;
  winner?: {
    name: string;
    points: number;
    seconds: number;
  };
  scores: Record<string, number>;
}
