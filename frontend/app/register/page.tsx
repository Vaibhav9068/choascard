"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, ShieldAlert, ArrowRight, Gamepad2 } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import CardBack from "@/cards/CardBack";
import WildCard from "@/cards/WildCard";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!formData.fullName.trim() || !formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
      setError("All fields are required.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    const res = await register(formData);

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Account initiated! Redirecting to OTP verification...");
      setTimeout(() => {
        router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`);
      }, 1500);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-game-bg overflow-hidden p-4">
      {/* Dynamic Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Floating Card Decorations */}
      <div className="absolute -left-12 top-1/4 hidden lg:block rotate-12 scale-90 pointer-events-none opacity-40 hover:opacity-100 transition-opacity duration-500 animate-float">
        <CardBack />
      </div>
      <div className="absolute -right-12 bottom-1/4 hidden lg:block -rotate-12 scale-95 pointer-events-none opacity-45 hover:opacity-100 transition-opacity duration-500 animate-float" style={{ animationDelay: "2s" }}>
        <WildCard value="+4" />
      </div>

      {/* Radial ambient glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-card-red/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Esports Style Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ rotate: -5, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-semibold tracking-wider uppercase mb-3 shadow-[0_0_10px_rgba(250,229,0,0.1)]"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            No Mercy Edition
          </motion.div>
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white drop-shadow-[0_4px_12px_rgba(250,229,0,0.2)]">
            CHAOS DECK
          </h1>
          <p className="text-gray-400 text-sm mt-1">Register to enter the arena</p>
        </div>

        {/* Form Container */}
        <div className="glass-panel rounded-2xl p-8 glow-accent/5 relative overflow-hidden">
          {/* Top border colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-card-red via-accent to-card-blue animate-pulse-slow" />

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg bg-card-red/10 border border-card-red/30 flex items-start gap-2.5 text-card-red text-sm glow-red/5"
              >
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-lg bg-card-green/10 border border-card-green/30 flex items-start gap-2.5 text-card-green text-sm glow-green/5"
              >
                <div className="w-2 h-2 rounded-full bg-card-green mt-1.5 animate-ping" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  disabled={loading}
                  className="w-full glass-input text-sm text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <Gamepad2 className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose username"
                  disabled={loading}
                  className="w-full glass-input text-sm text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email"
                  disabled={loading}
                  className="w-full glass-input text-sm text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  disabled={loading}
                  className="w-full glass-input text-sm text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(250, 229, 0, 0.4)" }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-accent hover:bg-yellow-400 text-black font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Register
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-400 text-xs">Already have an account? </span>
            <Link
              href="/login"
              className="text-accent hover:underline text-xs font-bold transition-all"
            >
              Log In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
