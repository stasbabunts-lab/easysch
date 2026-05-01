interface TabletIconProps {
  className?: string;
  size?: number;
}

export function TabletIcon({ className, size = 16 }: TabletIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Tablet body */}
      <rect x="4" y="2" width="16" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      {/* Screen */}
      <rect x="6.5" y="4.5" width="11" height="13" rx="1" stroke="currentColor" strokeWidth="1.3" />
      {/* Home button */}
      <circle cx="12" cy="20" r="0" fill="currentColor" />
      <line x1="10" y1="19.5" x2="14" y2="19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
