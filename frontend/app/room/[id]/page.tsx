"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion as m, AnimatePresence } from "framer-motion";
import { Gamepad2, Trophy, ArrowLeft, Swords, Crown, User, RefreshCw, ShieldAlert, Send, RotateCcw, RotateCw } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { UserProfile } from "@/lib/api";
import { socket, connectSocket } from "@/lib/socket";
import CardBack from "@/cards/CardBack";
import NumberCard from "@/cards/NumberCard";
import ActionCard from "@/cards/ActionCard";
import WildCard from "@/cards/WildCard";
import SuperCard from "@/cards/SuperCard";

interface RoomPlayer {
  _id: string;
  fullName: string;
  username: string;
  trophies: number;
  league: string;
  socketId: string;
  connected?: boolean;
}

interface RoomState {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  gameStarted: boolean;
  gameState: any | null;
}

interface MatchResult {
  userId: string;
  username: string;
  trophyChange: number;
}

/* ------------------------------------------------------------------ */
/*  Circular table positioning (self = bottom center)                  */
/*  Distributes opponents evenly along the top arc of an ellipse.      */
/* ------------------------------------------------------------------ */
const getOpponentPositions = (count: number) => {
  const positions: { top: string; left: string; transform: string }[] = [];
  // Center of the circular/elliptical table layout
  const cx = 50;
  const cy = 48;
  const rx = 42;
  const ry = 38;
  // Spread opponents along the top arc from -30° (Right/Bottom-Right) to 210° (Left/Bottom-Left)
  // This layout flows counter-clockwise (Right -> Top -> Left), matching visual seating order.
  const startAngle = (-30 * Math.PI) / 180;
  const totalArc = (240 * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const fraction = count === 1 ? 0.5 : i / (count - 1);
    const angle = startAngle + fraction * totalArc;
    const x = cx + rx * Math.cos(angle);
    const y = cy - ry * Math.sin(angle);
    positions.push({
      top: `${Math.max(2, Math.min(55, y))}%`,
      left: `${Math.max(3, Math.min(97, x))}%`,
      transform: "translate(-50%, -50%)",
    });
  }
  return positions;
};

/* ------------------------------------------------------------------ */
/*  Opponent Card Stack (visual card backs)                           */
/* ------------------------------------------------------------------ */
const OpponentCardStack = React.memo(({ count }: { count: number }) => {
  const visibleBacks = Math.min(count, 4);
  const isDanger = count <= 2 && count > 0;
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Card back fans */}
      <div className="relative h-9 flex items-center justify-center" style={{ width: `${24 + visibleBacks * 6}px` }}>
        {Array.from({ length: visibleBacks }).map((_, i) => (
          <div
            key={i}
            className="absolute w-6 h-9 rounded bg-surface border border-accent/25"
            style={{
              left: `${i * 6}px`,
              zIndex: i,
              transform: `rotate(${(i - (visibleBacks - 1) / 2) * 5}deg)`,
            }}
          >
            <div className="w-full h-full rounded bg-gradient-to-br from-gray-800 to-black flex items-center justify-center">
              <div className="w-2 h-2 rounded-full border border-accent/30" />
            </div>
          </div>
        ))}
      </div>
      {/* Count badge — large and prominent */}
      <span className={`text-[0.7rem] font-black px-2 py-0.5 rounded-md border ${
        isDanger
          ? "text-card-red bg-card-red/10 border-card-red/30"
          : "text-white bg-white/5 border-white/10"
      }`}>
        {count}
      </span>
    </div>
  );
});
OpponentCardStack.displayName = "OpponentCardStack";

