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

      {/* R: stem + D-bowl (radius 8, sweeps right to x=20) + diagonal leg */}
      <rect x="6" y="9" width="6" height="30" fill="white" />
      <path d="M 12 9 A 8 8 0 0 1 12 25 Z" fill="white" />
      <line x1="14" y1="25" x2="22" y2="39" stroke="white" strokeWidth="6" strokeLinecap="round" />

      {/* L: stem + base foot */}
      <rect x="27" y="9" width="6" height="30" fill="white" />
      <rect x="27" y="34" width="15" height="5" fill="white" />
    </svg>
  );
}
