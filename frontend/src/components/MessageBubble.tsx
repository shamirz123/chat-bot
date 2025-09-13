"use client";

import styles from "../styles/chat.module.css";

type Props = { role: "user" | "Shaz"; text: string };

export default function MessageBubble({ role, text }: Props) {
  const isUser = role === "user";
  return (
    <div className={isUser ? styles.user : styles.assistant}>
      <div className={styles.bubble}>{text}</div>
    </div>
  );
}
