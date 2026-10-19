import { HeroPoseLibrary, loadHeroPoses, saveHeroPoses } from './heroPoses';

/**
 * The hero poses saved in this browser from the Pose Studio. The game
 * applies them to the heroes (see getHero) as soon as they're saved.
 */

function browserStore(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // some privacy modes throw just for touching localStorage
  }
}

let saved: HeroPoseLibrary = loadHeroPoses(browserStore());

export function getSavedHeroPoses(): HeroPoseLibrary {
  return saved;
}

/** Save the studio's hero poses and start using them straight away. Returns false if saving failed. */
export function setSavedHeroPoses(lib: HeroPoseLibrary): boolean {
  saved = lib;
  return saveHeroPoses(browserStore(), lib);
}
