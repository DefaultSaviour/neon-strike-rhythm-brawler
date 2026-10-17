import { BeatNote, EnemyTier, FrequencyBand } from '../types/game';

export interface EnemyStyle {
  name: string;
  /** Main neon body color (hex, #rrggbb so alpha suffixes can be appended) */
  color: string;
  /** Secondary highlight color for eyes, weapons and effects */
  accent: string;
  /** Render scale relative to the player */
  scale: number;
}

/**
 * Enemy roster: 3 frequency bands x 3 tiers.
 * Tier 1 = beats sitting at the LOW extreme of the band's Hz range,
 * Tier 3 = beats sitting at the HIGH extreme.
 *
 *  - sub  (kick / sub,   ~36-145 Hz)   -> red / orange heavies
 *  - bass (bassline,     ~105-300 Hz)  -> purple / magenta groove fighters
 *  - high (snare / lead, ~800-6500 Hz) -> cyan / mint / white aerial units
 */
export const ENEMY_STYLES: Record<FrequencyBand, Record<EnemyTier, EnemyStyle>> = {
  sub: {
    1: { name: 'Titan', color: '#ff1744', accent: '#ff8a80', scale: 1.15 },
    2: { name: 'Breaker', color: '#ff3d5a', accent: '#ffd0d8', scale: 1.0 },
    3: { name: 'Rammer', color: '#ff6a2b', accent: '#ffd180', scale: 0.96 },
  },
  bass: {
    1: { name: 'Warlord', color: '#9d4dff', accent: '#e1c4ff', scale: 1.08 },
    2: { name: 'Ronin', color: '#d84dff', accent: '#ffe600', scale: 1.0 },
    3: { name: 'Acid Dancer', color: '#ff4fd8', accent: '#b6ff3d', scale: 0.95 },
  },
  high: {
    1: { name: 'Speeder', color: '#00e5ff', accent: '#ffffff', scale: 0.98 },
    2: { name: 'Wraith', color: '#3dffb0', accent: '#d0fff0', scale: 1.0 },
    3: { name: 'Seraph', color: '#c8f8ff', accent: '#7df9ff', scale: 1.0 },
  },
};

export const BAND_LABELS: Record<FrequencyBand, string> = {
  sub: 'Kick / Sub',
  bass: 'Bassline',
  high: 'Highs',
};

/** Resolve band + tier for a note or enemy, with a fallback for charts made before band analysis existed. */
export function resolveBandTier(target: {
  band?: FrequencyBand;
  tier?: EnemyTier;
  pitchCategory?: BeatNote['pitchCategory'];
}): { band: FrequencyBand; tier: EnemyTier } {
  if (target.band) {
    return { band: target.band, tier: target.tier ?? 2 };
  }
  const p = target.pitchCategory;
  const band: FrequencyBand = p === 'kick' ? 'sub' : p === 'bass' ? 'bass' : 'high';
  return { band, tier: 2 };
}

export function getEnemyStyle(band: FrequencyBand, tier: EnemyTier): EnemyStyle {
  return ENEMY_STYLES[band][tier];
}
