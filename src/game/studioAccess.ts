/**
 * The Pose Studio is a designer's tool, not a player feature: it only exists
 * in dev builds (`npm run dev`). In the published game its button is hidden
 * and any studio edits saved in the browser are ignored, so every player gets
 * exactly the heroes and enemy animations that ship with the game. Poses
 * made in the studio go into the game by baking them into the code.
 */
export const STUDIO_ENABLED: boolean = !!import.meta.env?.DEV;
