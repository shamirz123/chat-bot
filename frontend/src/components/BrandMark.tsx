"use client";

import { motion } from "framer-motion";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg" | "hero";
  breathe?: boolean;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
};

const sizeClass = {
  sm: "text-xl md:text-2xl",
  md: "text-3xl",
  lg: "text-5xl sm:text-6xl",
  hero: "text-5xl sm:text-6xl md:text-7xl",
} as const;

export default function BrandMark({
  size = "md",
  breathe = false,
  as = "span",
  className = "",
}: BrandMarkProps) {
  const classes = `font-[var(--font-display)] font-extrabold tracking-tight leading-[0.92] ${sizeClass[size]} ${className}`;
  const content = (
    <>
      <span className="text-[var(--studio-pine)]">shamir</span>
      <span className="text-[var(--studio-vermillion)]">bot</span>
    </>
  );

  if (breathe) {
    const MotionTag = motion[as];
    return (
      <MotionTag
        className={classes}
        aria-label="shamirbot"
        animate={{ letterSpacing: ["-0.045em", "-0.02em", "-0.045em"] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
      >
        {content}
      </MotionTag>
    );
  }

  const Tag = as;
  return (
    <Tag className={classes} aria-label="shamirbot">
      {content}
    </Tag>
  );
}
