interface LogoProps {
  size?: number;
  className?: string;
}

// EasySch brand mark — the "ES" gradient-sphere logo (public/logo.png),
// cropped to a transparent circle so it sits cleanly on any background.
export function Logo({ size = 28, className }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="EasySch"
      className={className}
      style={{ display: "block" }}
    />
  );
}
