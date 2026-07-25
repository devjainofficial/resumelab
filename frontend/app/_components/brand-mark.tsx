export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="var(--brand)" />
      <rect
        x="5.5"
        y="6"
        width="12"
        height="17"
        rx="2"
        stroke="var(--on-brand)"
        strokeOpacity="0.92"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 10.5H14.5M8.5 13.5H14.5M8.5 16.5H12.5"
        stroke="var(--on-brand)"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M25,6 L26,8 L28,9 L26,10 L25,12 L24,10 L22,9 L24,8 Z"
        fill="var(--brand-strong)"
        fillOpacity="0.7"
      />
    </svg>
  );
}
