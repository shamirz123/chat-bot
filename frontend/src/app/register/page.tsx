"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

  const handleRegister = async () => {
    setAuthError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed");
      router.push("/login");
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col items-center justify-center bg-[#14101B] text-[#F3EFFA] font-[var(--font-body)] px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute w-[55vw] h-[55vw] rounded-full blur-[140px]"
          style={{ background: "#FF8A6522", top: "-15%", right: "-15%" }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[45vw] h-[45vw] rounded-full blur-[140px]"
          style={{ background: "#A78BFA22", bottom: "-15%", left: "-15%" }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 1.5 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center mb-8"
      >
        <div
          className="w-12 h-12 mb-4"
          style={{
            background: "linear-gradient(135deg, #FF8A65 0%, #A78BFA 100%)",
            borderRadius: "52% 48% 45% 55% / 52% 52% 48% 48%",
          }}
        />
        <h1 className="font-[var(--font-display)] italic text-3xl">Say hello</h1>
        <p className="text-sm text-[#948FA3] mt-1">Create an account to meet shamirbot.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 w-full max-w-md space-y-3.5 p-6 rounded-3xl bg-[#1D1826]/70 border border-[#2E2740] backdrop-blur-xl"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full p-4 bg-[#14101B]/70 border border-[#2E2740] rounded-2xl text-[#F3EFFA] placeholder:text-[#665F78] focus:outline-none focus:border-[#FF8A65] transition-colors"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full p-4 bg-[#14101B]/70 border border-[#2E2740] rounded-2xl text-[#F3EFFA] placeholder:text-[#665F78] focus:outline-none focus:border-[#FF8A65] transition-colors"
        />
        {authError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[#FF8A65] text-sm text-center"
          >
            {authError}
          </motion.p>
        )}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRegister}
          disabled={loading}
          className="w-full p-4 bg-gradient-to-br from-[#FF8A65] to-[#A78BFA] text-[#14101B] font-medium rounded-2xl hover:brightness-105 transition-all disabled:opacity-60"
        >
          {loading ? "Registering…" : "Register"}
        </motion.button>
        <button
          onClick={() => router.push("/login")}
          className="w-full text-[#FF8A65] hover:underline text-sm pt-1"
        >
          Already have an account? Sign in
        </button>
      </motion.div>
    </div>
  );
};

export default Register;