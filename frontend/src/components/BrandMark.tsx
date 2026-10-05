type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const box = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

/** AskShamir logo (same artwork as app/icon.svg) for the header, auth pages and bot replies. */
export default function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={`shrink-0 ${box[size]} ${className}`}
    >
      <rect width="64" height="64" rx="15" className="fill-accent" />
      <rect x="11" y="12" width="42" height="33" rx="10" className="fill-accent-ink" />
      <path d="M19 43h11l-9 10z" className="fill-accent-ink" />
      <path
        d="M24.5 37.5 32 20l7.5 17.5M27.5 32.5h9"
        fill="none"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent"
      />
    </svg>
  );
}
