import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for window.CrazyGames.SDK that records what the game calls. */
function fakeSdk(environment: 'crazygames' | 'local' | 'disabled', adError?: string) {
  const calls: string[] = [];
  const data = new Map<string, string>();
  const sdk = {
    environment,
    init: async () => {},
    ad: {
      requestAd: (_type: string, cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: { code: string; message: string }) => void }) => {
        if (adError) cb.adError?.({ code: adError, message: adError });
        else {
          cb.adStarted?.();
          cb.adFinished?.();
        }
      },
      hasAdblock: async () => adError === 'adblock',
    },
    game: {
      gameplayStart: () => calls.push('gameplayStart'),
      gameplayStop: () => calls.push('gameplayStop'),
      loadingStart: () => calls.push('loadingStart'),
      loadingStop: () => calls.push('loadingStop'),
      happytime: () => calls.push('happytime'),
      settings: { muteAudio: true },
      addSettingsChangeListener: () => calls.push('listen'),
    },
    user: {
      submitScore: (sub: { encryptedScore: string; score: number }) => void calls.push(`submitScore ${sub.score} ${sub.encryptedScore.length > 20}`),
    },
    data: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  };
  (globalThis as unknown as { CrazyGames: unknown }).CrazyGames = { SDK: sdk };
  return { calls, data };
}

/** A fresh copy of the wrapper (it remembers whether the SDK has started). */
async function wrapper() {
  vi.resetModules();
  return import('./crazyGames');
}

describe('the CrazyGames wrapper', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { CrazyGames?: unknown }).CrazyGames;
  });
  afterEach(() => {
    delete (globalThis as unknown as { CrazyGames?: unknown }).CrazyGames;
  });

  it('reports gameplay start and stop to CrazyGames only when it changes', async () => {
    const { calls } = fakeSdk('crazygames');
    const cg = await wrapper();
    await cg.initCrazyGames();
    cg.setGameplayActive(true);
    cg.setGameplayActive(true);
    cg.setGameplayActive(false);
    cg.setGameplayActive(false);
    cg.setGameplayActive(true);
    expect(calls).toEqual(['gameplayStart', 'gameplayStop', 'gameplayStart']);
  });

  it('makes no SDK calls on other sites, or when the SDK never loaded', async () => {
    const { calls } = fakeSdk('disabled');
    const cg = await wrapper();
    expect(await cg.initCrazyGames()).toBe(false);
    cg.setGameplayActive(true);
    cg.loadingStart();
    expect(calls).toEqual([]);
    delete (globalThis as unknown as { CrazyGames?: unknown }).CrazyGames;
    const none = await wrapper();
    expect(await none.initCrazyGames()).toBe(false);
    expect(await none.showRewardedAd(() => {}, () => {})).toBe('unavailable');
  });

  it("follows CrazyGames' mute setting", async () => {
    const { calls } = fakeSdk('crazygames');
    const cg = await wrapper();
    const muted: boolean[] = [];
    await cg.followMuteSetting((m) => muted.push(m));
    expect(muted).toEqual([true]);
    expect(calls).toContain('listen');
  });

  it('a rewarded ad is only a reward when watched; ad blockers and Basic Launch mean ads are off', async () => {
    fakeSdk('crazygames');
    expect(await (await wrapper()).showRewardedAd(() => {}, () => {})).toBe('watched');
    fakeSdk('crazygames', 'unfilled');
    expect(await (await wrapper()).showRewardedAd(() => {}, () => {})).toBe('failed');
    fakeSdk('crazygames', 'adblock');
    expect(await (await wrapper()).showRewardedAd(() => {}, () => {})).toBe('unavailable');
    fakeSdk('crazygames', 'adsDisabledBasicLaunch');
    expect(await (await wrapper()).showRewardedAd(() => {}, () => {})).toBe('unavailable');
  });

  it('a midgame ad resolves true only when one played; skipped or unavailable ones just carry on', async () => {
    fakeSdk('crazygames');
    expect(await (await wrapper()).showMidgameAd(() => {}, () => {})).toBe(true);
    fakeSdk('crazygames', 'adCooldown');
    expect(await (await wrapper()).showMidgameAd(() => {}, () => {})).toBe(false);
    fakeSdk('crazygames', 'adblock');
    expect(await (await wrapper()).showMidgameAd(() => {}, () => {})).toBe(false);
  });

  it('celebrates on the CrazyGames site (happytime) only where the SDK is live', async () => {
    const live = fakeSdk('crazygames');
    const cg = await wrapper();
    await cg.initCrazyGames();
    cg.happytime();
    expect(live.calls).toContain('happytime');
    const off = fakeSdk('disabled');
    const other = await wrapper();
    await other.initCrazyGames();
    other.happytime();
    expect(off.calls).not.toContain('happytime');
  });

  it('encrypts a score so that it decrypts back with the same key (AES-GCM, IV in front)', async () => {
    const cg = await wrapper();
    const keyB64 = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i * 7)));
    const packed = Uint8Array.from(atob(await cg.encryptScore(48250, keyB64)), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0)), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(0, 12) }, key, packed.slice(12));
    expect(new TextDecoder().decode(plain)).toBe('48250');
  });

  it('sends a score to the leaderboard only with a key and only where the SDK is live', async () => {
    const keyB64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
    const live = fakeSdk('crazygames');
    const cg = await wrapper();
    await cg.submitLeaderboardScore(48250.4, keyB64);
    await cg.submitLeaderboardScore(1000, undefined);
    expect(live.calls.filter((c) => c.startsWith('submitScore'))).toEqual(['submitScore 48250 true']);
    const off = fakeSdk('disabled');
    await (await wrapper()).submitLeaderboardScore(5, keyB64);
    expect(off.calls).toEqual([]);
  });

  it('detects an ad blocker', async () => {
    fakeSdk('crazygames', 'adblock');
    expect(await (await wrapper()).hasAdblock()).toBe(true);
    fakeSdk('crazygames');
    expect(await (await wrapper()).hasAdblock()).toBe(false);
  });

  it("keeps progress in CrazyGames' data module on CrazyGames (so it follows the account), nowhere else", async () => {
    const { data } = fakeSdk('crazygames');
    const cg = await wrapper();
    await cg.initCrazyGames();
    cg.progressStore()!.setItem('neon_strike_lifetime_v1', '{"perfects":3}');
    expect(data.get('neon_strike_lifetime_v1')).toBe('{"perfects":3}');
    expect(cg.progressStore()!.getItem('neon_strike_lifetime_v1')).toBe('{"perfects":3}');

    const local = fakeSdk('local');
    const dev = await wrapper();
    await dev.initCrazyGames();
    // In Node there's no localStorage: nothing is saved, and nothing goes to the data module either
    expect(dev.progressStore()).toBeUndefined();
    expect(local.data.size).toBe(0);
  });
});
