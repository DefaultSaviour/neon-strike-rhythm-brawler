import type { LifetimeStats } from './heroUnlocks';

/**
 * The backdrop behind the fight is built from four layers the player mixes
 * and matches: a sky, a skyline on the horizon, a centrepiece (the big
 * thing on the horizon that pulses to the beat) and a floor running to the
 * conveyors. One of each is free (the original synthwave look); the other 16
 * unlock one at a time along a single path, at total-score milestones, or
 * straight away by watching a rewarded ad (scoring stays the free way to get
 * them all, as CrazyGames requires). Scores grow fast with combos, so one song
 * can pass several milestones: still only one piece opens per song, and the
 * rest follow one per song after.
 */

export type BackdropLayer = 'sky' | 'skyline' | 'centre' | 'floor';

export interface BackdropItem {
  id: string;
  layer: BackdropLayer;
  label: string;
  description: string;
}

export const BACKDROP_LAYERS: Array<{ layer: BackdropLayer; label: string }> = [
  { layer: 'sky', label: 'Sky' },
  { layer: 'skyline', label: 'Skyline' },
  { layer: 'centre', label: 'Centrepiece' },
  { layer: 'floor', label: 'Floor' },
];

export const BACKDROP_ITEMS: BackdropItem[] = [
  // Free: the original look
  { id: 'dusk', layer: 'sky', label: 'Synthwave Dusk', description: 'Deep purple, glowing pink low on the horizon' },
  { id: 'city', layer: 'skyline', label: 'Neon City', description: 'Tower blocks with the odd window lit' },
  { id: 'sun', layer: 'centre', label: 'Striped Sun', description: 'The classic sun, sinking behind the city' },
  { id: 'grid', layer: 'floor', label: 'Neon Grid', description: 'A glowing grid rolling toward you on the beat' },
  // Skies
  { id: 'starfield', layer: 'sky', label: 'Starfield Night', description: 'Twinkling stars and the odd shooting star' },
  { id: 'aurora', layer: 'sky', label: 'Aurora', description: 'Green and purple northern lights, slowly waving' },
  { id: 'ocean', layer: 'sky', label: 'Deep Ocean', description: 'Underwater blues, light rays and drifting bubbles' },
  { id: 'storm', layer: 'sky', label: 'Red Storm', description: 'Blood-red clouds, lightning on the big beats' },
  // Skylines
  { id: 'palms', layer: 'skyline', label: 'Palm Beach', description: 'Palm trees along a low shoreline' },
  { id: 'mountains', layer: 'skyline', label: 'Wireframe Mountains', description: 'Glowing outline ridges, straight out of the 80s' },
  { id: 'pyramids', layer: 'skyline', label: 'Pyramids', description: 'Neon-edged pyramids and temples' },
  { id: 'station', layer: 'skyline', label: 'Space Station', description: 'Floating platforms with blinking lights' },
  // Centrepieces
  { id: 'moon', layer: 'centre', label: 'Full Moon', description: 'A big pale moon, its glow swelling on the beat' },
  { id: 'speaker', layer: 'centre', label: 'Giant Speaker', description: 'A huge speaker cone thumping on every beat' },
  { id: 'planet', layer: 'centre', label: 'Ringed Planet', description: 'A giant planet whose rings flash on the beat' },
  { id: 'blackhole', layer: 'centre', label: 'Black Hole', description: 'A ring of light spinning faster on big beats' },
  // Floors
  { id: 'water', layer: 'floor', label: 'Water Reflection', description: 'Dark water, ripples rolling out on the beat' },
  { id: 'hex', layer: 'floor', label: 'Hex Tiles', description: 'Hexagon tiles lighting up in waves on the beat' },
  { id: 'checker', layer: 'floor', label: 'Chrome Checkerboard', description: 'A shiny retro checkerboard to the horizon' },
  { id: 'lava', layer: 'floor', label: 'Lava Cracks', description: 'Black rock with lava glowing on the beat' },
];

