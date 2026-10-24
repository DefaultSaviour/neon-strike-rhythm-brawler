/**
 * The menus' music lines: the two colour slashes behind every arcade
 * screen, throbbing with the music: the pink one with the bass, the cyan
 * one with the mids, each getting up to 30% fatter on a hit and easing
 * back between. With no music they're the plain slashes they always were.
 */

/** The slashes' angle, as in the old CSS gradient: 115deg */
const ANGLE = (115 * Math.PI) / 180;

export interface StripeLayout {
  /** Where the middle of each stripe crosses the screen, its width, and colour */
  stripes: Array<{ x: number; y: number; width: number; color: string; kind: 'bass' | 'mid' }>;
  /** Along the stripe (top-right to bottom-left), and across it (the way the music pushes it) */
  along: { x: number; y: number };
  across: { x: number; y: number };
  /** How far each stripe runs either side of its middle: off screen both ways */
  halfLength: number;
}

/**
 * Where the stripes go on a w x h screen: the same places as the CSS
 * gradient they replace (a 115deg gradient on a box 20% bigger than the
 * screen each side, pink at 46-49% of the way along it, cyan at 51-52%).
 */
export function stripeLayout(w: number, h: number): StripeLayout {
  const across = { x: Math.sin(ANGLE), y: -Math.cos(ANGLE) };
  const along = { x: -across.y, y: across.x };
  const bw = w * 1.4;
  const bh = h * 1.4;
  const length = Math.abs(bw * Math.sin(ANGLE)) + Math.abs(bh * Math.cos(ANGLE));
  const at = (fraction: number) => ({ x: w / 2 + across.x * (fraction - 0.5) * length, y: h / 2 + across.y * (fraction - 0.5) * length });
  const pink = at(0.475);
  const cyan = at(0.515);
  return {
    stripes: [
      { ...pink, width: 0.03 * length, color: '#ff1f6d', kind: 'bass' },
      { ...cyan, width: 0.01 * length, color: '#00e5ff', kind: 'mid' },
    ],
    along,
    across,
    halfLength: Math.hypot(w, h),
  };
}

/** How much fatter the music can make a line: up to 30% */
export const THROB = 0.3;
/** How quickly a line eases back after a hit (s, to about a third) */
export const THROB_RELEASE_SEC = 0.18;

/**
 * A line's throb: jumps straight up with each hit (like a speaker cone),
 * then eases back down until the next. `level` is how loud it is now, 0..1.
 */
export function throbAfter(previous: number, level: number, dt: number): number {
  const eased = previous * Math.exp(-dt / THROB_RELEASE_SEC);
  return Math.max(0, Math.min(1, Math.max(eased, level)));
}

/** How loud a wave is (RMS). */
export function waveLevel(wave: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < wave.length; i++) s += wave[i] * wave[i];
  return Math.sqrt(s / Math.max(1, wave.length));
}
