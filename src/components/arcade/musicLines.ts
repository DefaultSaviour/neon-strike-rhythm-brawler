/**
 * The menus' music lines: the two colour slashes behind every arcade
 * screen, throbbing with the music: the pink one with the bass, the cyan
 * one with the mids, each getting up to 30% fatter on a hit and easing
 * back between. With no music they're the plain slashes they always were.
 *
 * Each screen can turn them to its own angle (the Fighters screen lays
 * them flat): going from one screen to the next swings them round like a
 * dial, keeping their widths and the gap between them.
 */

/** The slashes' angle, as in the old CSS gradient: 115deg */
const ANGLE = (115 * Math.PI) / 180;

/**
 * Which way the stripes point, as the angle (degrees, clockwise from
 * pointing right) of the line straight across them, from the thick pink
 * one to the thin cyan one: the usual slash, and nearly flat (the Fighters
 * screen, the user's sketch: pink on top, rising a touch to the right).
 */
export const SLASH_ANGLE = (Math.atan2(-Math.cos(ANGLE), Math.sin(ANGLE)) * 180) / Math.PI;
export const FLAT_ANGLE = 88.8;

/**
 * Each menu screen's stripe angle (see SLASH_ANGLE): opening one swings the
 * stripes round to it, each a different way. The title and results keep
 * the slash, the Unlocks tabs lie flat, Options leans the other way, and
 * Records and the song list are the shallow slant one way and the other.
 */
export const STRIPE_ANGLES = {
  slash: SLASH_ANGLE,
  flat: FLAT_ANGLE,
  options: -25,
  records: 60,
  songs: -60,
} as const;
export type StripeStyle = keyof typeof STRIPE_ANGLES;

export interface StripeLayout {
  /** Where the middle of each stripe crosses the screen, its width, and colour */
  stripes: Array<{ x: number; y: number; width: number; color: string; kind: 'bass' | 'mid' }>;
  /** Along the stripe, and across it (the way the music pushes it) */
  along: { x: number; y: number };
  across: { x: number; y: number };
  /** How far each stripe runs either side of its middle: off screen both ways */
  halfLength: number;
}

/**
 * Where the stripes go on a w x h screen, turned to `angle` (see
 * SLASH_ANGLE). At the slash they sit where the CSS gradient they replace
 * did (a 115deg gradient on a box 20% bigger than the screen each side,
 * pink at 46-49% of the way along it, cyan at 51-52%). Turning them only
 * turns them, about the middle of the screen: they keep their widths and
 * the gap between them.
 */
export function stripeLayout(w: number, h: number, angle = SLASH_ANGLE): StripeLayout {
  const a = (angle * Math.PI) / 180;
  const across = { x: Math.cos(a), y: Math.sin(a) };
  const along = { x: -across.y, y: across.x };
  // Sizes come from the slash, so they stay the same however far the stripes turn
  const length = Math.abs(w * 1.4 * Math.sin(ANGLE)) + Math.abs(h * 1.4 * Math.cos(ANGLE));
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

/** How quickly the stripes swing round to a new screen's angle (rad/s), and how springy that is (1 = no overshoot) */
const DIAL_SPEED = 11;
const DIAL_DAMPING = 0.72;

/**
 * One step of the stripes swinging round to `target` like a dial: they
 * spring towards it, overshoot a touch and settle. Takes and gives the
 * angle and how fast it's turning (degrees, degrees a second).
 */
export function dialStep(angle: number, speed: number, target: number, dt: number): { angle: number; speed: number } {
  // Small steps, so a slow frame doesn't throw it off
  const steps = Math.max(1, Math.ceil(dt / 0.01));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    speed += (DIAL_SPEED * DIAL_SPEED * (target - angle) - 2 * DIAL_DAMPING * DIAL_SPEED * speed) * h;
    angle += speed * h;
  }
  return { angle, speed };
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
