// Slackmap logo: a solid blue square with a white "S" centered. Minimal,
// Slack-avatar-style — recognizable at small sizes, looks intentional.

export function LogoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Slackmap"
    >
      <rect width="32" height="32" rx="6" fill="var(--brand)" />
      <text
        x="16"
        y="16"
        dominantBaseline="central"
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), -apple-system, system-ui, sans-serif"
        fontSize="20"
        fontWeight="500"
        fill="white"
        letterSpacing="-0.3"
      >
        M
      </text>
    </svg>
  );
}

export function LogoLockup({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="font-medium tracking-tight">Slackmap</span>
    </span>
  );
}
