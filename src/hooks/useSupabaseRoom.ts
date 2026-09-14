import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Player, Room, RoundPayload, Track, PlayerScoreEvent, RoomStatus } from '../types/game';
import { getSupabaseClient } from '../services/supabase';

export interface UseSupabaseRoomProps {
  roomCode: string;
  currentPlayer: {
    id: string;
    name: string;
    avatar: string;
    color: string;
    isHost: boolean;
  };
  onRoundStart?: (payload: RoundPayload) => void;
  onRoundEnd?: (track: Track, scores: Record<string, number>) => void;
  onGameOver?: (finalPlayers: Player[]) => void;
}

export function useSupabaseRoom({
  roomCode,
  currentPlayer,
  onRoundStart,
  onRoundEnd,
  onGameOver,
}: UseSupabaseRoomProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('lobby');
  const [currentRoundPayload, setCurrentRoundPayload] = useState<RoundPayload | null>(null);
  const [myScore, setMyScore] = useState<number>(0);
  const [hasGuessedCorrect, setHasGuessedCorrect] = useState<boolean>(false);
  const [availableScore, setAvailableScore] = useState<number>(1000);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState<number>(30);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [revealedTrack, setRevealedTrack] = useState<Track | null>(null);
  const [recentScorer, setRecentScorer] = useState<{ name: string; points: number } | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Initialize and update local player in the roster
  const selfPlayer: Player = {
    id: currentPlayer.id,
    name: currentPlayer.name,
    avatar: currentPlayer.avatar,
    color: currentPlayer.color,
    score: myScore,
    roundScore: 0,
    hasGuessedCorrect,
    isHost: currentPlayer.isHost,
    joinedAt: Date.now(),
  };

  // Helper to send broadcast messages (via Supabase Realtime OR local BroadcastChannel)
  const broadcastMessage = useCallback(
    (event: string, payload: any) => {
      // 1. Supabase Broadcast
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      }

      // 2. BroadcastChannel for local/multi-tab fallback
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ event, payload });
      }
    },
    []
  );

  // Clean timer loops
  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Handle incoming broadcast events uniformly
  const handleBroadcastEvent = useCallback(
    (event: string, payload: any) => {
      switch (event) {
        case 'ROUND_PREPARE': {
          // 3-second synchronized countdown before audio plays
          clearTimers();
          setRoomStatus('countdown');
          setIsCountingDown(true);
          setCountdownSeconds(3);
          setHasGuessedCorrect(false);
          setAvailableScore(1000);
          setRevealedTrack(null);
          setCurrentRoundPayload(payload);

          // Local countdown tick
          let cd = 3;
          countdownIntervalRef.current = window.setInterval(() => {
            cd -= 1;
            setCountdownSeconds(cd);
            if (cd <= 0) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              setIsCountingDown(false);
              setRoomStatus('playing');
              startRoundTimer(payload);
              if (onRoundStart) onRoundStart(payload);
            }
          }, 1000);
          break;
        }

        case 'PLAYER_GUESSED': {
          const scoreEvent = payload as PlayerScoreEvent;
          setRecentScorer({ name: scoreEvent.playerName, points: scoreEvent.pointsAwarded });
          setTimeout(() => setRecentScorer(null), 3000);

          setPlayers((prev) =>
            prev.map((p) => {
              if (p.id === scoreEvent.playerId) {
                return {
                  ...p,
                  score: p.score + scoreEvent.pointsAwarded,
                  roundScore: scoreEvent.pointsAwarded,
                  hasGuessedCorrect: true,
                  guessTimeSeconds: scoreEvent.guessTimeSeconds,
                };
              }
              return p;
            })
          );
          break;
        }

        case 'ROUND_END': {
          clearTimers();
          setRoomStatus('round_reveal');
          setRevealedTrack(payload.track);
          if (onRoundEnd) {
            onRoundEnd(payload.track, payload.scores || {});
          }
          break;
        }

        case 'GAME_OVER': {
          clearTimers();
          setRoomStatus('game_over');
          if (onGameOver) {
            onGameOver(payload.finalPlayers || []);
          }
          break;
        }

        case 'RETURN_TO_LOBBY': {
          clearTimers();
          setRoomStatus('lobby');
          setCurrentRoundPayload(null);
          setRevealedTrack(null);
          setHasGuessedCorrect(false);
          setPlayers((prev) =>
            prev.map((p) => ({
              ...p,
              score: 0,
              roundScore: 0,
              hasGuessedCorrect: false,
            }))
          );
          setMyScore(0);
          break;
        }

        default:
          break;
      }
    },
    [clearTimers, onRoundStart, onRoundEnd, onGameOver]
  );

  // Client-side decaying score calculation synchronized to round startTime
  const startRoundTimer = useCallback((payload: RoundPayload) => {
    clearTimers();

    const checkInterval = 50; // High precision 50ms interval for ultra-smooth score decay
    const duration = payload.duration || 30;

    timerIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - payload.startTime) / 1000);
      const remaining = Math.max(0, duration - elapsedSeconds);

      setRoundTimeRemaining(Math.ceil(remaining));

      // Decaying Score formula:
      // Starts at 1000, decays linearly over 30s. Minimum score 100 if solved in time.
      if (remaining <= 0) {
        setAvailableScore(0);
        clearTimers();
      } else {
        // Linear decay: 1000 -> 100 points
        const decayFactor = remaining / duration;
        const currentDecayedScore = Math.max(100, Math.round(1000 * decayFactor));
        setAvailableScore(currentDecayedScore);
      }
    }, checkInterval);
  }, [clearTimers]);

  // Connect to Supabase Realtime channel + Fallback BroadcastChannel
  useEffect(() => {
    if (!roomCode) return;

    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;

    if (supabase) {
      setIsSupabaseConnected(true);
      const channelName = `songspot_room_${roomCode.toUpperCase()}`;

      channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: currentPlayer.id,
          },
          broadcast: {
            self: true, // receive own events for clean centralized state flow
          },
        },
      });

      channelRef.current = channel;

      // 1. Supabase Presence sync
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel?.presenceState();
          if (state) {
            const roster: Player[] = [];
            Object.values(state).forEach((presences: any) => {
              presences.forEach((presence: any) => {
                if (presence.id && !roster.some((r) => r.id === presence.id)) {
                  roster.push({
                    id: presence.id,
                    name: presence.name || 'Anonymous',
                    avatar: presence.avatar || '🎵',
                    color: presence.color || '#8b5cf6',
                    score: presence.score || 0,
                    roundScore: 0,
                    hasGuessedCorrect: false,
                    isHost: presence.isHost || false,
                    joinedAt: presence.joinedAt || Date.now(),
                  });
                }
              });
            });
            setPlayers(roster);
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('Player joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('Player left:', leftPresences);
        });

      // 2. Supabase Broadcast listener
      channel.on('broadcast', { event: '*' }, (data) => {
        handleBroadcastEvent(data.event, data.payload);
      });

      // Subscribe and track presence
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel?.track({
            id: currentPlayer.id,
            name: currentPlayer.name,
            avatar: currentPlayer.avatar,
            color: currentPlayer.color,
            isHost: currentPlayer.isHost,
            score: myScore,
            joinedAt: Date.now(),
          });
        }
      });
    } else {
      setIsSupabaseConnected(false);
    }

    // 3. Fallback / Cross-Tab BroadcastChannel
    // Enables multi-tab or local party testing without Supabase credentials
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`songspot_channel_${roomCode.toUpperCase()}`);
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        if (event.data?.event) {
          handleBroadcastEvent(event.data.event, event.data.payload);
        }
        if (event.data?.type === 'HEARTBEAT') {
          // Update peers in fallback mode
          const peer = event.data.player as Player;
          setPlayers((prev) => {
            if (!prev.some((p) => p.id === peer.id)) {
              return [...prev, peer];
            }
            return prev.map((p) => (p.id === peer.id ? { ...p, ...peer } : p));
          });
        }
      };

      // Periodic heartbeat for presence in BroadcastChannel mode
      const heartbeatInterval = setInterval(() => {
        bc?.postMessage({
          type: 'HEARTBEAT',
          player: selfPlayer,
        });
      }, 1500);

      // Add self immediately to local players
      setPlayers((prev) => {
        if (!prev.some((p) => p.id === selfPlayer.id)) {
          return [...prev, selfPlayer];
        }
        return prev;
      });

      return () => {
        clearInterval(heartbeatInterval);
        bc?.close();
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    return () => {
      clearTimers();
      if (channel) {
        channel.unsubscribe();
      }
      if (bc) {
        bc.close();
      }
    };
  }, [roomCode, currentPlayer.id, currentPlayer.name, currentPlayer.avatar, currentPlayer.color, currentPlayer.isHost]);

  // Submit guess method
  const submitCorrectGuess = useCallback(
    (guessText: string) => {
      if (hasGuessedCorrect || roomStatus !== 'playing' || !currentRoundPayload) return;

      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - currentRoundPayload.startTime) / 1000);
      const guessTime = Number(elapsedSeconds.toFixed(2));
      const pointsWon = availableScore;

      setHasGuessedCorrect(true);
      setMyScore((prev) => prev + pointsWon);

      const scorePayload: PlayerScoreEvent = {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        roundIndex: currentRoundPayload.roundIndex,
        pointsAwarded: pointsWon,
        guessTimeSeconds: guessTime,
        totalScore: myScore + pointsWon,
      };

      broadcastMessage('PLAYER_GUESSED', scorePayload);

      // Check if all players have now guessed correctly
      // (host will end the round early if all participants have completed)
      if (currentPlayer.isHost) {
        setTimeout(() => {
          setPlayers((latestPlayers) => {
            const allFinished = latestPlayers.every(
              (p) => p.id === currentPlayer.id || p.hasGuessedCorrect
            );
            if (allFinished && latestPlayers.length > 1) {
              endRound(currentRoundPayload.track);
            }
            return latestPlayers;
          });
        }, 500);
      }
    },
    [
      hasGuessedCorrect,
      roomStatus,
      currentRoundPayload,
      availableScore,
      currentPlayer.id,
      currentPlayer.name,
      currentPlayer.isHost,
      myScore,
      broadcastMessage,
    ]
  );

  // Host: Prepare and start next round
  const startNextRound = useCallback(
    (roundIndex: number, totalRounds: number, track: Track) => {
      if (!currentPlayer.isHost) return;

      // Start time is set 3.5 seconds into the future for countdown buffer
      const startTime = Date.now() + 3200;
      const payload: RoundPayload = {
        roundIndex,
        totalRounds,
        track,
        startTime,
        duration: 30,
      };

      broadcastMessage('ROUND_PREPARE', payload);
    },
    [currentPlayer.isHost, broadcastMessage]
  );

  // Host: End round and show reveal
  const endRound = useCallback(
    (track: Track) => {
      if (!currentPlayer.isHost) return;

      const scoreMap: Record<string, number> = {};
      players.forEach((p) => {
        scoreMap[p.id] = p.score;
      });

      broadcastMessage('ROUND_END', {
        track,
        scores: scoreMap,
      });
    },
    [currentPlayer.isHost, players, broadcastMessage]
  );

  // Host: Final Game Over
  const endGame = useCallback(
    (finalPlayers: Player[]) => {
      if (!currentPlayer.isHost) return;
      broadcastMessage('GAME_OVER', { finalPlayers });
    },
    [currentPlayer.isHost, broadcastMessage]
  );

  // Host: Return to lobby
  const returnToLobby = useCallback(() => {
    if (!currentPlayer.isHost) return;
    broadcastMessage('RETURN_TO_LOBBY', {});
  }, [currentPlayer.isHost, broadcastMessage]);

  return {
    players,
    roomStatus,
    currentRoundPayload,
    myScore,
    hasGuessedCorrect,
    availableScore,
    roundTimeRemaining,
    isCountingDown,
    countdownSeconds,
    revealedTrack,
    recentScorer,
    isSupabaseConnected,
    submitCorrectGuess,
    startNextRound,
    endRound,
    endGame,
    returnToLobby,
  };
}
