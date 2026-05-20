"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ShieldAlert, ArrowRight, Gamepad2, Key } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import CardBack from "@/cards/CardBack";
import SuperCard from "@/cards/SuperCard";

function OTPVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp, resendOtp } = useAuth();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [verified, setVerified] = useState(false);

  // References to focus inputs
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    // Keep only numbers or last char
    const cleanValue = value.replace(/[^0-9]/g, "");
    if (!cleanValue) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    const digit = cleanValue[cleanValue.length - 1];
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Shift focus to next input
    if (index < 5 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (otp[index] === "") {
        // Shift focus to previous input on backspace if current is empty
        if (index > 0 && inputsRef.current[index - 1]) {
          inputsRef.current[index - 1]?.focus();
          newOtp[index - 1] = "";
        }
      } else {
        // Just empty current input
        newOtp[index] = "";
      }
      setOtp(newOtp);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    
    if (pastedText.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedText[i] || "";
      }
      setOtp(newOtp);
      
      // Focus the last filled input or the 6th input
      const targetIndex = Math.min(pastedText.length - 1, 5);
      inputsRef.current[targetIndex]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const otpCode = otp.join("");

    if (otpCode.length < 6) {
      setError("Please enter the complete 6-digit security code.");
      return;
    }

    if (!email) {
      setError("Invalid context. Email parameter is missing.");
      return;
    }

    setLoading(true);

    const res = await verifyOtp(email, otpCode);

    setLoading(false);

    if (res.error) {
      setError(res.error);
      setOtp(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    } else {
      setVerified(true);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Email is required to resend OTP.");
      return;
    }
    setError("");
    setInfo("");
    setResending(true);
    const res = await resendOtp(email);
    setResending(false);
    if (res.error) {
      setError(res.error);
    } else {
      setInfo(res.message || "A new OTP has been sent to your email.");
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
      <div className="absolute -right-12 bottom-1/4 hidden lg:block -rotate-12 scale-95 pointer-events-none opacity-45 hover:opacity-100 transition-opacity duration-500 animate-float" style={{ animationDelay: "4s" }}>
        <SuperCard value="+10" />
      </div>

      {/* Ambient glowing circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-card-green/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Esports Style Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-semibold tracking-wider uppercase mb-3 shadow-[0_0_10px_rgba(250,229,0,0.1)]">
            <Gamepad2 className="w-3.5 h-3.5" />
            Verification Required
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white drop-shadow-[0_4px_12px_rgba(250,229,0,0.2)]">
            CHAOS DECK
          </h1>
          <p className="text-gray-400 text-sm mt-1">Unlock your deck with the authorization code</p>
        </div>

        {/* Outer verification box */}
        <motion.div
          animate={verified ? { borderColor: "rgba(0, 255, 136, 0.4)", boxShadow: "0 0 40px rgba(0, 255, 136, 0.25)" } : {}}
          className="glass-panel rounded-2xl p-8 glow-accent/5 relative overflow-hidden transition-all duration-500"
        >
          {/* Top light colored stripe indicator */}
          <div className={`absolute top-0 left-0 right-0 h-1 transition-colors duration-500 ${verified ? "bg-card-green" : "bg-accent"}`} />

          <AnimatePresence mode="wait">
            {!verified ? (
              <motion.div
                key="verification-form"
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-6 p-3 rounded-lg bg-card-red/10 border border-card-red/30 flex items-start gap-2.5 text-card-red text-sm glow-red/5"
                  >
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {info && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-6 p-3 rounded-lg bg-card-blue/10 border border-card-blue/30 text-card-blue text-sm"
                  >
                    {info}
                  </motion.div>
                )}

                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3 text-accent glow-accent/10">
                    <Key className="w-5 h-5" />
                  </div>
                  <p className="text-gray-300 text-sm">
                    Enter the 6-digit OTP code sent to your email:
                  </p>
                  <p className="text-accent font-semibold text-sm mt-1 break-all">
                    {email || "your-email@example.com"}
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    Did not receive it? Check spam or resend below.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex justify-between gap-2.5">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputsRef.current[idx] = el;
                        }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        onPaste={handlePaste}
                        disabled={loading}
                        className="w-12 h-14 text-center text-xl font-bold bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all selection:bg-transparent"
                      />
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(250, 229, 0, 0.4)" }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-accent hover:bg-yellow-400 text-black font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Verify Code
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || loading}
                    className="w-full py-2 text-sm text-gray-400 hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {resending ? "Sending..." : "Resend OTP"}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success-celebration"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 flex flex-col items-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="w-16 h-16 rounded-full bg-card-green/10 border-2 border-card-green flex items-center justify-center mb-4 text-card-green glow-green/20"
                >
                  <ShieldCheck className="w-9 h-9" />
                </motion.div>
                <h2 className="text-2xl font-black italic tracking-wider text-card-green mb-2 uppercase drop-shadow-[0_0_10px_rgba(0,255,136,0.3)]">
                  Access Granted
                </h2>
                <p className="text-gray-300 text-sm max-w-xs">
                  Your identity has been verified. Welcome to Chaos Deck arena.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-card-green">
                  <div className="w-2.5 h-2.5 rounded-full bg-card-green animate-ping" />
                  Synchronizing Deck...
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function OTPVerificationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-game-bg">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OTPVerificationContent />
    </Suspense>
  );
}
