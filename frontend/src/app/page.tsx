"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getValidToken } from "../lib/auth";

// Entry point: signed-in users go to the chat, everyone else to the login page.
const Home = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace(getValidToken() ? "/chat" : "/login");
  }, [router]);

  return null;
};

export default Home;
