export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ResumeLab"
    >
      <rect width="48" height="48" rx="11" fill="#266df0" />

      {/* R — stem */}
      <rect x="7" y="10" width="5" height="28" fill="white" />
      {/* R — bowl: semicircle radius=7, from (12,10) clockwise to (12,24), bulges right to x=19 */}
      <path d="M 12 10 A 7 7 0 0 1 12 24 Z" fill="white" />
      {/* R — leg: diagonal from bowl-stem junction */}
      <line
        x1="14"
        y1="24"
        x2="22"
        y2="38"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* L — stem */}
      <rect x="27" y="10" width="5" height="28" fill="white" />
      {/* L — base foot */}
      <rect x="27" y="33" width="14" height="5" fill="white" />
    </svg>
  );
}
