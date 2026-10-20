/**
 * Which unlocks the player has already tapped on, so new ones can wear a
 * number badge (on the Unlocks button and its tabs) until they're looked at.
 * Keys carry their kind ('hero:dragon', 'stance:sway', 'backdrop:moon'):
 * the three kinds' ids could otherwise clash.
 */

export type UnlockKind = 'hero' | 'stance' | 'backdrop';

const STORAGE_KEY = 'neon_strike_seen_unlocks_v1';

export const unlockKey = (kind: UnlockKind, id: string) => `${kind}:${id}`;

/**
 * The saved list. With nothing saved yet (a new player, or one from before
 * badges existed), everything open right now counts as seen, so nobody
 * starts with a pile of badges for things they already have.
 */
export function loadSeen(
  store: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  unlockedNow: string[],
  options: { seed?: boolean } = {},
): Set<string> {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.filter((k): k is string => typeof k === 'string'));
    }
  } catch {
    // Unreadable: start again from what's open now
  }
  const seen = new Set(options.seed === false ? [] : unlockedNow);
  if (options.seed !== false) saveSeen(store, seen);
  return seen;
}

export function saveSeen(store: Pick<Storage, 'setItem'> | undefined, seen: Set<string>) {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {
    // Private modes can refuse storage; the badges then come back next visit.
  }
}

/** Open but not yet tapped on. */
export function unseen(unlockedNow: string[], seen: Set<string>): string[] {
  return unlockedNow.filter((k) => !seen.has(k));
}