/* ------------------------------------------------------------------ */
/*  Opponent Panel (positioned around table)                          */
/* ------------------------------------------------------------------ */
const OpponentPanel = React.memo(({
  player,
  cardCount,
  isActive,
  isDisconnected,
  position,
}: {
  player: RoomPlayer;
  cardCount: number;
  isActive: boolean;
  isDisconnected: boolean;
  position: { top: string; left: string; transform: string };
}) => {
  return (
    <m.div
      className={`absolute z-10 flex flex-col items-center px-2.5 py-2 rounded-xl border-2 backdrop-blur-sm min-w-[80px] max-w-[100px] ${
        isDisconnected
          ? "opacity-40 bg-black/50 border-dashed border-white/10"
          : isActive
          ? "bg-accent/15 border-accent shadow-[0_0_12px_rgba(250,229,0,0.15)]"
          : "bg-black/50 border-white/[0.06]"
      }`}
      style={{
        top: position.top,
        left: position.left,
        transform: position.transform,
      }}
      animate={{
        scale: isActive ? 1.05 : 1,
        borderColor: isActive ? "rgba(250,229,0,0.7)" : isDisconnected ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
      }}
      transition={{ duration: 0.25 }}
    >
      {/* Username */}
      <div className="flex items-center gap-1 mb-1">
        <div
          className={`w-4 h-4 rounded-full flex items-center justify-center ${
            isDisconnected
              ? "bg-card-red/20 text-card-red"
              : isActive
              ? "bg-accent/30 text-accent"
              : "bg-white/5 text-gray-400"
          }`}
        >
          <User className="w-2.5 h-2.5" />
        </div>
        <span className={`text-[0.65rem] font-bold truncate max-w-[60px] ${isActive ? "text-accent" : ""}`}>
          {player.username}
        </span>
      </div>

      {/* Disconnected label */}
      {isDisconnected && (
        <span className="text-[0.5rem] text-card-red font-black uppercase tracking-wider mb-0.5">
          Offline
        </span>
      )}

      {/* Card stack */}
      <OpponentCardStack count={cardCount} />
    </m.div>
  );
});
OpponentPanel.displayName = "OpponentPanel";

