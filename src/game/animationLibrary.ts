import { BUNDLED_ANIMATIONS } from './bundledAnimations';
import {
  AnimationLibrary,
  KeyValueStore,
  loadSavedAnimations,
  mergeLibraries,
  parseLibrary,
  saveAnimations,
} from './customAnimation';

/**
 * The custom animations the game is using right now: the ones bundled with
 * the game, overridden by the ones saved in this browser from the studio.
 */

function browserStore(): KeyValueStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // some privacy modes throw just for touching localStorage
  }
}

const bundled = parseLibrary(BUNDLED_ANIMATIONS);
let saved = loadSavedAnimations(browserStore());
let active = mergeLibraries(bundled, saved);

/** Everything the game draws with (bundled + saved). */
export function getActiveAnimations(): AnimationLibrary {
  return active;
}

/** Just the animations saved in this browser (what the studio edits). */
export function getSavedAnimations(): AnimationLibrary {
  return saved;
}

/** Animations that ship with the game (shown in the studio when nothing is saved). */
export function getBundledAnimations(): AnimationLibrary {
  return bundled;
}

/** Save the studio's animations and start using them straight away. Returns false if saving failed. */
export function setSavedAnimations(lib: AnimationLibrary): boolean {
  saved = lib;
  active = mergeLibraries(bundled, saved);
  return saveAnimations(browserStore(), lib);
}
