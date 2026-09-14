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
  const initialPlayer: Player = {
    id: currentPlayer.id,
    name: currentPlayer.name,
    avatar: currentPlayer.avatar,
    color: currentPlayer.color,
    score: 0,
    roundScore: 0,
    hasGuessedCorrect: false,
    hasSubmittedGuess: false,
    isHost: currentPlayer.isHost,
    joinedAt: Date.now(),
  };

  const [players, setPlayers] = useState<Player[]>([initialPlayer]);
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
  const isSubscribedRef = useRef<boolean>(false);
  const pendingMessagesRef = useRef<Array<{ event: string; payload: any }>>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const isHostRef = useRef<boolean>(currentPlayer.isHost);
  const currentRoundPayloadRef = useRef<RoundPayload | null>(null);
  const roundActiveRef = useRef<boolean>(false);
  const playersRef = useRef<Player[]>([initialPlayer]);

  useEffect(() => {
    isHostRef.current = currentPlayer.isHost;
  }, [currentPlayer.isHost]);

  useEffect(() => {
    currentRoundPayloadRef.current = currentRoundPayload;
  }, [currentRoundPayload]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

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

  // Helper to send broadcast messages (via Supabase Realtime OR local BroadcastChannel)
  const broadcastMessage = useCallback(
    (event: string, payload: any) => {
      // 1. Supabase Broadcast: Only send over WebSocket when state is joined to prevent REST fallback warnings
      if (channelRef.current) {
        if (channelRef.current.state === 'joined') {
          channelRef.current
            .send({
              type: 'broadcast',
              event,
              payload,
            })
            .catch((err) => {
              console.warn('Supabase broadcast send error:', err);
            });
        } else {
          // Channel is still subscribing or reconnecting; buffer message
          pendingMessagesRef.current.push({ event, payload });
        }
      }

      // 2. BroadcastChannel for local/multi-tab fallback
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ event, payload });
        } catch (e) {
          console.warn('BroadcastChannel postMessage error:', e);
        }
      }
    },
    []
  );

  // Host: End round and show reveal screen
  const endRound = useCallback(
    (track: Track) => {
      if (!isHostRef.current) return;

      roundActiveRef.current = false;
      clearTimers();

      setRoomStatus('round_reveal');
      setRevealedTrack(track);

      // Snapshot latest player scores
      const scoreMap: Record<string, number> = {};
      playersRef.current.forEach((p) => {
        scoreMap[p.id] = p.score;
      });

      broadcastMessage('ROUND_END', {
        track,
        scores: scoreMap,
      });

      if (onRoundEnd) {
        onRoundEnd(track, scoreMap);
      }
    },
    [clearTimers, broadcastMessage, onRoundEnd]
  );

  // Check whether all active players have finished their turn (guessed correctly or passed); if so, end the round immediately
  const checkAndEndRoundIfAllGuessed = useCallback(
    (currentRoster: Player[]) => {
      if (!isHostRef.current) return;
      if (!roundActiveRef.current && roomStatus !== 'playing') return;

      const track = currentRoundPayloadRef.current?.track;
      if (!track) return;

      const activeList = currentRoster.length > 0 ? currentRoster : playersRef.current;
      if (activeList.length === 0) return;

      const allDone = activeList.every(
        (p) => p.hasGuessedCorrect || p.hasSubmittedGuess
      );

      if (allDone) {
        roundActiveRef.current = false;
        clearTimers();
        endRound(track);
      }
    },
    [clearTimers, endRound, roomStatus]
  );

  // Client-side decaying score calculation synchronized to round startTime
  const startRoundTimer = useCallback((payload: RoundPayload) => {
    clearTimers();
    roundActiveRef.current = true;
    currentRoundPayloadRef.current = payload;

    const checkInterval = 50; // High precision 50ms interval for score decay
    const duration = payload.duration || 30;

    timerIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - payload.startTime) / 1000);
      const remaining = Math.max(0, duration - elapsedSeconds);

      setRoundTimeRemaining(Math.ceil(remaining));

      // Decaying Score formula: starts at 1000, decays linearly over 30s
      if (remaining <= 0) {
        setAvailableScore(0);
        clearTimers();
        // TRIGGER 1: Round End on 30s timeout
        if (isHostRef.current && roundActiveRef.current) {
          roundActiveRef.current = false;
          endRound(payload.track);
        }
      } else {
        const decayFactor = remaining / duration;
        const currentDecayedScore = Math.max(100, Math.round(1000 * decayFactor));
        setAvailableScore(currentDecayedScore);
      }
    }, checkInterval);
  }, [clearTimers, endRound]);

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
          currentRoundPayloadRef.current = payload;
          roundActiveRef.current = false;

          // Reset all players' round state for the new round, preserving cumulative score
          const resetList = playersRef.current.map((p) => ({
            ...p,
            roundScore: 0,
            hasGuessedCorrect: false,
            hasSubmittedGuess: false,
            guessTimeSeconds: undefined,
          }));
          playersRef.current = resetList;
          setPlayers(resetList);

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

          const prev = playersRef.current;
          const found = prev.some((p) => p.id === scoreEvent.playerId);
          const updated = found
            ? prev.map((p) => {
                if (p.id === scoreEvent.playerId) {
                  return {
                    ...p,
                    score: Math.max(p.score, scoreEvent.totalScore),
                    roundScore: scoreEvent.pointsAwarded,
                    hasGuessedCorrect: true,
                    hasSubmittedGuess: true,
                    guessTimeSeconds: scoreEvent.guessTimeSeconds,
                  };
                }
                return p;
              })
            : [
                ...prev,
                {
                  id: scoreEvent.playerId,
                  name: scoreEvent.playerName,
                  avatar: '🎵',
                  color: '#8b5cf6',
                  score: scoreEvent.totalScore,
                  roundScore: scoreEvent.pointsAwarded,
                  hasGuessedCorrect: true,
                  hasSubmittedGuess: true,
                  guessTimeSeconds: scoreEvent.guessTimeSeconds,
                  isHost: false,
                  joinedAt: Date.now(),
                },
              ];

          playersRef.current = updated;
          setPlayers(updated);

          // Check if all active players have now guessed or submitted
          checkAndEndRoundIfAllGuessed(updated);
          break;
        }

        case 'PLAYER_SKIPPED': {
          const skipEvent = payload as PlayerScoreEvent;
          const prev = playersRef.current;
          const updated = prev.map((p) => {
            if (p.id === skipEvent.playerId) {
              return {
                ...p,
                roundScore: 0,
                hasGuessedCorrect: false,
                hasSubmittedGuess: true,
              };
            }
            return p;
          });

          playersRef.current = updated;
          setPlayers(updated);

          // Check if all active players have now submitted a guess
          checkAndEndRoundIfAllGuessed(updated);
          break;
        }

        case 'ROUND_END': {
          clearTimers();
          roundActiveRef.current = false;
          setRoomStatus('round_reveal');
          setRevealedTrack(payload.track);
          if (payload.scores) {
            setPlayers((prev) => {
              const updated = prev.map((p) => ({
                ...p,
                score: payload.scores[p.id] !== undefined ? Math.max(p.score, payload.scores[p.id]) : p.score,
              }));
              playersRef.current = updated;
              return updated;
            });
          }
          if (onRoundEnd) {
            onRoundEnd(payload.track, payload.scores || {});
          }
          break;
        }

        case 'GAME_OVER': {
          clearTimers();
          roundActiveRef.current = false;
          setRoomStatus('game_over');
          if (payload.finalPlayers && payload.finalPlayers.length > 0) {
            setPlayers(payload.finalPlayers);
            playersRef.current = payload.finalPlayers;
          }
          if (onGameOver) {
            onGameOver(payload.finalPlayers || playersRef.current);
          }
          break;
        }

        case 'RETURN_TO_LOBBY': {
          clearTimers();
          roundActiveRef.current = false;
          setRoomStatus('lobby');
          setCurrentRoundPayload(null);
          setRevealedTrack(null);
          setHasGuessedCorrect(false);
          setPlayers((prev) => {
            const updated = prev.map((p) => ({
              ...p,
              score: 0,
              roundScore: 0,
              hasGuessedCorrect: false,
              hasSubmittedGuess: false,
            }));
            playersRef.current = updated;
            return updated;
          });
          setMyScore(0);
          break;
        }

        default:
          break;
      }
    },
    [clearTimers, onRoundStart, onRoundEnd, onGameOver, startRoundTimer, endRound]
  );

  // Connect to Supabase Realtime channel + Fallback BroadcastChannel
  useEffect(() => {
    if (!roomCode) return;

    // Immediately put self into players roster
    setPlayers((prev) => {
      if (!prev.some((p) => p.id === currentPlayer.id)) {
        return [selfPlayer];
      }
      return prev;
    });

    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;

    if (supabase) {
      const channelName = `songspot_room_${roomCode.toUpperCase()}`;

      channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: currentPlayer.id,
          },
          broadcast: {
            self: false,
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

            // Ensure self is in the roster even if presence state is momentarily empty
            if (!roster.some((r) => r.id === currentPlayer.id)) {
              roster.push(selfPlayer);
            }

            // Merge with existing players to preserve live round scores and guess states
            const updated = roster.map((p) => {
              const existing = playersRef.current.find((x) => x.id === p.id);
              if (!existing) return p;
              return {
                ...p,
                score: Math.max(p.score, existing.score),
                roundScore: existing.roundScore !== undefined ? existing.roundScore : p.roundScore,
                hasGuessedCorrect: existing.hasGuessedCorrect || p.hasGuessedCorrect || false,
                hasSubmittedGuess: existing.hasSubmittedGuess || p.hasSubmittedGuess || false,
                guessTimeSeconds: existing.guessTimeSeconds || p.guessTimeSeconds,
              };
            });
            playersRef.current = updated;
            setPlayers(updated);
            checkAndEndRoundIfAllGuessed(updated);
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
      channel.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          setIsSupabaseConnected(true);
          try {
            await channel?.track({
              id: currentPlayer.id,
              name: currentPlayer.name,
              avatar: currentPlayer.avatar,
              color: currentPlayer.color,
              isHost: currentPlayer.isHost,
              score: myScore,
              joinedAt: Date.now(),
            });
          } catch (trackErr) {
            console.warn('Error tracking presence:', trackErr);
          }

          // Flush any broadcast messages that were queued while subscribing
          while (pendingMessagesRef.current.length > 0) {
            const msg = pendingMessagesRef.current.shift();
            if (msg) {
              channel?.send({
                type: 'broadcast',
                event: msg.event,
                payload: msg.payload,
              }).catch((sendErr) => console.warn('Flush send error:', sendErr));
            }
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('Supabase channel subscription error:', err);
          isSubscribedRef.current = false;
          setIsSupabaseConnected(false);
        } else if (status === 'TIMED_OUT') {
          console.warn('Supabase channel subscription timed out');
          isSubscribedRef.current = false;
        } else if (status === 'CLOSED') {
          isSubscribedRef.current = false;
        }
      });
    } else {
      setIsSupabaseConnected(false);
    }

    // 3. Fallback / Cross-Tab BroadcastChannel
    // Enables multi-tab or local party testing without Supabase credentials
    let bc: BroadcastChannel | null = null;
    let heartbeatInterval: number | null = null;

    try {
      bc = new BroadcastChannel(`songspot_channel_${roomCode.toUpperCase()}`);
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        if (event.data?.event) {
          handleBroadcastEvent(event.data.event, event.data.payload);
        }
        if (event.data?.type === 'HEARTBEAT') {
          const peer = event.data.player as Player;
          if (peer.id === currentPlayer.id) return;
          setPlayers((prev) => {
            const existing = prev.find((p) => p.id === peer.id);
            if (!existing) {
              const updated = [...prev, peer];
              playersRef.current = updated;
              return updated;
            }
            const updated = prev.map((p) =>
              p.id === peer.id
                ? {
                    ...p,
                    name: peer.name,
                    avatar: peer.avatar,
                    color: peer.color,
                    isHost: peer.isHost,
                    score: Math.max(p.score, peer.score),
                  }
                : p
            );
            playersRef.current = updated;
            return updated;
          });
        }
      };

      // Periodic heartbeat for presence in BroadcastChannel mode
      heartbeatInterval = window.setInterval(() => {
        bc?.postMessage({
          type: 'HEARTBEAT',
          player: selfPlayer,
        });
      }, 1500);
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    return () => {
      clearTimers();
      isSubscribedRef.current = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
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
      const pointsWon = Math.max(100, availableScore);
      const newTotalScore = myScore + pointsWon;

      setHasGuessedCorrect(true);
      setMyScore(newTotalScore);

      const scorePayload: PlayerScoreEvent = {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        roundIndex: currentRoundPayload.roundIndex,
        pointsAwarded: pointsWon,
        guessTimeSeconds: guessTime,
        totalScore: newTotalScore,
      };

      // Show recent scorer toast locally
      setRecentScorer({ name: currentPlayer.name, points: pointsWon });
      setTimeout(() => setRecentScorer(null), 3000);

      // Broadcast to remote peers
      broadcastMessage('PLAYER_GUESSED', scorePayload);

      // Update presence with the new score
      if (channelRef.current && channelRef.current.state === 'joined') {
        channelRef.current.track({
          id: currentPlayer.id,
          name: currentPlayer.name,
          avatar: currentPlayer.avatar,
          color: currentPlayer.color,
          isHost: currentPlayer.isHost,
          score: newTotalScore,
          joinedAt: Date.now(),
        }).catch(() => {});
      }

      // Update local players state immediately for the live scoreboard
      const prev = playersRef.current;
      const found = prev.some((p) => p.id === currentPlayer.id);
      const updated = found
        ? prev.map((p) => {
            if (p.id === currentPlayer.id) {
              return {
                ...p,
                score: newTotalScore,
                roundScore: pointsWon,
                hasGuessedCorrect: true,
                hasSubmittedGuess: true,
                guessTimeSeconds: guessTime,
              };
            }
            return p;
          })
        : [
            ...prev,
            {
              id: currentPlayer.id,
              name: currentPlayer.name,
              avatar: currentPlayer.avatar,
              color: currentPlayer.color,
              score: newTotalScore,
              roundScore: pointsWon,
              hasGuessedCorrect: true,
              hasSubmittedGuess: true,
              guessTimeSeconds: guessTime,
              isHost: currentPlayer.isHost,
              joinedAt: Date.now(),
            },
          ];

      playersRef.current = updated;
      setPlayers(updated);

      // Instantly evaluate whether all active players have guessed
      checkAndEndRoundIfAllGuessed(updated);
    },
    [
      hasGuessedCorrect,
      roomStatus,
      currentRoundPayload,
      availableScore,
      currentPlayer.id,
      currentPlayer.name,
      currentPlayer.avatar,
      currentPlayer.color,
      currentPlayer.isHost,
      myScore,
      broadcastMessage,
      checkAndEndRoundIfAllGuessed,
    ]
  );

  // Submit skip (give up on current round)
  const submitSkipGuess = useCallback(() => {
    if (hasGuessedCorrect || roomStatus !== 'playing' || !currentRoundPayload) return;

    setHasGuessedCorrect(false);

    const skipPayload: PlayerScoreEvent = {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      roundIndex: currentRoundPayload.roundIndex,
      pointsAwarded: 0,
      guessTimeSeconds: 30,
      totalScore: myScore,
    };

    broadcastMessage('PLAYER_SKIPPED', skipPayload);

    const prev = playersRef.current;
    const found = prev.some((p) => p.id === currentPlayer.id);
    const updated = found
      ? prev.map((p) => {
          if (p.id === currentPlayer.id) {
            return {
              ...p,
              roundScore: 0,
              hasGuessedCorrect: false,
              hasSubmittedGuess: true,
            };
          }
          return p;
        })
      : [
          ...prev,
          {
            id: currentPlayer.id,
            name: currentPlayer.name,
            avatar: currentPlayer.avatar,
            color: currentPlayer.color,
            score: myScore,
            roundScore: 0,
            hasGuessedCorrect: false,
            hasSubmittedGuess: true,
            isHost: currentPlayer.isHost,
            joinedAt: Date.now(),
          },
        ];

    playersRef.current = updated;
    setPlayers(updated);

    // Instantly evaluate whether all active players have guessed/passed
    checkAndEndRoundIfAllGuessed(updated);
  }, [
    hasGuessedCorrect,
    roomStatus,
    currentRoundPayload,
    currentPlayer.id,
    currentPlayer.name,
    currentPlayer.avatar,
    currentPlayer.color,
    currentPlayer.isHost,
    myScore,
    broadcastMessage,
    checkAndEndRoundIfAllGuessed,
  ]);

  // Host: Prepare and start next round
  const startNextRound = useCallback(
    (roundIndex: number, totalRounds: number, track: Track) => {
      if (!isHostRef.current) return;

      // Start time is set 3.2 seconds into the future for countdown buffer
      const startTime = Date.now() + 3200;
      const payload: RoundPayload = {
        roundIndex,
        totalRounds,
        track,
        startTime,
        duration: 30,
      };

      handleBroadcastEvent('ROUND_PREPARE', payload);
      broadcastMessage('ROUND_PREPARE', payload);
    },
    [broadcastMessage, handleBroadcastEvent]
  );

  // Host: Final Game Over
  const endGame = useCallback(
    (finalPlayers: Player[]) => {
      if (!isHostRef.current) return;
      roundActiveRef.current = false;
      clearTimers();
      handleBroadcastEvent('GAME_OVER', { finalPlayers });
      broadcastMessage('GAME_OVER', { finalPlayers });
    },
    [clearTimers, handleBroadcastEvent, broadcastMessage]
  );

  // Host: Return to lobby
  const returnToLobby = useCallback(() => {
    if (!isHostRef.current) return;
    roundActiveRef.current = false;
    clearTimers();
    handleBroadcastEvent('RETURN_TO_LOBBY', {});
    broadcastMessage('RETURN_TO_LOBBY', {});
  }, [clearTimers, handleBroadcastEvent, broadcastMessage]);

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
    submitSkipGuess,
    startNextRound,
    endRound,
    endGame,
    returnToLobby,
  };
}
