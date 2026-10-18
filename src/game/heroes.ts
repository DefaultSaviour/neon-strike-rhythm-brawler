import { AttackMove, SkeletonPose } from '../types/game';
import { ATTACK_MOVES, IDLE_POSE } from './animations';
import { BABA_YAGA_IDLE, BABA_YAGA_MOVES } from './heroMoves/babaYaga';
import { LITTLE_DRAGON_IDLE, LITTLE_DRAGON_MOVES } from './heroMoves/littleDragon';

/**
 * The heroes you can play. Each has its own fighting stance, its own set of
 * attacks (unlocked in tiers as your combo grows, see getMoveForCombo) and its
 * own outfit (drawn by components/fighterArt.ts). The combo glow, lightning
 * and angel wings are shared by every hero, so levelling up always looks the same.
 */

export type HeroId = 'striker' | 'dragon' | 'babaYaga';

export interface HeroDefinition {
  id: HeroId;
  /** Shown in the options menu */
  label: string;
  description: string;
  /** Fighting stance between attacks (facing right) */
  idlePose: SkeletonPose;
  moves: AttackMove[];
}

export const HEROES: HeroDefinition[] = [
  {
    id: 'striker',
    label: 'Neon Striker',
    description: 'The original cyber fighter: blades, flips and a flowing scarf',
    idlePose: IDLE_POSE,
    moves: ATTACK_MOVES,
  },
  {
    id: 'dragon',
    label: 'The Little Dragon',
    description: 'Lightning kung fu: one-inch punches, flying kicks and nunchaku',
    idlePose: LITTLE_DRAGON_IDLE,
    moves: LITTLE_DRAGON_MOVES,
  },
  {
    id: 'babaYaga',
    label: 'Baba Yaga',
    description: 'Gun-fu assassin: point-blank shots, judo throws and a shotgun',
    idlePose: BABA_YAGA_IDLE,
    moves: BABA_YAGA_MOVES,
  },
];

export const DEFAULT_HERO: HeroId = 'striker';

/** The hero with this id, or the default one if it's unknown (old or hand-edited settings). */
export function getHero(id: string | undefined): HeroDefinition {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}
