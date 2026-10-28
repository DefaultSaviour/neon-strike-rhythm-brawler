/**
 * The timing of an unlock's reveal in the popup after a song (kept apart so
 * it can be tested). A fighter or stance: the carousel spins fast, slows
 * and lands on it. A backdrop piece: its layer spins alone on a dark stage,
 * lands, holds a moment on its own, then the rest of the backdrop builds
 * round it. A tap skips straight to the end.
 */

export type RevealKind = 'carousel' | 'backdrop';
export type RevealPhase = 'spin' | 'land' | 'ready';

/** How long each beat takes (s): the spin, the moment it lands, and (a backdrop piece) the rest building round it */
export const REVEAL_TIMES: Record<RevealKind, { spin: number; land: number; build: number }> = {
  carousel: { spin: 2.4, land: 0.5, build: 0 },
  backdrop: { spin: 2.6, land: 1.0, build: 1.0 },
};

/** The whole reveal, start to ready (s). */
export function revealLength(kind: RevealKind): number {
  const t = REVEAL_TIMES[kind];
  return t.spin + t.land + t.build;
}

/** Where a reveal `t` seconds in is: still spinning, just landed, or done and waiting for the player. */
export function revealPhase(kind: RevealKind, t: number): RevealPhase {
  const times = REVEAL_TIMES[kind];
  if (t < times.spin) return 'spin';
  if (t < revealLength(kind)) return 'land';
  return 'ready';
}

/** Fast at first, slowing right down at the end (like a wheel coming to rest). */
export function spinEase(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return 1 - Math.pow(1 - t, 4);
}

/**
 * How many places the carousel still has to turn `t` seconds in, out of
 * `places` (it ends at 0, with the unlock in the middle). Add it to each
 * thing's offset, so they slide in from the right.
 */
export function spinLeft(t: number, places: number, spin = REVEAL_TIMES.carousel.spin): number {
  return places * (1 - spinEase(t / spin));
}

/**
 * How far a carousel of `count` spins before it lands: a whole turn and a
 * bit (so it's plainly spinning), or a few laps' worth for a short ring.
 */
export function spinPlaces(count: number): number {
  return Math.max(12, count + 4);
}
