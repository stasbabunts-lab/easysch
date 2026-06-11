interface LogoProps {
  size?: number;
  className?: string;
}

// EasySch brand mark — "ES" monogram on a radial-gradient indigo sphere with a
// soft glow. Letters are vector strokes (not text) so they render identically
// across the app, the favicon and the rasterised Telegram avatar.
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="EasySch"
    >
      <defs>
        <radialGradient id="es-bg" cx="40%" cy="33%" r="75%">
          <stop offset="0%" stopColor="#9d86ec" />
          <stop offset="52%" stopColor="#6b46da" />
          <stop offset="100%" stopColor="#3a2570" />
        </radialGradient>
        <filter id="es-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#es-bg)" />
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="12"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        filter="url(#es-glow)"
      >
        <path d="M58 33 L34 33 L34 87 L58 87 M34 60 L54 60" />
        <path d="M92 44 C92 37 87 33 79 33 C71 33 66 38 66 45 C66 52 72 56 79 59 C86 62 92 66 92 75 C92 82 87 87 79 87 C71 87 66 82 66 75" />
      </g>
    </svg>
  );
}
