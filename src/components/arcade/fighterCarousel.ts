/**
 * The maths behind the Fighters carousel: where each fighter sits around the
 * one in focus, which way a swipe goes, and the showcase combo the focused
 * fighter builds up while you look at them. Kept apart so it can be tested.
 */

/**
 * How many places `index` is from `focus` in a ring of `count`: 0 is the one
 * in focus, -1 just left of it, 2 two to the right, and so on. It wraps the
 * short way round, so the last fighter sits just left of the first.
 */
export function carouselOffset(index: number, focus: number, count: number): number {
  if (count <= 0) return 0;
  let d = (((index - focus) % count) + count) % count;
  if (d > count / 2) d -= count;
  return d;
}

/** The fighter `step` places on from `focus`, wrapping round. */
export function wrapIndex(focus: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return (((focus + step) % count) + count) % count;
}

/**
 * Where something `offset` places from the one in focus stands (fractions
 * too, while a finger drags the ring round): how far out (arcade units, a
 * negative offset is to the left), how big and how faded. Between whole
 * places it moves smoothly, so dragging grows the one coming to the middle
 * and shrinks the one leaving it.
 */
const PLACES = [
  { x: 0, scale: 1, opacity: 1 },
  { x: 44, scale: 0.6, opacity: 0.85 },
  { x: 74, scale: 0.42, opacity: 0.55 },
  { x: 98, scale: 0.3, opacity: 0 },
  { x: 118, scale: 0.22, opacity: 0 },
];
export function placeAt(offset: number): { x: number; scale: number; opacity: number } {
  const a = Math.min(Math.abs(offset), PLACES.length - 1);
  const lo = Math.floor(a);
  const hi = Math.min(PLACES.length - 1, lo + 1);
  const t = a - lo;
  const mix = (k: 'x' | 'scale' | 'opacity') => PLACES[lo][k] + (PLACES[hi][k] - PLACES[lo][k]) * t;
  return { x: Math.sign(offset) * mix('x'), scale: mix('scale'), opacity: mix('opacity') };
}

/** An offset (fractions too) wrapped the short way round a ring of `count`. */
export function wrapOffset(offset: number, count: number): number {
  if (count <= 0) return 0;
  let d = ((offset % count) + count) % count;
  if (d > count / 2) d -= count;
  return d;
}

/**
 * How many places a drag moves the carousel when the finger lets go:
 * `dx` px across (dragging left brings the next ones in), one place every
 * `stepPx`, to the nearest place. A quick flick (`speed` px/ms) moves at
 * least one, even if it was short; a tiny drag is a tap and moves none.
 */
export function releaseSteps(dx: number, stepPx: number, speed = 0): number {
  if (Math.abs(dx) < TAP_PX) return 0;
  const steps = Math.round(-dx / stepPx);
  if (steps === 0 && Math.abs(speed) > 0.35) return dx < 0 ? 1 : -1;
  return steps;
}
/** A drag shorter than this (px) is a tap */
export const TAP_PX = 8;

/** How many beats the showcase combo runs before it starts again (it holds the top form for the last stretch). */
export const SHOWCASE_BEATS = 40;

/** The combo after `beatsIn` beats of the showcase: two hits a move, so the top form arrives in about 25 beats. */
export function showcaseCombo(beatsIn: number): number {
  return beatsIn < 0 ? 0 : (beatsIn + 1) * 2;
}

/**
 * Keeps count of the beats since the fighter came into focus. Give it the
 * beat being heard; it answers how many beats in the showcase is (0 on the
 * first, wrapping every SHOWCASE_BEATS). A new fighter in focus, or the
 * music jumping back (the preview looping to its start), starts it again.
 */
export class ShowcaseCounter {
  private key: string | null = null;
  private start = 0;

  beatsIn(key: string, beat: number): number {
    if (key !== this.key || beat < this.start) {
      this.key = key;
      this.start = beat;
    }
    return (beat - this.start) % SHOWCASE_BEATS;
  }
}
