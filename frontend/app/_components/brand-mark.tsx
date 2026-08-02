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
      {/* Cobalt blue background — Attio blue-500 */}
      <rect width="48" height="48" rx="11" fill="#266df0" />

      {/* R — geometric sans-serif letterform */}
      {/* Stem */}
      <rect x="9" y="11" width="4" height="27" rx="2" fill="white" />
      {/* Bowl: D-shape — semicircle bulging right from stem edge (sweep clockwise) */}
      <path d="M 13 11 A 6 6 0 0 1 13 23 Z" fill="white" />
      {/* Leg: diagonal from bowl bottom */}
      <line x1="15" y1="23" x2="23" y2="37" stroke="white" strokeWidth="4" strokeLinecap="round" />

      {/* L — geometric sans-serif letterform */}
      {/* Stem */}
      <rect x="28" y="11" width="4" height="27" rx="2" fill="white" />
      {/* Base foot */}
      <rect x="28" y="33" width="11" height="4" rx="2" fill="white" />
    </svg>
  );
}
