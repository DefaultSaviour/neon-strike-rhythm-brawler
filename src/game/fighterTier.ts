/**
 * The player's combo tiers: how your fighter looks as the chain grows.
 * Shared by the in-game fighter and the results-screen progress runner.
 */

export interface FighterTier {
  name: string;
  /** Minimum combo for this tier */
  minCombo: number;
  /** Outline / glow colour */
  color: string;
  glow: number;
  /** Ground aura ring under the feet */
  aura: boolean;
  /** Ghost afterimage while attacking */
  ghost: boolean;
  /** Crackling lightning from chest to hands */
  lightning: boolean;
  /**
   * Top-level form. Each hero shows it their own way (see fighterArt.ts):
   * the Neon Striker grows radiant angel wings, the Little Dragon is circled
   * by a golden dragon spirit.
   */
  ascended: boolean;
  scarfColor: string;
  visorColor: string;
}

export const FIGHTER_TIERS: readonly FighterTier[] = [
  { name: 'BASIC STRIKER', minCombo: 0, color: '#00f3ff', glow: 16, aura: false, ghost: false, lightning: false, ascended: false, scarfColor: '#ff007f', visorColor: '#ffe600' },
  { name: 'ACROBATIC', minCombo: 6, color: '#38bdf8', glow: 19, aura: true, ghost: false, lightning: false, ascended: false, scarfColor: '#ff007f', visorColor: '#ffe600' },
  { name: 'CYBER NINJA', minCombo: 16, color: '#ff007f', glow: 22, aura: true, ghost: true, lightning: false, ascended: false, scarfColor: '#ff007f', visorColor: '#ffe600' },
  { name: 'OVERDRIVE', minCombo: 30, color: '#ffe600', glow: 26, aura: true, ghost: true, lightning: true, ascended: false, scarfColor: '#ffe600', visorColor: '#ffffff' },
  // Pale gold rather than pure white: white means "enemy just got hit".
  { name: 'GOD TIER', minCombo: 50, color: '#fff1a8', glow: 30, aura: true, ghost: true, lightning: true, ascended: true, scarfColor: '#ffe600', visorColor: '#ffffff' },
];

export function fighterTier(combo: number): FighterTier {
  let tier = FIGHTER_TIERS[0];
  for (const t of FIGHTER_TIERS) if (combo >= t.minCombo) tier = t;
  return tier;
}
