"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Login from "./login/page";
import Register from "./register/page";
import Chat from "./chat/page";

const Home = () => {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      router.push("/chat");
    } else {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  // Render nothing here; routing handled by useEffect
  return null;
};

export default Home;