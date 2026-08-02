export function BrandMark({
  size = 28,
  color = "var(--brand)",
  bg = "var(--surface)",
}: {
  size?: number;
  color?: string;
  bg?: string;
}) {
  const w = Math.round((size * 68) / 60);
  return (
    <svg
      width={w}
      height={size}
      viewBox="4 -1 68 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ResumeLab"
      stroke={color}
      strokeWidth={3}
      strokeLinejoin="round"
    >
      {/* right arm — woven under the diagonal */}
      <path d="M44 6 L55 6 L47 56 L36 56 Z" fill={bg} />
      {/* diagonal ribbon rising into an arrow */}
      <path
        d="M8.54 44.73 L53.33 8.43 L49.86 4.15 L70 2 L63.72 21.25 L60.25 16.97 L15.46 53.27 Z"
        fill={bg}
      />
      {/* left arm — woven over the diagonal */}
      <path d="M14 6 L25 6 L17 56 L6 56 Z" fill={bg} />
    </svg>
  );
}

export function BrandWord({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      Resume<span className="text-brand">Lab</span>
    </span>
  );
}
