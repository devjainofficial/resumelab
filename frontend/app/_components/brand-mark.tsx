/* Brand artwork. Source lockup lives in public/brand; the -dark variants lift the
   near-black wordmark and brighten the blues so the art holds up on #101010. */

const LOCKUP = { w: 821, h: 157 };
const MARK = { w: 265, h: 157 };

function Swap({
  light,
  dark,
  width,
  height,
  alt,
}: {
  light: string;
  dark: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <span className="inline-flex shrink-0" style={{ width, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt={alt} width={width} height={height} className="brand-light" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark} alt="" aria-hidden width={width} height={height} className="brand-dark" />
    </span>
  );
}

/** Mark only — for tight or square slots. `size` is the rendered height. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Swap
      light="/brand/mark.png"
      dark="/brand/mark-dark.png"
      width={Math.round((size * MARK.w) / MARK.h)}
      height={size}
      alt="ResumeLab"
    />
  );
}

/** Full mark + wordmark lockup. `height` is the rendered height. */
export function BrandLockup({ height = 22 }: { height?: number }) {
  return (
    <Swap
      light="/brand/logo.png"
      dark="/brand/logo-dark.png"
      width={Math.round((height * LOCKUP.w) / LOCKUP.h)}
      height={height}
      alt="ResumeLab"
    />
  );
}
