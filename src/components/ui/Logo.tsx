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
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M56 37 L31 37 L31 83 L56 83 M31 60 L51 60" />
        <path d="M90 47 C90 40 84 37 76 37 C66 37 62 41 62 48 C62 55 69 57 76 59 C84 61 90 63 90 71 C90 79 84 82 76 82 C67 82 61 79 61 71" />
      </g>
    </svg>
  );
}
