"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import BrandMark from "../../components/BrandMark";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

  const handleLogin = async () => {
    setAuthError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("token", data.token);
      router.push("/chat");
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden studio-atmosphere studio-hatch studio-grain flex flex-col items-center justify-center px-5 text-[var(--studio-ink)] font-[var(--font-body)]">
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="font-[var(--font-mono)] text-[10px] tracking-[0.22em] uppercase text-[var(--studio-muted)] mb-3">
            Your AI studio
          </p>
          <BrandMark size="lg" as="h1" breathe />
          <p className="mt-4 text-[var(--studio-pine-muted)] text-base leading-relaxed max-w-sm">
            Welcome back. Sign in to continue your thread.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-5 bg-[var(--studio-surface-strong)] border border-[var(--studio-line)] backdrop-blur-md p-6 sm:p-7"
        >
          <div>
            <label className="font-[var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--studio-muted)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-2 w-full bg-transparent border-0 border-b-2 border-[var(--studio-line)] focus:border-[var(--studio-vermillion)] focus:outline-none py-3 placeholder:text-[var(--studio-muted)] transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div>
            <label className="font-[var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--studio-muted)]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full bg-transparent border-0 border-b-2 border-[var(--studio-line)] focus:border-[var(--studio-vermillion)] focus:outline-none py-3 placeholder:text-[var(--studio-muted)] transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {authError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[var(--studio-vermillion)] text-sm"
            >
              {authError}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 bg-[var(--studio-vermillion)] text-white font-medium hover:brightness-95 transition-all disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </motion.button>

          <button
            onClick={() => router.push("/register")}
            className="w-full text-sm text-[var(--studio-pine)] hover:text-[var(--studio-vermillion)] transition-colors pt-1"
          >
            No account yet? Register
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
