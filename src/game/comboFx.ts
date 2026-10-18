/**
 * How the combo chain changes hit effects.
 *
 * Explosions get stronger the longer your chain, with no hard ceiling where it
 * suddenly stops growing: the curve rises fast early on and keeps creeping up
 * for very long chains (it approaches, but never quite reaches, MAX_BLAST).
 *
 *   combo:   0    10    25    50    100   200
 *   power: 1.00  1.35  1.75  2.15  2.48  2.59
 */

/** The blast multiplier can approach this value but never exceed it. */
export const MAX_BLAST = 2.6;
/** Bigger = slower build-up */
const BLAST_BUILD = 40;

export function comboBlastPower(combo: number): number {
  const c = Math.max(0, combo);
  return 1 + (MAX_BLAST - 1) * (1 - Math.exp(-c / BLAST_BUILD));
}

/** Extra armour shards thrown off per kill at higher chains (kept small to avoid clutter). */
export function extraShardsForCombo(combo: number): number {
  if (combo >= 100) return 5;
  if (combo >= 50) return 4;
  if (combo >= 25) return 3;
  if (combo >= 10) return 2;
  return 0;
}

/**
 * Clutter budgets. Long songs at high combos used to fill the screen with
 * hundreds of pieces and sparks; these caps keep the fight readable.
 */
/** Riding pieces are cheap to draw (cooled pieces don't glow), so this can be generous. */
export const MAX_DEBRIS = 150;
export const MAX_PARTICLES = 160;
