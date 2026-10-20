/**
 * When to show a midgame ad. Only ever at the end of a song (after a death
 * or a clear), and only once the player has spent at least
 * SECONDS_BETWEEN_ADS actually playing songs since the last ad (menus don't
 * count). So a new player sees none in their first 5 minutes, and with songs
 * about 3 minutes long it works out to about one ad every two songs.
 * CrazyGames' own limit (one every 3 minutes) still applies on top.
 *
 * If an ad was due but none played (none available, an ad blocker), the
 * clock isn't reset: the next song end tries again.
 */
export const SECONDS_BETWEEN_ADS = 5 * 60;

/** `playSeconds` is the lifetime total of time spent in songs; `atLastAd` its value after the last ad. */
export function midgameAdDue(playSeconds: number, atLastAd: number, every = SECONDS_BETWEEN_ADS): boolean {
  return playSeconds - atLastAd >= every;
}