/* ================================================================== */
/*  MAIN ROOM PAGE COMPONENT                                          */
/* ================================================================== */
export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params.id as string).toUpperCase();

  const { user, isLoading: authLoading } = useAuth();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSocketDisconnected, setIsSocketDisconnected] = useState(false);

  // Overlay state: Color picking or Targeting
  const [overlay, setOverlay] = useState<{
    type: "color" | "target" | null;
    card: any | null;
  }>({ type: null, card: null });

  const [showExitModal, setShowExitModal] = useState(false);
  const [showDisbandModal, setShowDisbandModal] = useState(false);
  const [roundEnding, setRoundEnding] = useState(false);
  const [roundWinnerName, setRoundWinnerName] = useState("");
  const isLeavingRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;

    connectSocket();

    const joinRoom = () => {
      socket.emit("join_room", { roomId, user });
    };

    if (socket.connected) {
      joinRoom();
    }

    setLoading(false);

    // Grace period timer ref — prevents overlay flash on programmatic reconnects
    let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;

    const onConnect = () => {
      console.log("[Room] Socket connected, joining room...");
      // Cancel any pending grace timer — reconnected in time
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
      }
      setIsSocketDisconnected(false);
      joinRoom();
    };

    const onDisconnect = (reason: string) => {
      console.log("[Room] Socket disconnected:", reason);
      // For intentional client-side disconnects (e.g. page navigation), show immediately
      if (reason === "io client disconnect") {
        return; // We're leaving the page, no need for overlay
      }
      // For all other disconnects, wait 3 seconds before showing overlay
      // This prevents flash during token refresh or brief network hiccups
      if (disconnectGraceTimer) clearTimeout(disconnectGraceTimer);
      disconnectGraceTimer = setTimeout(() => {
        disconnectGraceTimer = null;
        // Only show if still disconnected
        if (!socket.connected) {
          setIsSocketDisconnected(true);
        }
      }, 3000);
    };

    const onConnectError = (err: any) => {
      console.warn("[Room] Socket connection error:", err.message);
      // Don't set isSocketDisconnected here — socket.io will auto-retry
      // and the disconnect handler's grace period covers real failures
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    // Socket listeners
    socket.on("room_update", (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      // Clear match results if game is restarted
      if (!updatedRoom.gameStarted) {
        setMatchResults(null);
      }
    });

    socket.on("sync_game_state", (state: any) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          gameStarted: true,
          gameState: state
        };
      });
    });

    socket.on("match_end", (results: MatchResult[]) => {
      setRoundEnding(true);
      const winner = results[0];
      if (winner) {
        setRoundWinnerName(winner.username);
      }
      setTimeout(() => {
        setMatchResults(results);
        setRoundEnding(false);
      }, 2000);
    });

    socket.on("room_disbanded", () => {
      isLeavingRef.current = true;
      setShowDisbandModal(true);
    });

    socket.on("error_message", (msg: string) => {
      setError(msg);
      if (msg === "Room not found" || msg === "Game already in progress" || msg.includes("not active")) {
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        setTimeout(() => setError(""), 4000);
      }
    });

    return () => {
      // Clear grace timer on cleanup
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
      }
      // Clean up socket connections and events
      socket.emit("leave_room", roomId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room_update");
      socket.off("sync_game_state");
      socket.off("match_end");
      socket.off("room_disbanded");
      socket.off("error_message");
    };
  }, [roomId, router, user, authLoading]);

  const handleStartGame = useCallback(() => {
    socket.emit("start_game", roomId);
  }, [roomId]);

  const handleLeaveRoom = useCallback(() => {
    socket.emit("leave_room", roomId);
    router.replace("/");
  }, [roomId, router]);

  const confirmLeave = useCallback(() => {
    setShowExitModal(false);
    isLeavingRef.current = true;
    handleLeaveRoom();
  }, [handleLeaveRoom]);

  const handleDisbandExit = useCallback(() => {
    setShowDisbandModal(false);
    router.replace("/");
  }, [router]);

  // Intercept accidental exit / reload / browser back button navigation during active match
  useEffect(() => {
    const isGameStarted = room?.gameStarted && room?.gameState;
    if (!isGameStarted || matchResults) return;

    // A. Intercept browser page refresh, tab closing, external URL navigation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLeavingRef.current) return;
      e.preventDefault();
      e.returnValue = "You are currently in an active match. Leaving now may affect gameplay.";
      return e.returnValue;
    };

    // B. Intercept Next.js page back button and device/Android hardware back gesture
    // We push a dummy state to history to absorb back-button transitions
    window.history.pushState({ noBack: true }, "", window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      if (isLeavingRef.current) return;
      // Immediately restore dummy state to prevent router from popping current path
      window.history.pushState({ noBack: true }, "", window.location.href);
      // Open our modern exit confirmation modal
      setShowExitModal(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [room?.gameStarted, room?.gameState, matchResults]);

  const handleDisbandRoom = useCallback(() => {
    socket.emit("disband_room", roomId);
  }, [roomId]);

  const handlePlayAgain = useCallback(() => {
    socket.emit("play_again", roomId);
  }, [roomId]);

  // Card click handler
  const handleCardClick = useCallback((card: any) => {
    if (roundEnding) return;
    if (!room?.gameState) return;
    const state = room.gameState;
    const isOurTurn = room.players[state.turnIndex]._id === user?._id;
    if (!isOurTurn) {
      setError("It's not your turn!");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Check if card requires a target (Slam only — Couple removed)
    const requiresTarget = ["Slam"].includes(card.value);
    // Check if card requires color selection (Wild, Super)
    const requiresColor = ["Wild", "Super"].includes(card.type) || card.color === "Any";

    if (requiresTarget || requiresColor) {
      setOverlay({
        type: requiresTarget ? "target" : "color",
        card
      });
    } else {
      // Standard Card Play
      socket.emit("player_action", {
        roomId,
        action: "play_card",
        payload: { card }
      });
    }
  }, [room, user, roomId, roundEnding]);

  const submitPlayWithPayload = useCallback((selectedColor?: string, targetId?: string) => {
    if (!overlay.card) return;
    socket.emit("player_action", {
      roomId,
      action: "play_card",
      payload: {
        card: overlay.card,
        selectedColor,
        targetId
      }
    });
    setOverlay({ type: null, card: null });
  }, [overlay.card, roomId]);

  const handleDrawCard = useCallback(() => {
    if (roundEnding) return;
    if (!room?.gameState) return;
    const state = room.gameState;
    const isOurTurn = room.players[state.turnIndex]._id === user?._id;
    if (!isOurTurn) return;

    socket.emit("player_action", {
      roomId,
      action: "draw_card"
    });
  }, [room, user, roomId, roundEnding]);

  const handlePassTurn = useCallback(() => {
    if (roundEnding) return;
    if (!room?.gameState) return;
    const state = room.gameState;
    const isOurTurn = room.players[state.turnIndex]._id === user?._id;
    if (!isOurTurn) return;

    socket.emit("player_action", {
      roomId,
      action: "pass_turn"
    });
  }, [room, user, roomId, roundEnding]);

  // Render proper game card component helper
  const renderGameCard = useCallback((card: any, index: number, isPlayable: boolean) => {
    const key = card.id || index;
    const onClick = () => handleCardClick(card);
    
    if (card.type === "Number") {
      return <NumberCard key={key} value={card.value} colorTheme={card.color.toLowerCase() as any} isPlayable={isPlayable} onClick={onClick} />;
    } else if (card.type === "Action") {
      return <ActionCard key={key} value={card.value} colorTheme={card.color.toLowerCase() as any} isPlayable={isPlayable} onClick={onClick} />;
    } else if (card.type === "Wild") {
      return <WildCard key={key} value={card.value} isPlayable={isPlayable} onClick={onClick} />;
    } else if (card.type === "Super") {
      return <SuperCard key={key} value={card.value} isPlayable={isPlayable} onClick={onClick} />;
    }
    return <CardBack key={key} />;
  }, [handleCardClick]);

  // Check if a card is playable in the current hand
  const isCardPlayable = useCallback((card: any) => {
    if (roundEnding) return false;
    if (!room?.gameState || !room?.gameStarted || !user) return false;
    const state = room.gameState;
    const activePlayer = room.players[state.turnIndex];
    if (activePlayer._id !== user._id) return false;

    const levels: Record<string, number> = { "+2": 2, "+4": 4, "+6": 6, "+10": 10, "PunchBack": 99 };
    const topCard = state.discardPile[state.discardPile.length - 1];

    if (state.stackingCards > 0) {
      const cardLevel = levels[card.value];
      if (!cardLevel) return false;
      const requiredLevel = levels[topCard.value] || 0;
      return cardLevel >= requiredLevel;
    }

    return (card.color === "Any" || card.color === state.activeColor || card.value === topCard.value);
  }, [room, user, roundEnding]);

  // Memoize opponent data relative to the current player's seat position
  const opponentData = useMemo(() => {
    if (!room?.gameState || !user) return [];
    
    // Find current player's index in the authoritative players list (join order / gameplay sequence)
    const myIndex = room.players.findIndex(p => p._id === user._id);
    const totalPlayers = room.players.length;
    
    let opponents: RoomPlayer[] = [];
    if (myIndex !== -1 && totalPlayers > 1) {
      // Order opponents starting from the player after the current player, wrapping around
      for (let i = 1; i < totalPlayers; i++) {
        opponents.push(room.players[(myIndex + i) % totalPlayers]);
      }
    } else {
      // Spectator or fallback case
      opponents = room.players.filter(p => p._id !== user._id);
    }
    
    const positions = getOpponentPositions(opponents.length);
    return opponents.map((player, i) => ({
      player,
      cardCount: room.gameState.hands[player._id]?.length || 0,
      isActive: room.players[room.gameState.turnIndex]?._id === player._id,
      isDisconnected: player.connected === false,
      position: positions[i],
    }));
  }, [room, user]);

  if (loading || authLoading || !user || !room) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-game-bg text-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm tracking-widest uppercase">Joining Lobby...</p>
        </div>
      </div>
    );
  }

  const isHost = room.hostId === user?._id;
  const isGameStarted = room.gameStarted && room.gameState;
  const state = room.gameState;

  return (
    <div className={`bg-game-bg text-white relative flex flex-col ${isGameStarted ? 'h-dvh overflow-hidden' : 'min-h-screen overflow-hidden'}`}>
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/3 blur-[150px] pointer-events-none" />

      {/* Floating Error Toast */}
      <AnimatePresence>
        {error && (
          <m.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-lg bg-card-red/10 border border-card-red/30 text-card-red text-sm font-bold"
          >
            {error}
          </m.div>
        )}
      </AnimatePresence>

      {/* -------------------- 1. RESULTS SCREEN -------------------- */}
      {matchResults && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <m.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg glass-panel rounded-2xl p-8 border border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-card-red via-accent to-card-green" />
            <h2 className="text-3xl font-black italic tracking-tighter text-center text-accent mb-6 uppercase flex items-center justify-center gap-2">
              <Swords className="w-8 h-8 text-card-red" />
              Match Standings
            </h2>

            <div className="space-y-3 mb-8">
              {matchResults.map((res, index) => {
                const isWinner = index === 0;
                return (
                  <div key={res.userId} className={`flex items-center justify-between p-4 rounded-xl border ${isWinner ? "bg-accent/10 border-accent text-accent" : "bg-black/35 border-white/5"}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-lg">#{index + 1}</span>
                      <span className="font-bold">{res.username}</span>
                    </div>
                    <span className={`font-black tracking-wide ${res.trophyChange > 0 ? "text-card-green" : "text-card-red"}`}>
                      {res.trophyChange > 0 ? `+${res.trophyChange}` : res.trophyChange} Trophies
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              {isHost ? (
                <>
                  <button
                    onClick={handlePlayAgain}
                    className="flex-1 py-3 bg-accent hover:bg-yellow-400 text-black font-black uppercase rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Play Again
                  </button>
                  <button
                    onClick={handleDisbandRoom}
                    className="flex-1 py-3 border border-card-red/20 bg-card-red/5 hover:bg-card-red/10 text-card-red font-black uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Disband
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-3 border border-white/10 hover:border-white/20 bg-white/5 text-white font-black uppercase rounded-lg transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </m.div>
        </div>
      )}

      {/* -------------------- 2. OVERLAYS (Color/Target Selector) -------------------- */}
      <AnimatePresence>
        {overlay.type && (
          <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm glass-panel rounded-2xl p-6 border border-white/10"
            >
              {overlay.type === "color" ? (
                <div>
                  <h3 className="text-lg font-bold text-center mb-4 uppercase tracking-wide">
                    Choose Active Color
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {["Red", "Blue", "Green", "Yellow"].map((color) => {
                      const bgClasses: Record<string, string> = {
                        Red: "bg-card-red hover:bg-red-500",
                        Blue: "bg-card-blue hover:bg-blue-500",
                        Green: "bg-card-green hover:bg-green-500",
                        Yellow: "bg-card-yellow hover:bg-yellow-500",
                      };
                      return (
                        <button
                          key={color}
                          onClick={() => submitPlayWithPayload(color)}
                          className={`py-6 rounded-xl text-black font-black uppercase text-sm cursor-pointer transition-all hover:scale-105 ${bgClasses[color]}`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-center mb-4 uppercase tracking-wide">
                    Select Target Player
                  </h3>
                  <div className="space-y-2">
                    {room.players
                      .filter((p) => p._id !== user?._id)
                      .map((player) => (
                        <button
                          key={player._id}
                          onClick={() => submitPlayWithPayload(overlay.card.color === "Any" ? "Red" : undefined, player._id)}
                          className="w-full py-4 px-4 bg-black/40 border border-white/5 hover:border-accent hover:bg-accent/5 rounded-xl text-left font-bold flex items-center justify-between transition-all cursor-pointer group"
                        >
                          <span>{player.username}</span>
                          <Send className="w-4 h-4 text-gray-500 group-hover:text-accent transition-colors" />
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setOverlay({ type: null, card: null })}
                className="w-full mt-6 py-2 border border-white/10 hover:border-white/20 text-xs font-bold uppercase rounded-lg text-gray-400 transition-colors cursor-pointer"
              >
                Cancel Action
              </button>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- 3. LOBBY SCREEN -------------------- */}
      {!isGameStarted ? (
        <div className="flex-1 flex flex-col">
          <header className="border-b border-white/5 bg-black/40 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-6 h-6 text-accent" />
              <div>
                <h1 className="text-lg font-bold leading-none">Arena Lobby</h1>
                <p className="text-[0.65rem] text-gray-400 uppercase font-semibold">Chaos Deck</p>
              </div>
            </div>
            <button
              onClick={handleLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Lobby
            </button>
          </header>

          <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Box: Room Details */}
            <div className="md:col-span-1 space-y-6">
              <div className="glass-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden">
                <p className="text-[0.6rem] text-gray-400 font-bold uppercase tracking-widest">Arena Key</p>
                <div className="text-4xl font-black tracking-widest text-accent mt-1 bg-black/35 rounded-xl py-3 text-center border border-white/5 selection:bg-accent/20">
                  {roomId}
                </div>
                <p className="text-[0.65rem] text-gray-500 text-center mt-2.5">
                  Share this 5-digit code with friends to join the deck arena.
                </p>
              </div>

              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-accent" />
                  Host Controls
                </h3>
                {isHost ? (
                  <div className="space-y-2">
                    <button
                      onClick={handleStartGame}
                      disabled={room.players.length < 2}
                      className="w-full py-3 bg-accent hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(250,229,0,0.1)]"
                    >
                      <Swords className="w-5 h-5" />
                      Start Game
                    </button>
                    <button
                      onClick={handleDisbandRoom}
                      className="w-full py-2.5 border border-card-red/20 bg-card-red/5 hover:bg-card-red/10 text-card-red text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer"
                    >
                      Disband Arena
                    </button>
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-gray-400 font-semibold italic">
                    Waiting for the host to initiate...
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Player List */}
            <div className="md:col-span-2">
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-4 flex items-center justify-between">
                  <span>Players Queue</span>
                  <span className="text-xs bg-white/5 px-2 py-0.5 rounded border border-white/10 text-white font-bold">
                    {room.players.length} / 8
                  </span>
                </h3>

                <div className="space-y-2">
                  {room.players.map((player) => {
                    const isPlayerHost = room.hostId === player._id;
                    const isDisconnected = player.connected === false;
                    return (
                      <div key={player._id} className={`flex items-center justify-between p-4 rounded-xl border border-white/5 transition-opacity duration-300 ${isDisconnected ? "opacity-40 bg-black/40 border-dashed" : "bg-black/25"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDisconnected ? "bg-card-red/10 text-card-red" : isPlayerHost ? "bg-accent/10 text-accent border border-accent/20" : "bg-white/5 text-gray-400"}`}>
                            {isDisconnected ? <User className="w-4 h-4" /> : isPlayerHost ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-bold">{player.fullName}</span>
                            <span className="text-xs text-gray-500 ml-1.5 font-semibold">@{player.username}</span>
                            {isDisconnected && <span className="block text-[0.65rem] text-card-red font-black uppercase tracking-wider">Disconnected...</span>}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-accent uppercase bg-accent/5 px-2 py-0.5 rounded border border-accent/15 tracking-wide flex items-center gap-1">
                          {player.trophies}
                          <Trophy className="w-3.5 h-3.5 text-accent" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </main>
        </div>
      ) : (
        /* -------------------- 4. GAME SCREEN — TABLE LAYOUT -------------------- */
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Round Ending Overlay banner */}
          <AnimatePresence>
            {roundEnding && (
              <m.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="absolute top-[12%] left-1/2 -translate-x-1/2 z-30 bg-black/90 border border-accent/30 rounded-full py-2.5 px-6 shadow-[0_0_30px_rgba(250,229,0,0.1)] backdrop-blur-sm flex items-center gap-3 w-max"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-gray-300">
                  Round Complete! <span className="text-accent">{roundWinnerName}</span> played the final card.
                </span>
              </m.div>
            )}
          </AnimatePresence>

          {/* Top Panel (Turn indicators + Direction + Stacking) */}
          <div className="relative z-20 border-b border-white/5 bg-black/60 backdrop-blur-sm px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase hidden sm:inline">Arena:</span>
              <span className="text-accent font-black tracking-widest text-xs">{roomId}</span>
            </div>

            {/* Turn + Direction indicator */}
            <div className="flex items-center gap-3">
              {/* Direction */}
              <m.div
                key={state.direction}
                initial={{ rotate: state.direction === 1 ? -180 : 180 }}
                animate={{ rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-accent"
              >
                {state.direction === 1 ? (
                  <RotateCw className="w-4 h-4" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
              </m.div>

              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="font-bold text-xs uppercase tracking-wider text-gray-300">
                  <span className="text-accent font-black">{room.players[state.turnIndex]?.username}</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowExitModal(true)}
              className="text-[0.65rem] font-black uppercase tracking-wider px-3 py-1.5 border border-card-red/20 bg-card-red/5 hover:bg-card-red/10 text-card-red rounded-lg transition-colors cursor-pointer"
            >
              Surrender
            </button>
          </div>

          {/* Stacking Penalty Alert Banner */}
          <AnimatePresence>
            {state.stackingCards > 0 && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="relative z-10 bg-card-red text-black font-black uppercase text-xs py-2 text-center flex items-center justify-center gap-2 overflow-hidden"
              >
                <ShieldAlert className="w-4 h-4 stroke-[3]" />
                <span>Stack Active! Draw {state.stackingCards} cards or play a counter!</span>
              </m.div>
            )}
          </AnimatePresence>

          {/* ---- TABLE AREA ---- */}
          <div className="flex-1 relative overflow-hidden min-h-0">
            {/* Subtle table ellipse ring */}
            <div
              className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                width: "78%",
                height: "72%",
                border: "1px solid rgba(255,255,255,0.03)",
                borderRadius: "50%",
                boxShadow: "inset 0 0 60px rgba(250,229,0,0.015)",
              }}
            />
            {/* Opponents positioned around the table */}
            {opponentData.map(({ player, cardCount, isActive, isDisconnected, position }) => (
              <OpponentPanel
                key={player._id}
                player={player}
                cardCount={cardCount}
                isActive={isActive}
                isDisconnected={isDisconnected}
                position={position}
              />
            ))}

            {/* Center Arena — Draw Pile + Discard Pile */}
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6 sm:gap-10 z-10 scale-[0.85] sm:scale-90">
              {/* Draw Pile Deck */}
              <div className="flex flex-col items-center">
                <button
                  onClick={handleDrawCard}
                  disabled={room.players[state.turnIndex]?._id !== user?._id || roundEnding}
                  className="cursor-pointer hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  {/* Shadow cards */}
                  <div className="absolute inset-0 bg-black/50 translate-x-1.5 translate-y-1.5 rounded-[16px] pointer-events-none" />
                  <CardBack />
                </button>
                <span className="text-[0.6rem] font-bold text-gray-500 uppercase tracking-widest mt-2">
                  Draw ({state.deckCount})
                </span>
              </div>

              {/* Discard Pile Face-Up */}
              <div className="flex flex-col items-center">
                <m.div
                  layout
                  className={`relative p-1 rounded-[20px] transition-shadow duration-300 ${
                    roundEnding ? "shadow-[0_0_35px_rgba(250,229,0,0.8)] animate-pulse" :
                    state.activeColor === "Red" ? "shadow-[0_0_20px_rgba(255,51,102,0.4)]" :
                    state.activeColor === "Blue" ? "shadow-[0_0_20px_rgba(51,153,255,0.4)]" :
                    state.activeColor === "Green" ? "shadow-[0_0_20px_rgba(0,255,136,0.4)]" :
                    state.activeColor === "Yellow" ? "shadow-[0_0_20px_rgba(255,204,0,0.4)]" : ""
                  }`}
                >
                  <AnimatePresence mode="popLayout">
                    <m.div
                      key={state.discardPile[state.discardPile.length - 1]?.id || "discard"}
                      initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {renderGameCard(state.discardPile[state.discardPile.length - 1], 9999, false)}
                    </m.div>
                  </AnimatePresence>
                </m.div>
                <span className={`text-[0.6rem] font-black uppercase tracking-widest mt-2 px-2 py-0.5 rounded border ${
                  state.activeColor === "Red" ? "text-card-red border-card-red/20 bg-card-red/5" :
                  state.activeColor === "Blue" ? "text-card-blue border-card-blue/20 bg-card-blue/5" :
                  state.activeColor === "Green" ? "text-card-green border-card-green/20 bg-card-green/5" :
                  state.activeColor === "Yellow" ? "text-card-yellow border-card-yellow/20 bg-card-yellow/5" : ""
                }`}>
                  {state.activeColor}
                </span>
              </div>
            </div>

          </div>

          {/* ---- PLAYER HAND AREA (fixed at bottom) ---- */}
          <div className="relative z-20 border-t border-white/5 bg-black/70 backdrop-blur-md px-4 pt-2 pb-2 shrink-0">
            {/* Self indicator + Action buttons row */}
            <div className="flex justify-between items-center mb-1">
              <m.div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[0.65rem] font-bold ${
                  room.players[state.turnIndex]?._id === user?._id
                    ? "bg-accent/10 border border-accent/40 text-accent"
                    : "bg-white/5 border border-white/5 text-gray-400"
                }`}
                animate={{
                  borderColor: room.players[state.turnIndex]?._id === user?._id
                    ? "rgba(250,229,0,0.5)" : "rgba(255,255,255,0.05)",
                }}
                transition={{ duration: 0.25 }}
              >
                <User className="w-3 h-3" />
                <span>{user?.username}</span>
                <span className="opacity-60">({state.hands[user._id]?.length || 0})</span>
              </m.div>

              {room.players[state.turnIndex]?._id === user?._id && !roundEnding && (
                <div className="flex gap-2">
                  <button
                    onClick={handleDrawCard}
                    disabled={state.hasDrawn}
                    className="px-3 py-1.5 bg-accent hover:bg-yellow-400 disabled:opacity-40 text-black font-black uppercase text-[0.6rem] rounded-lg tracking-wider transition-colors cursor-pointer"
                  >
                    Draw
                  </button>
                  <button
                    onClick={handlePassTurn}
                    disabled={!state.hasDrawn}
                    className="px-3 py-1.5 border border-white/10 hover:border-white/20 disabled:opacity-40 text-white font-black uppercase text-[0.6rem] rounded-lg tracking-wider transition-colors cursor-pointer"
                  >
                    Pass
                  </button>
                </div>
              )}
            </div>

            {/* Player cards hand — full horizontal scroll */}
            <div className="w-full overflow-x-auto py-1 scrollbar-thin">
              <div className="flex items-end w-max mx-auto px-4" style={{ gap: state.hands[user._id]?.length > 7 ? "-24px" : state.hands[user._id]?.length > 5 ? "-12px" : "4px" }}>
                {(!user || !state.hands[user._id] || state.hands[user._id].length === 0) ? (
                  <div className="text-gray-500 font-bold text-sm italic mx-auto">No cards left!</div>
                ) : (
                  state.hands[user._id].map((card: any, idx: number) => {
                    const playable = isCardPlayable(card);
                    return (
                      <m.div
                        key={card.id || idx}
                        layout
                        initial={{ scale: 0.5, y: 50, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.5, y: -100, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25, delay: idx * 0.02 }}
                        style={{ zIndex: idx }}
                      >
                        {renderGameCard(card, idx, playable)}
                      </m.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- CONFIRM EXIT MODAL -------------------- */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm glass-panel rounded-2xl p-6 border border-white/10 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white mb-2">
                Leave Match?
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                You are currently in an active match. Leaving now may affect gameplay.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-3 bg-accent hover:bg-yellow-400 text-black font-black uppercase text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Stay in Game
                </button>
                <button
                  onClick={confirmLeave}
                  className="flex-1 py-3 border border-card-red/20 bg-card-red/5 hover:bg-card-red/10 text-card-red font-black uppercase text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Leave Match
                </button>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- ROOM DISBANDED MODAL -------------------- */}
      <AnimatePresence>
        {showDisbandModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm glass-panel rounded-2xl p-6 border border-white/10 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-accent" />
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white mb-2">
                Arena Disbanded
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                The room has been closed.
              </p>
              <button
                onClick={handleDisbandExit}
                className="w-full py-3 bg-accent hover:bg-yellow-400 text-black font-black uppercase text-xs rounded-lg transition-colors cursor-pointer"
              >
                Back to Lobby
              </button>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------- RECONNECTING OVERLAY -------------------- */}
      <AnimatePresence>
        {isSocketDisconnected && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
            <m.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm glass-panel rounded-2xl p-8 border border-white/10 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-card-red animate-pulse" />
              <div className="w-16 h-16 bg-card-red/10 border border-card-red/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-8 h-8 text-card-red animate-spin" />
              </div>
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white mb-2">
                Connection Interrupted
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Losing grip on the arena! Attempting to restore your connection to <span className="text-accent font-bold">{roomId}</span>. Please do not close this window.
              </p>
              <div className="text-[0.65rem] text-gray-500 font-bold uppercase tracking-widest bg-white/5 py-2.5 px-4 rounded-lg border border-white/5">
                Auth ID: {user?._id || "Verifying..."}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