/** The free starting pieces: the original synthwave look. */
export const DEFAULT_BACKDROP: Record<BackdropLayer, string> = { sky: 'dusk', skyline: 'city', centre: 'sun', floor: 'grid' };

/** Everything else, in the order it unlocks: the layers take turns so every unlock brings something different. */
export const BACKDROP_UNLOCK_PATH: string[] = [
  'starfield', 'water', 'moon', 'palms',
  'aurora', 'hex', 'speaker', 'mountains',
  'ocean', 'checker', 'planet', 'pyramids',
  'storm', 'lava', 'blackhole', 'station',
];

/**
 * Total score (every song added up) needed for each step of the path. Close
 * together at first so the first few come quickly, then spreading out: a
 * decent player has them all after about 25 songs.
 */
export const BACKDROP_MILESTONES: number[] = [
  10_000, 25_000, 50_000, 100_000,
  175_000, 275_000, 400_000, 550_000,
  750_000, 1_000_000, 1_300_000, 1_650_000,
  2_000_000, 2_500_000, 3_000_000, 4_000_000,
];

/** Score milestones passed at this total score. */
export function milestonesFor(totalScore: number): number {
  return BACKDROP_MILESTONES.filter((m) => totalScore >= m).length;
}

/**
 * Milestone pieces open after a song: one more than before at most, however
 * many milestones the song's score passed (the rest come with later songs).
 */
export function backdropsAfterRun(unlockedBefore: number, totalScore: number): number {
  return Math.min(milestonesFor(totalScore), unlockedBefore + 1);
}

/** How many pieces of the path are open: the milestone pieces given so far, plus one per ad watched. */
export function backdropsEarned(stats: LifetimeStats): number {
  return Math.min(BACKDROP_UNLOCK_PATH.length, stats.backdropsUnlocked + stats.backdropAds);
}

export function isBackdropUnlocked(id: string, stats: LifetimeStats): boolean {
  const at = BACKDROP_UNLOCK_PATH.indexOf(id);
  return at < 0 ? BACKDROP_ITEMS.some((b) => b.id === id) : at < backdropsEarned(stats);
}

/** The next piece to unlock, or null when they're all open. */
export function nextBackdrop(stats: LifetimeStats): BackdropItem | null {
  const id = BACKDROP_UNLOCK_PATH[backdropsEarned(stats)];
  return id ? BACKDROP_ITEMS.find((b) => b.id === id)! : null;
}

/**
 * Total score still needed for the next piece (null when they're all open).
 * 0 means its milestone is already passed and it opens after the next song.
 */
export function scoreToNextBackdrop(stats: LifetimeStats): number | null {
  if (!nextBackdrop(stats)) return null;
  const next = BACKDROP_MILESTONES[stats.backdropsUnlocked];
  return next === undefined ? null : Math.max(0, next - stats.totalScore);
}

/**
 * The total score that opens a locked piece (null once it's open, or for a
 * free one). Pieces open in path order, one score milestone each; pieces
 * opened with ads skip ahead, so the milestones left move along with them.
 */
export function backdropGoalScore(id: string, stats: LifetimeStats): number | null {
  const at = BACKDROP_UNLOCK_PATH.indexOf(id);
  if (at < 0 || isBackdropUnlocked(id, stats)) return null;
  return BACKDROP_MILESTONES[at - backdropsEarned(stats) + stats.backdropsUnlocked] ?? null;
}

/** The chosen pieces, with anything not (or no longer) unlocked falling back to the free piece for that layer. */
export function activeBackdrop(chosen: Partial<Record<BackdropLayer, string>> | undefined, stats: LifetimeStats): Record<BackdropLayer, string> {
  const out = { ...DEFAULT_BACKDROP };
  for (const { layer } of BACKDROP_LAYERS) {
    const id = chosen?.[layer];
    const item = BACKDROP_ITEMS.find((b) => b.id === id);
    if (item && item.layer === layer && isBackdropUnlocked(item.id, stats)) out[layer] = item.id;
  }
  return out;
}
