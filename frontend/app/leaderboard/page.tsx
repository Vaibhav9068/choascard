"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion as m } from "framer-motion";
import { Gamepad2, Trophy, ArrowLeft, Award, User, Flame } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface LeaderboardUser {
  _id: string;
  fullName: string;
  username: string;
  trophies: number;
  league: string;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchLeaderboard() {
      const res = await apiFetch<LeaderboardUser[]>("/api/users/leaderboard");
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setPlayers(res.data);
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-game-bg text-white">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-game-bg text-white relative overflow-hidden flex flex-col p-6">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/3 blur-[120px] pointer-events-none" />
      
      {/* Header */}
      <header className="max-w-4xl w-full mx-auto mb-8 flex items-center justify-between z-10">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 transition-all text-sm font-bold uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Arena
        </button>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(250,229,0,0.1)]">
          <Trophy className="w-3.5 h-3.5" />
          Global Rankings
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl w-full mx-auto relative z-10 flex-1 flex flex-col items-center">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white drop-shadow-[0_4px_12px_rgba(250,229,0,0.25)] flex items-center justify-center gap-2">
            LEADERBOARD
          </h1>
          <p className="text-gray-400 text-sm mt-1">The top deck wielders in the world</p>
        </div>

        {/* Board table */}
        <div className="w-full glass-panel rounded-2xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/50 via-white/20 to-accent/50" />
          
          <div className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between text-xs font-black uppercase tracking-wider text-gray-500">
            <span className="w-16 text-center">Rank</span>
            <span className="flex-1 pl-4">Player</span>
            <span className="w-32 text-center">League</span>
            <span className="w-24 text-right pr-4">Trophies</span>
          </div>

          <div className="divide-y divide-white/5">
            {players.length === 0 ? (
              <div className="py-12 text-center text-gray-500 font-semibold">
                No ranking data available yet.
              </div>
            ) : (
              players.map((player, idx) => {
                const rank = idx + 1;
                const isTopThree = rank <= 3;
                const medalColors = rank === 1 ? "text-accent" : rank === 2 ? "text-slate-300" : "text-amber-600";
                
                return (
                  <m.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={player._id}
                    className={`p-6 flex items-center justify-between transition-colors hover:bg-white/[0.02] ${isTopThree ? "bg-accent/[0.01]" : ""}`}
                  >
                    {/* Rank */}
                    <div className="w-16 flex items-center justify-center">
                      {isTopThree ? (
                        <div className="relative">
                          <Trophy className={`w-7 h-7 ${medalColors} drop-shadow-[0_0_8px_rgba(250,229,0,0.2)]`} />
                          <span className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-black text-black pb-1">
                            {rank}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-black text-sm">#{rank}</span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 pl-4 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 shrink-0 ${rank === 1 ? "border-accent/40" : ""}`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-white leading-none truncate">{player.fullName}</p>
                        <p className="text-gray-500 text-xs mt-0.5 truncate">@{player.username}</p>
                      </div>
                    </div>

                    {/* League */}
                    <div className="w-32 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[0.65rem] font-bold uppercase tracking-wider ${
                        player.league === "Legend" ? "bg-accent/15 border-accent/30 text-accent" :
                        player.league === "Diamond" ? "bg-blue-600/10 border-blue-500/30 text-blue-400" :
                        player.league === "Crystal" ? "bg-pink-600/10 border-pink-500/30 text-pink-400" :
                        player.league === "Platinum" ? "bg-purple-600/10 border-purple-500/30 text-purple-400" :
                        player.league === "Gold" ? "bg-yellow-600/10 border-yellow-500/30 text-yellow-500" :
                        player.league === "Silver" ? "bg-slate-500/10 border-slate-400/30 text-slate-400" :
                        "bg-amber-800/10 border-amber-700/30 text-amber-600"
                      }`}>
                        {player.league}
                      </span>
                    </div>

                    {/* Trophies */}
                    <div className="w-24 text-right pr-4 font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 text-sm flex items-center justify-end gap-1.5">
                      {player.trophies}
                      <Trophy className="w-4 h-4 text-accent shrink-0" />
                    </div>
                  </m.div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
