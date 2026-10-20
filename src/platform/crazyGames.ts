/**
 * The CrazyGames SDK (loaded by a script tag in index.html), wrapped so the
 * rest of the game never touches it directly and never breaks without it.
 *
 * The SDK reports where it is running:
 * - 'crazygames': on CrazyGames, everything works for real.
 * - 'local': on localhost; ads are a demo overlay, so we can test the flow.
 * - 'disabled': any other site; SDK calls throw, so we don't make any.
 * If the script didn't load at all (offline, blocked), it counts as disabled.
 *
 * What the game uses (see https://docs.crazygames.com/sdk/intro/):
 * - gameplay start/stop, around the time the player is actually in a song
 * - loading start/stop, around loading a song
 * - the muteAudio setting, which overrides the game's own volume
 * - rewarded ads, and adblock detection so ad buttons never sit there doing nothing
 * - midgame ads at the end of a song (paced by adPacing), and a celebration when a hero unlocks
 * - the data module on CrazyGames, so progress follows the player's account
 */

type Environment = 'crazygames' | 'local' | 'disabled';

interface GameSettings {
  muteAudio?: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface CrazySdk {
  init: () => Promise<void>;
  environment: Environment;
  ad: {
    requestAd: (
      type: 'rewarded' | 'midgame',
      callbacks: { adStarted?: () => void; adFinished?: () => void; adError?: (error: { code: string; message: string }) => void }
    ) => void;
    hasAdblock?: () => Promise<boolean>;
  };
  game?: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    loadingStart: () => void;
    loadingStop: () => void;
    happytime?: () => void;
    settings?: GameSettings;
    addSettingsChangeListener?: (listener: (settings: GameSettings) => void) => void;
  };
  data?: StorageLike;
}

function sdk(): CrazySdk | undefined {
  return (globalThis as unknown as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
}

let ready: Promise<boolean> | null = null;
/** Where the SDK says it is running, once it has started ('disabled' until then). */
let environment: Environment = 'disabled';

/** Start the SDK once. Resolves true when the SDK works here (on CrazyGames or localhost). */
export function initCrazyGames(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      const s = sdk();
      if (!s) return false;
      try {
        await s.init();
        environment = s.environment;
        return environment === 'crazygames' || environment === 'local';
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

/** The SDK's game module, only once the SDK has started and is live here. */
function game() {
  return environment === 'crazygames' || environment === 'local' ? sdk()?.game : undefined;
}

function safely(call: () => void) {
  try {
    call();
  } catch {
    // The SDK must never break the game.
  }
}

let gameplayActive = false;

/**
 * Tell CrazyGames whether the player is in gameplay right now (in a song,
 * not paused, not in a menu). Only changes are passed on, so it's safe to
 * call on every status change.
 */
export function setGameplayActive(active: boolean) {
  if (active === gameplayActive) return;
  const g = game();
  if (!g) return;
  gameplayActive = active;
  safely(() => (active ? g.gameplayStart() : g.gameplayStop()));
}

/** A song is loading (decoding and charting) / has finished loading. */
export function loadingStart() {
  const g = game();
  if (g) safely(() => g.loadingStart());
}

export function loadingStop() {
  const g = game();
  if (g) safely(() => g.loadingStop());
}

/**
 * Follow CrazyGames' muteAudio setting: `onChange(true)` means the game must
 * be silent, whatever its own volume settings say. Called once straight
 * away with the current setting, then whenever it changes.
 */
export async function followMuteSetting(onChange: (muted: boolean) => void) {
  if (!(await initCrazyGames())) return;
  const g = game();
  if (!g) return;
  onChange(!!g.settings?.muteAudio);
  safely(() => g.addSettingsChangeListener?.((settings) => onChange(!!settings.muteAudio)));
}

/** True when CrazyGames detects an ad blocker (rewarded ads won't play). */
export async function hasAdblock(): Promise<boolean> {
  if (!(await initCrazyGames())) return false;
  try {
    return (await sdk()?.ad.hasAdblock?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * How a rewarded ad went:
 * - 'watched': played to the end, so the player gets the reward
 * - 'unavailable': ads can't play here at all (an ad blocker, or ads switched
 *   off during CrazyGames' Basic Launch), so stop offering them
 * - 'failed': this one didn't play (none available, closed early...); no reward
 */
export type RewardedResult = 'watched' | 'unavailable' | 'failed';

/** The adError codes that mean no rewarded ad will play here this visit. */
const ADS_OFF = ['adblock', 'adsDisabledBasicLaunch'];

/**
 * Show a rewarded ad. `onPause` / `onResume` mute and unmute the game
 * around the ad, as CrazyGames requires (only once it actually starts).
 */
export async function showRewardedAd(onPause: () => void, onResume: () => void): Promise<RewardedResult> {
  if (!(await initCrazyGames())) return 'unavailable';
  const s = sdk()!;
  return new Promise((resolve) => {
    try {
      s.ad.requestAd('rewarded', {
        adStarted: onPause,
        adFinished: () => {
          onResume();
          resolve('watched');
        },
        adError: (error) => {
          onResume();
          resolve(ADS_OFF.includes(error?.code) ? 'unavailable' : 'failed');
        },
      });
    } catch {
      onResume();
      resolve('failed');
    }
  });
}

/**
 * Show a midgame ad (at the end of a song). Resolves true if one played to
 * the end. CrazyGames decides whether one actually plays: it skips requests
 * that come too soon after the last ad (adCooldown), has none to show, or an
 * ad blocker is on; any of those just resolves false straight away.
 */
export async function showMidgameAd(onPause: () => void, onResume: () => void): Promise<boolean> {
  if (!(await initCrazyGames())) return false;
  const s = sdk()!;
  return new Promise((resolve) => {
    try {
      s.ad.requestAd('midgame', {
        adStarted: onPause,
        adFinished: () => {
          onResume();
          resolve(true);
        },
        adError: () => {
          onResume();
          resolve(false);
        },
      });
    } catch {
      onResume();
      resolve(false);
    }
  });
}

/** Make the CrazyGames site celebrate (confetti): for special moments only, like unlocking a hero. */
export function happytime() {
  const g = game();
  if (g?.happytime) safely(() => g.happytime!());
}

/** The browser's own storage, or nothing when it won't allow it (some privacy modes throw just for touching it). */
function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Where to keep the player's progress (unlocks, settings, high scores).
 * On CrazyGames that's the SDK's data module, which works like localStorage
 * but follows a logged-in player's account onto every device (guests are
 * kept in the browser by the SDK itself). Everywhere else, and if the data
 * module is switched off in the submission, it's the browser's localStorage.
 */
export function progressStore(): StorageLike | undefined {
  const data = environment === 'crazygames' ? sdk()?.data : undefined;
  const local = browserStorage();
  if (!data) return local;
  return {
    getItem: (key) => {
      try {
        return data.getItem(key);
      } catch {
        return local?.getItem(key) ?? null;
      }
    },
    setItem: (key, value) => {
      try {
        data.setItem(key, value);
      } catch {
        local?.setItem(key, value);
      }
    },
    removeItem: (key) => {
      try {
        data.removeItem(key);
      } catch {
        local?.removeItem(key);
      }
    },
  };
}
