/**
 * Body thickness shared by the renderer (components/neonBody.ts) and the
 * debris physics, so the pieces an enemy breaks into are the same size as the
 * limbs you just saw.
 */

/** Full width (world units) of each limb segment, before an enemy's limbScale. */
export const LIMB_WIDTH = { upperArm: 7, forearm: 5.5, thigh: 8, shin: 6.5 } as const;
/** Torso thickness used for the matching debris piece. */
export const TORSO_WIDTH = 10;
