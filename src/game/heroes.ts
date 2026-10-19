import { AttackMove, SkeletonPose } from '../types/game';
import { ATTACK_MOVES, IDLE_POSE } from './animations';
import { BABA_YAGA_IDLE, BABA_YAGA_MOVES } from './heroMoves/babaYaga';
import { DRUNKEN_MASTER_IDLE, DRUNKEN_MASTER_MOVES } from './heroMoves/drunkenMaster';
import { LITTLE_DRAGON_IDLE, LITTLE_DRAGON_MOVES } from './heroMoves/littleDragon';
import { PRIMA_BALLERINA_IDLE, PRIMA_BALLERINA_MOVES } from './heroMoves/primaBallerina';
import { PRO_WRESTLER_IDLE, PRO_WRESTLER_MOVES } from './heroMoves/proWrestler';
import { STALLION_IDLE, STALLION_MOVES } from './heroMoves/stallion';
import { THE_ONE_IDLE, THE_ONE_MOVES } from './heroMoves/theOne';

/**
 * The heroes you can play. Each has its own fighting stance, its own set of
 * attacks (unlocked in tiers as your combo grows, see getMoveForCombo) and its
 * own outfit (drawn by components/fighterArt.ts). The combo glow, lightning
 * and angel wings are shared by every hero, so levelling up always looks the same.
 */

export type HeroId = 'striker' | 'dragon' | 'babaYaga' | 'theOne' | 'drunkenMaster' | 'proWrestler' | 'ballerina' | 'stallion';

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
  {
    id: 'theOne',
    label: 'The One',
    description: 'Bullet-time kung fu: impossible dodges, and he floats while he kicks',
    idlePose: THE_ONE_IDLE,
    moves: THE_ONE_MOVES,
  },
  {
    id: 'drunkenMaster',
    label: 'Drunken Master',
    description: 'Drunken boxing: he staggers, stumbles and swigs, and every wild swing lands',
    idlePose: DRUNKEN_MASTER_IDLE,
    moves: DRUNKEN_MASTER_MOVES,
  },
  {
    id: 'proWrestler',
    label: 'The Pro Wrestler',
    description: 'Championship wrestling: chops, a steel chair and earth-shaking slams',
    idlePose: PRO_WRESTLER_IDLE,
    moves: PRO_WRESTLER_MOVES,
  },
  {
    id: 'ballerina',
    label: 'The White Swan',
    description: 'Ballet as a weapon: kicks to the ceiling, and a swan tutu for her finishers',
    idlePose: PRIMA_BALLERINA_IDLE,
    moves: PRIMA_BALLERINA_MOVES,
  },
  {
    id: 'stallion',
    label: 'The Stallion',
    description: 'Heavyweight boxing: jabs, hooks, body shots and a haymaker that ends it',
    idlePose: STALLION_IDLE,
    moves: STALLION_MOVES,
  },
];

export const DEFAULT_HERO: HeroId = 'striker';

/** The hero with this id, or the default one if it's unknown (old or hand-edited settings). */
export function getHero(id: string | undefined): HeroDefinition {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}
