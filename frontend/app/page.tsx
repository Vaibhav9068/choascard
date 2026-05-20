"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion as m } from "framer-motion";
import { Gamepad2, Trophy, LogOut, Award, Swords, User as UserIcon, Mail, Plus, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { socket } from "@/lib/socket";
import { connectSocket } from "@/lib/socket";
import NumberCard from "@/cards/NumberCard";
import ActionCard from "@/cards/ActionCard";
import WildCard from "@/cards/WildCard";
import SuperCard from "@/cards/SuperCard";

export default function HomePage() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      connectSocket();
    }

    // Listen for room creation from socket to navigate
    socket.on("room_created", (roomId: string) => {
      router.push(`/room/${roomId}`);
    });

    socket.on("error_message", (msg: string) => {
      setError(msg);
      setTimeout(() => setError(""), 4000);
    });

    return () => {
      socket.off("room_created");
      socket.off("error_message");
    };
  }, [router, user]);

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateRoom = () => {
    if (!user) return;
    socket.emit("create_room", {
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      trophies: user.trophies,
      league: user.league
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;
    
    const cleanRoomId = joinRoomId.trim().toUpperCase();
    if (cleanRoomId.length !== 5) {
      setError("Room ID must be exactly 5 alphanumeric characters.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    router.push(`/room/${cleanRoomId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-game-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm tracking-widest uppercase animate-pulse">
            Synchronizing with Arena...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const winRate = user.wins + user.losses > 0 
    ? Math.round((user.wins / (user.wins + user.losses)) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-game-bg text-white relative overflow-hidden flex flex-col">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/3 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-card-blue/3 blur-[150px] pointer-events-none" />

      {/* Main Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent glow-accent/10">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-accent">
              CHAOS DECK
            </h1>
            <p className="text-[0.65rem] font-bold text-gray-500 tracking-wider uppercase">
              No Mercy Edition
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/leaderboard")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent text-xs font-bold uppercase tracking-wider transition-all cursor-pointer glow-accent/5"
          >
            <Trophy className="w-4 h-4" />
            Rankings
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-card-red/20 bg-card-red/5 hover:bg-card-red/10 text-card-red text-xs font-bold uppercase tracking-wider transition-all cursor-pointer glow-red/5"
          >
            <LogOut className="w-4 h-4" />
            Leave Arena
          </button>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-20 right-6 z-50 p-4 rounded-lg bg-card-red/10 border border-card-red/30 text-card-red text-sm font-bold glow-red/5 animate-pulse">
          {error}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Player Stats & Profile */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Profile */}
          <m.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 18 }}
            className="glass-panel rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-accent relative">
                <UserIcon className="w-8 h-8" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-black font-black text-[0.6rem] flex items-center justify-center border-2 border-game-bg">
                  Lvl
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-wide">{user.fullName}</h2>
                <p className="text-accent text-sm font-semibold">@{user.username}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5 text-sm text-gray-400">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4.5 h-4.5 text-gray-500" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Award className="w-4.5 h-4.5 text-gray-500" />
                <span>Status: <span className="text-card-green font-bold uppercase text-xs">Verified Challenger</span></span>
              </div>
            </div>
          </m.div>

          {/* Record statistics */}
          <m.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.1 }}
            className="glass-panel rounded-2xl p-6 relative overflow-hidden"
          >
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Swords className="w-4 h-4 text-card-red" />
              Arena Record
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/35 rounded-xl p-3 text-center border border-white/5">
                <p className="text-xs text-gray-500 uppercase font-semibold">Wins</p>
                <p className="text-2xl font-black text-card-green mt-1">{user.wins}</p>
              </div>
              <div className="bg-black/35 rounded-xl p-3 text-center border border-white/5">
                <p className="text-xs text-gray-500 uppercase font-semibold">Losses</p>
                <p className="text-2xl font-black text-card-red mt-1">{user.losses}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                <span className="text-gray-400">Win Rate</span>
                <span className="text-accent">{winRate}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <m.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${winRate}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-card-red via-accent to-card-green rounded-full" 
                />
              </div>
            </div>
          </m.div>
        </div>

        {/* Center / Right Columns: Room Controls & Cards Deck */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Create & Join Room Forms */}
          <m.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 18 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Create Room Box */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-48 border border-white/5">
              <div>
                <h3 className="text-lg font-bold tracking-wide text-white">Create Private Room</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Spawn a custom game lobby and invite up to 7 friends to join the clash.
                </p>
              </div>
              <button
                onClick={handleCreateRoom}
                className="w-full py-3 bg-accent hover:bg-yellow-400 text-black font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(250,229,0,0.15)]"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                Create Room
              </button>
            </div>

            {/* Join Room Box */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-48 border border-white/5">
              <div>
                <h3 className="text-lg font-bold tracking-wide text-white">Join Private Room</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Enter a 5-digit alphanumeric room ID key to connect directly to a lobby.
                </p>
              </div>
              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  maxLength={5}
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="CODE"
                  className="flex-1 glass-input rounded-lg px-4 text-center font-bold text-lg tracking-widest text-white uppercase focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-5 bg-white hover:bg-gray-100 text-black font-black uppercase rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          </m.div>

          {/* Trophy & League Indicator */}
          <m.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.1 }}
            className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border-2 border-accent flex items-center justify-center text-accent glow-accent/20">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold text-gray-500 tracking-widest uppercase">Current League</p>
                <h3 className="text-3xl font-black italic tracking-tighter text-accent">{user.league}</h3>
                <p className="text-xs text-gray-400 mt-1">Climb the ladder to unlock legendary leagues.</p>
              </div>
            </div>

            <div className="bg-black/40 rounded-2xl p-4 border border-white/5 text-center min-w-[140px]">
              <p className="text-[0.6rem] text-gray-400 font-bold uppercase tracking-widest">Trophy Pool</p>
              <div className="flex items-center justify-center gap-1.5 mt-1 text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white to-accent">
                {user.trophies}
                <Trophy className="w-5 h-5 text-accent shrink-0" />
              </div>
            </div>
          </m.div>

          {/* Interactive Cards Preview */}
          <m.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.15 }}
            className="glass-panel rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-400">
                  Combat Deck Preview
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Hover cards to experience physics interactions</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 py-4">
              <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="hover:z-20">
                <NumberCard value="7" colorTheme="blue" isPlayable={true} />
              </m.div>
              <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="hover:z-20">
                <ActionCard value="+2" colorTheme="red" isPlayable={true} />
              </m.div>
              <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="hover:z-20">
                <WildCard value="+4" isPlayable={true} />
              </m.div>
              <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="hover:z-20">
                <SuperCard value="PunchBack" isPlayable={true} />
              </m.div>
            </div>
          </m.div>

        </div>
      </main>
    </div>
  );
}
