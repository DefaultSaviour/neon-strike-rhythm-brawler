/**
 * Arena layout: how the game world maps onto the screen.
 *
 * Everything in the fight (fighters, enemies, debris, strike zones) is drawn
 * in "world units" where the floor is at y = FLOOR_Y and a fighter is about
 * FIGHTER_HEIGHT tall. Previously world units were raw pixels, so on a big
 * monitor the fight was a tiny strip in a sea of empty space. Now we pick a
 * scale so the fighters fill a sensible share of the screen.
 */

export const FLOOR_Y = 68;
/** Head-crest to feet height of a fighter, in world units */
export const FIGHTER_HEIGHT = 145;

export interface ArenaLayout {
  /** Screen pixels per world unit */
  scale: number;
  /** Screen position of the world origin (centre of the arena) */
  originX: number;
  originY: number;
  /** Screen y of the floor line the fighters stand on */
  floorScreenY: number;
  /** Screen y of the horizon behind the fight */
  horizonY: number;
  /** Half the screen width, in world units (enemies spawn just beyond this) */
  worldHalfWidth: number;
}

/** Fraction of screen height from the top where the fighters' feet go */
const FLOOR_SCREEN_FRACTION = 0.8;
/** Target fighter height as a fraction of screen height */
const FIGHTER_SCREEN_FRACTION = 0.34;
/**
 * The arena looks and plays the same on every screen: enemies always start
 * SPAWN_DISTANCE from the centre and cross to the strike line at the same
 * speed. At least VISIBLE_HALF_WIDTH either side of the centre is always on
 * screen (exactly that on a 16:9 screen), so the approach can always be seen;
 * narrower screens (tablets, phones) shrink the fighters a little to fit it,
 * wider ones show extra floor and the enemies fade in at the spawn point.
 */
export const VISIBLE_HALF_WIDTH = 380;
/** Where enemies start, from the centre: just off the edge of a 16:9 screen */
export const SPAWN_DISTANCE = 460;
const MIN_VISIBLE_WORLD_WIDTH = VISIBLE_HALF_WIDTH * 2;
const MIN_SCALE = 0.45;
const MAX_SCALE = 6;
/** Height of the horizon above the floor line, in world units (a fighter is 145 tall) */
const HORIZON_ABOVE_FLOOR = 175;

export function computeArenaLayout(width: number, height: number): ArenaLayout {
  const byHeight = (height * FIGHTER_SCREEN_FRACTION) / FIGHTER_HEIGHT;
  const byWidth = width / MIN_VISIBLE_WORLD_WIDTH;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, byHeight, byWidth));

  const floorScreenY = height * FLOOR_SCREEN_FRACTION;
  const originY = floorScreenY - FLOOR_Y * scale;
  // Horizon sits well above the fighters' heads, so they stand against a calm
  // receding floor instead of the bright sky (easier to read, feels deeper).
  const horizonY = Math.max(height * 0.2, floorScreenY - HORIZON_ABOVE_FLOOR * scale);

  return {
    scale,
    originX: width / 2,
    originY,
    floorScreenY,
    horizonY,
    worldHalfWidth: width / 2 / scale,
  };
}
