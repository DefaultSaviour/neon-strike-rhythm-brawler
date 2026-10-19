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
 * See https://docs.crazygames.com/sdk/intro/ and /sdk/video-ads/.
 */

type Environment = 'crazygames' | 'local' | 'disabled';

interface CrazySdk {
  init: () => Promise<void>;
  environment: Environment;
  ad: {
    requestAd: (
      type: 'rewarded' | 'midgame',
      callbacks: { adStarted?: () => void; adFinished?: () => void; adError?: (error: { code: string; message: string }) => void }
    ) => void;
  };
}

function sdk(): CrazySdk | undefined {
  return (globalThis as unknown as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
}

let ready: Promise<boolean> | null = null;

/** Start the SDK once. Resolves true when ads can be shown here. */
export function initCrazyGames(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      const s = sdk();
      if (!s) return false;
      try {
        await s.init();
        return s.environment === 'crazygames' || s.environment === 'local';
      } catch {
        return false;
      }
    })();
  }
  return ready;
}

/**
 * Show a rewarded ad. Resolves true only if the player watched it to the
 * end (that's when they get the reward). `onPause` / `onResume` mute and
 * unmute the game around the ad, as CrazyGames requires.
 */
export async function showRewardedAd(onPause: () => void, onResume: () => void): Promise<boolean> {
  if (!(await initCrazyGames())) return false;
  const s = sdk()!;
  return new Promise((resolve) => {
    try {
      s.ad.requestAd('rewarded', {
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
