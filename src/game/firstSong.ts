/**
 * A brand-new player's first song: New Game goes straight into the easiest
 * song with one click (CrazyGames asks for this), played as practice, so
 * getting hit doesn't end it in the first few seconds while they learn.
 *
 * Practice adds no play time to the totals, so "brand new" can't be told
 * from the totals alone (every New Game would be practice forever). The
 * first song is remembered instead, in the saved progress.
 */

const STORAGE_KEY = 'neon_strike_first_song_v1';

/** True when this player still gets the first song as practice: never played, and never had it. */
export function needsFirstSong(store: Pick<Storage, 'getItem'> | undefined, playSeconds: number): boolean {
  if (playSeconds > 0) return false;
  try {
    return store?.getItem(STORAGE_KEY) !== 'done';
  } catch {
    return true;
  }
}

/** Remember that the first song has been given. */
export function markFirstSongDone(store: Pick<Storage, 'setItem'> | undefined) {
  try {
    store?.setItem(STORAGE_KEY, 'done');
  } catch {
    // Private modes can refuse storage; they just get the practice start again next visit.
  }
}
