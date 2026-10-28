/**
 * The maths behind the Options screen's controls: the pip meters (volumes)
 * and the timing bar. Kept apart so they can be tested.
 */

/** Keep `value` on the `step` grid between `min` and `max` (and free of float fuzz). */
export function snapValue(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Math.round(clamped * 1e6) / 1e6;
}

/** One step up (`dir` 1) or down (-1) from `value`. */
export function stepValue(value: number, dir: 1 | -1, min: number, max: number, step: number): number {
  return snapValue(value + dir * step, min, max, step);
}

/**
 * How many of a meter's `count` pips are lit when you tap or drag at
 * `fraction` across it (0 = its left edge, 1 = its right edge; past either
 * edge is fine). Tapping a pip lights it and every pip before it; dragging
 * off the left end turns them all off.
 */
export function pipsAt(fraction: number, count: number): number {
  if (fraction < 0) return 0;
  return Math.min(count, Math.max(1, Math.ceil(fraction * count)));
}

/** How many of `count` pips are lit for `value` between `min` and `max`. */
export function litPips(value: number, min: number, max: number, count: number): number {
  return Math.round(((value - min) / (max - min)) * count);
}

/** The value at `fraction` across a bar from `min` to `max` (the timing bar), on the `step` grid. */
export function valueAt(fraction: number, min: number, max: number, step: number): number {
  return snapValue(min + Math.min(1, Math.max(0, fraction)) * (max - min), min, max, step);
}
