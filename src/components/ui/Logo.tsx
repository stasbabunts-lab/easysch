interface LogoProps {
  size?: number;
  className?: string;
}

// EasySch brand mark — "ES" monogram in a brand-indigo circle.
// Letters are drawn as vector strokes (not text) so they render identically
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
      <circle cx="60" cy="60" r="60" fill="#6d4ee0" />
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M50 37 L28 37 L28 83 L50 83 M28 60 L46 60" />
        <path d="M90 47 C90 40 85 37 79 37 C71 37 68 41 68 48 C68 54 73 56 79 58 C85 60 90 62 90 70 C90 78 85 82 79 82 C72 82 68 79 68 71" />
      </g>
    </svg>
  );
}
