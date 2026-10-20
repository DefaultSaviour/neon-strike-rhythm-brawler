import { BACKDROP_ITEMS, BACKDROP_LAYERS, BACKDROP_UNLOCK_PATH, backdropsEarned, nextBackdrop } from './backdrops';
import { ENEMY_MOTION_STYLES } from './enemyMotion';
import { getHero, HEROES, HeroId } from './heroes';
import { HERO_UNLOCKS, isHeroUnlocked, LifetimeStats, newlyUnlocked, UNLOCK_ORDER } from './heroUnlocks';
import { nextStance, STANCE_UNLOCK_ORDER, stancesEarned } from './stanceUnlocks';
import type { UnlockKind } from './seenUnlocks';

/**
 * Everything one song unlocked (heroes, enemy stances, backdrop pieces),
 * for the unlock popup after the song, and the one thing a rewarded ad
 * could unlock next (the popup's last card offers it).
 */

export interface RunUnlock {
  kind: UnlockKind;
  id: string;
}

/** What unlocked between two sets of totals: heroes first (in path order), then stances, then backdrop pieces. */
export function unlocksBetween(before: LifetimeStats, after: LifetimeStats): RunUnlock[] {
  const heroIds = UNLOCK_ORDER.filter((id) => HEROES.some((h) => h.id === id));
  const heroes = newlyUnlocked(heroIds, before, after).map((id) => ({ kind: 'hero' as const, id }));
  const stances = STANCE_UNLOCK_ORDER.slice(stancesEarned(before), stancesEarned(after)).map((id) => ({ kind: 'stance' as const, id }));
  const backdrops = BACKDROP_UNLOCK_PATH.slice(backdropsEarned(before), backdropsEarned(after)).map((id) => ({ kind: 'backdrop' as const, id }));
  return [...heroes, ...stances, ...backdrops];
}

/**
 * The next thing a rewarded ad would unlock, or null when there's nothing
 * left. The ad hero (The Bride) comes first while she's locked, as the
 * biggest prize; then the next enemy stance; then the next backdrop piece.
 * Every one of these can also be earned by playing (CrazyGames requires it).
 */
export function adOffer(stats: LifetimeStats): RunUnlock | null {
  const hero = UNLOCK_ORDER.find((id) => HERO_UNLOCKS[id]?.ad && !isHeroUnlocked(id, stats));
  if (hero) return { kind: 'hero', id: hero };
  const stance = nextStance(stats);
  if (stance) return { kind: 'stance', id: stance };
  const piece = nextBackdrop(stats);
  if (piece) return { kind: 'backdrop', id: piece.id };
  return null;
}

/** The backdrop layer a piece belongs to (for equipping it). */
export function backdropLayerOf(id: string) {
  return BACKDROP_ITEMS.find((b) => b.id === id)?.layer ?? null;
}

/** What to call an unlock in the popup: the kind ("New hero"), its name and what it is. */
export function describeUnlock(u: RunUnlock): { kind: string; name: string; description: string } {
  if (u.kind === 'hero') {
    const hero = getHero(u.id as HeroId);
    return { kind: 'New hero', name: hero.label, description: hero.description };
  }
  if (u.kind === 'stance') {
    const stance = ENEMY_MOTION_STYLES.find((m) => m.id === u.id);
    return { kind: 'New enemy stance', name: stance?.label ?? u.id, description: stance?.description ?? '' };
  }
  const piece = BACKDROP_ITEMS.find((b) => b.id === u.id);
  const layer = BACKDROP_LAYERS.find((l) => l.layer === piece?.layer)?.label ?? 'Backdrop';
  return { kind: `New backdrop: ${layer.toLowerCase()}`, name: piece?.label ?? u.id, description: piece?.description ?? '' };
}
