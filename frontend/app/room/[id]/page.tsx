"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion as m, AnimatePresence } from "framer-motion";
import { Gamepad2, Trophy, ArrowLeft, Swords, Crown, User, RefreshCw, Zap, ShieldAlert, Sparkles, Send } from "lucide-react";
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

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params.id as string).toUpperCase();

  const { user, isLoading: authLoading } = useAuth();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSocketDisconnected, setIsSocketDisconnected] = useState(!socket.connected);

  // Overlay state: Color picking or Targeting
  const [overlay, setOverlay] = useState<{
    type: "color" | "target" | null;
    card: any | null;
  }>({ type: null, card: null });

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

    const onConnect = () => {
      console.log("Socket connected, joining room...");
      setIsSocketDisconnected(false);
      joinRoom();
    };

    const onDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
      setIsSocketDisconnected(true);
    };

    const onConnectError = (err: any) => {
      console.error("Socket connection error:", err);
      setIsSocketDisconnected(true);
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
      setMatchResults(results);
    });

    socket.on("room_disbanded", () => {
      alert("This arena has been disbanded by the host.");
      router.push("/");
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

  const handleStartGame = () => {
    socket.emit("start_game", roomId);
  };

  const handleLeaveRoom = () => {
    socket.emit("leave_room", roomId);
    router.push("/");
  };

  const handleDisbandRoom = () => {
    socket.emit("disband_room", roomId);
  };

  const handlePlayAgain = () => {
    socket.emit("play_again", roomId);
  };

  // Card click handler
  const handleCardClick = (card: any) => {
    if (!room?.gameState) return;
    const state = room.gameState;
    const isOurTurn = room.players[state.turnIndex]._id === user?._id;
    if (!isOurTurn) {
      setError("It's not your turn!");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Check if card requires a target (Slam, Couple)
    const requiresTarget = ["Slam", "Couple"].includes(card.value);
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
  };

  const submitPlayWithPayload = (selectedColor?: string, targetId?: string) => {
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
  };

  const handleDrawCard = () => {
    if (!room?.gameState) return;
    const state = room.gameState;
    const isOurTurn = room.players[state.turnIndex]._id === user?._id;
    if (!isOurTurn) return;

    socket.emit("player_action", {
      roomId,
      action: "draw_card"
    });
  };

  const handlePassTurn = () => {
    if (!room?.gameState) return;
    const state = room.gameState;
    const isOurTurn = room.players[state.turnIndex]._id === user?._id;
    if (!isOurTurn) return;

    socket.emit("player_action", {
      roomId,
      action: "pass_turn"
    });
  };

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

  // Render proper game card component helper
  const renderGameCard = (card: any, index: number, isPlayable: boolean) => {
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
  };

  // Check if a card is playable in the current hand
  const isCardPlayable = (card: any) => {
    if (!isGameStarted || !user) return false;
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
  };

  return (
    <div className="min-h-screen bg-game-bg text-white relative overflow-hidden flex flex-col">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/3 blur-[150px] pointer-events-none" />

      {/* Floating Error Toast */}
      {error && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-lg bg-card-red/10 border border-card-red/30 text-card-red text-sm font-bold glow-red/10 animate-bounce">
          {error}
        </div>
      )}

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
        /* -------------------- 4. GAME SCREEN -------------------- */
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top Panel (Turn indicators + Stacking states) */}
          <div className="relative z-10 border-b border-white/5 bg-black/40 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase">Arena Code:</span>
              <span className="text-accent font-black tracking-widest text-sm">{roomId}</span>
            </div>

            {/* active turn display */}
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
              <span className="font-bold text-xs uppercase tracking-wider text-gray-300">
                Turn: <span className="text-accent font-black">{room.players[state.turnIndex].username}</span>
              </span>
            </div>

            <button
              onClick={handleLeaveRoom}
              className="text-xs font-black uppercase tracking-wider px-3 py-1.5 border border-card-red/20 bg-card-red/5 hover:bg-card-red/10 text-card-red rounded-lg transition-colors cursor-pointer"
            >
              Surrender
            </button>
          </div>

          {/* Stacking Penalty Alert Banner */}
          {state.stackingCards > 0 && (
            <div className="relative z-10 bg-card-red text-black font-black uppercase text-xs py-2 text-center flex items-center justify-center gap-2 glow-red/20">
              <ShieldAlert className="w-4 h-4 stroke-[3]" />
              <span>Stack Active! Next player must drop counter or draw {state.stackingCards} cards!</span>
            </div>
          )}

          {/* Game board layout */}
          <div className="flex-1 flex flex-col md:flex-row relative">
            
            {/* Left side board: Opponent hand sizes */}
            <div className="w-full md:w-64 bg-black/15 border-r border-white/5 p-4 overflow-y-auto space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3">Opponents</h3>
              {room.players
                .filter((p) => p._id !== user?._id)
                .map((player) => {
                  const playerHandCount = state.hands[player._id]?.length || 0;
                  const isPlayerTurn = room.players[state.turnIndex]._id === player._id;
                  const isDisconnected = player.connected === false;
                  
                  return (
                    <div
                      key={player._id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isDisconnected ? "opacity-40 bg-black/40 border-dashed border-white/10" :
                        isPlayerTurn ? "bg-accent/15 border-accent text-accent glow-accent/5" : "bg-black/25 border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isDisconnected ? "bg-card-red/10 text-card-red" : "bg-white/5 text-gray-400"}`}>
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate text-xs font-bold">
                          {player.username}
                          {isDisconnected && <span className="block text-[0.6rem] text-card-red font-black uppercase tracking-wider">RECONNECTING...</span>}
                        </div>
                      </div>
                      <span className="text-xs font-black px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-white">
                        {playerHandCount} Cards
                      </span>
                    </div>
                  );
                })}
              
              {/* Couple status linking indicator */}
              {state.coupleLink && (
                <div className="p-3 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-xl mt-4">
                  <div className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Couple Active
                  </div>
                  <p className="text-[0.65rem] text-gray-400 mt-1 leading-relaxed">
                    Attack mirror replication active. Ends in {state.coupleLink.roundsLeft} turns.
                  </p>
                </div>
              )}
            </div>

            {/* Right side board: Discard & Draw Deck area */}
            <div className="flex-1 min-w-0 flex flex-col justify-between p-6">
              
              {/* Center Arena table */}
              <div className="flex-1 flex items-center justify-center gap-12 relative">
                {/* Draw Pile Deck */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleDrawCard}
                    disabled={room.players[state.turnIndex]._id !== user?._id}
                    className="cursor-pointer hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed group relative"
                  >
                    {/* Shadow cards */}
                    <div className="absolute inset-0 bg-black/50 translate-x-1.5 translate-y-1.5 rounded-[16px] pointer-events-none" />
                    <CardBack />
                  </button>
                  <span className="text-[0.65rem] font-bold text-gray-500 uppercase tracking-widest mt-2">
                    Draw Pile ({state.deckCount})
                  </span>
                </div>

                {/* Discard Pile Face-Up */}
                <div className="flex flex-col items-center">
                  <div className={`relative p-1 rounded-[20px] transition-shadow duration-300 ${
                    state.activeColor === "Red" ? "shadow-[0_0_20px_rgba(255,51,102,0.4)]" :
                    state.activeColor === "Blue" ? "shadow-[0_0_20px_rgba(51,153,255,0.4)]" :
                    state.activeColor === "Green" ? "shadow-[0_0_20px_rgba(0,255,136,0.4)]" :
                    state.activeColor === "Yellow" ? "shadow-[0_0_20px_rgba(255,204,0,0.4)]" : ""
                  }`}>
                    {renderGameCard(state.discardPile[state.discardPile.length - 1], 9999, false)}
                  </div>
                  <span className={`text-[0.65rem] font-black uppercase tracking-widest mt-2 px-2 py-0.5 rounded border ${
                    state.activeColor === "Red" ? "text-card-red border-card-red/20 bg-card-red/5" :
                    state.activeColor === "Blue" ? "text-card-blue border-card-blue/20 bg-card-blue/5" :
                    state.activeColor === "Green" ? "text-card-green border-card-green/20 bg-card-green/5" :
                    state.activeColor === "Yellow" ? "text-card-yellow border-card-yellow/20 bg-card-yellow/5" : ""
                  }`}>
                    Color: {state.activeColor}
                  </span>
                </div>
              </div>

              {/* Player hand area container */}
              <div className="w-full border-t border-white/5 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Your Hand</h4>
                  
                  {room.players[state.turnIndex]._id === user?._id && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDrawCard}
                        disabled={state.hasDrawn}
                        className="px-3.5 py-1.5 bg-accent hover:bg-yellow-400 disabled:opacity-40 text-black font-black uppercase text-[0.65rem] rounded-lg tracking-wider transition-colors cursor-pointer"
                      >
                        Draw Card
                      </button>
                      <button
                        onClick={handlePassTurn}
                        disabled={!state.hasDrawn}
                        className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 disabled:opacity-40 text-white font-black uppercase text-[0.65rem] rounded-lg tracking-wider transition-colors cursor-pointer"
                      >
                        Pass Turn
                      </button>
                    </div>
                  )}
                </div>

                {/* Player cards hand */}
                <div className="w-full overflow-x-auto py-4 px-2 flex items-center justify-start gap-4">
                  {(!user || !state.hands[user._id] || state.hands[user._id].length === 0) ? (
                    <div className="text-gray-500 font-bold text-sm italic mx-auto">No cards left!</div>
                  ) : (
                    state.hands[user._id].map((card: any, idx: number) => {
                      const playable = isCardPlayable(card);
                      return renderGameCard(card, idx, playable);
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

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
              <div className="w-16 h-16 bg-card-red/10 border border-card-red/20 rounded-full flex items-center justify-center mx-auto mb-6 glow-red/5">
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
