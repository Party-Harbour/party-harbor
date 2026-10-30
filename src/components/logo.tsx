/** Sailboat-and-sun mark from the PRD brand board, drawn as inline SVG. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
    >
      {/* sun */}
      <circle cx="46" cy="18" r="8" fill="#f9b84a" />
      <g stroke="#f9b84a" strokeWidth="2.5" strokeLinecap="round">
        <path d="M46 4v4M46 28v4M32 18h4M56 18h4M36.1 8.1l2.8 2.8M53.1 25.1l2.8 2.8M55.9 8.1l-2.8 2.8M38.9 25.1l-2.8 2.8" />
      </g>
      {/* main sail */}
      <path d="M30 8v32H12C14 28 20 16 30 8Z" fill="#244d70" />
      {/* jib */}
      <path d="M33 16v24h12C44 32 40 23 33 16Z" fill="#a9d6e5" />
      {/* hull */}
      <path d="M6 44h50l-6 8H14l-8-8Z" fill="#e2655a" />
      {/* water */}
      <path d="M4 56c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0 8-3 10 0" stroke="#244d70" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark({ dark = false, tagline = true }: { dark?: boolean; tagline?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={40} />
      <span className="leading-tight">
        <span className={"block font-display text-xl font-semibold " + (dark ? "text-white" : "text-navy")}>
          Party Harbor
        </span>
        {tagline ? (
          <span className={"block text-[11px] " + (dark ? "text-white/70" : "text-navy/60")}>
            Every gathering has a home.
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Soft coastal scene for the sidebar foot, echoing the lighthouse illustration. */
export function HarborScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true" className={className} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3e8" />
          <stop offset="1" stopColor="#f6bba7" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9d6e5" />
          <stop offset="1" stopColor="#244d70" />
        </linearGradient>
      </defs>
      <rect width="240" height="180" fill="url(#sky)" />
      <circle cx="190" cy="60" r="22" fill="#fa8b80" opacity="0.9" />
      <path d="M0 110c40-12 80-12 120 0s80 12 120 0v70H0Z" fill="url(#sea)" />
      {/* island */}
      <path d="M20 118c20-14 60-14 80 0 10 6 0 14-40 14s-50-8-40-14Z" fill="#b7d4c0" />
      {/* lighthouse */}
      <path d="M52 68h16l4 48H48l4-48Z" fill="#ffffff" />
      <path d="M50 84h20l1 10H49l1-10Z" fill="#e2655a" />
      <path d="M50 102h22l1 10H49l1-10Z" fill="#e2655a" />
      <rect x="54" y="56" width="12" height="12" rx="2" fill="#244d70" />
      <path d="M50 56h20l-10-8-10 8Z" fill="#e2655a" />
      <circle cx="60" cy="62" r="3" fill="#f9b84a" />
      {/* boat */}
      <path d="M160 126l22 0-4 6h-14l-4-6Z" fill="#244d70" />
      <path d="M171 104v22h-10c2-8 5-15 10-22Z" fill="#ffffff" />
      {/* foliage */}
      <path d="M0 150c10-20 30-22 40-8-14-2-26 4-40 8Z" fill="#4f7d5e" opacity="0.8" />
      <path d="M240 160c-12-24-34-24-44-6 16-2 30 2 44 6Z" fill="#4f7d5e" opacity="0.8" />
    </svg>
  );
}
