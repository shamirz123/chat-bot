"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const Home = () => {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

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

  return null;
};

export default Home;
