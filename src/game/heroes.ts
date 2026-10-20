import { AttackMove, SkeletonPose } from '../types/game';
import { getSavedHeroPoses } from './heroPoseLibrary';
import { HeroPoseLibrary, heroWithEdits } from './heroPoses';
import { ATTACK_MOVES, IDLE_POSE } from './animations';
import { BABA_YAGA_IDLE, BABA_YAGA_MOVES } from './heroMoves/babaYaga';
import { DISCO_KING_IDLE, DISCO_KING_MOVES } from './heroMoves/discoKing';
import { DRUNKEN_MASTER_IDLE, DRUNKEN_MASTER_MOVES } from './heroMoves/drunkenMaster';
import { LITTLE_DRAGON_IDLE, LITTLE_DRAGON_MOVES } from './heroMoves/littleDragon';
import { PRIMA_BALLERINA_IDLE, PRIMA_BALLERINA_MOVES } from './heroMoves/primaBallerina';
import { PRO_WRESTLER_IDLE, PRO_WRESTLER_MOVES } from './heroMoves/proWrestler';
import { SPARTAN_IDLE, SPARTAN_MOVES } from './heroMoves/spartan';
import { STALLION_IDLE, STALLION_MOVES } from './heroMoves/stallion';
import { SAW_FACE_IDLE, SAW_FACE_MOVES } from './heroMoves/sawFace';
import { BRIDE_IDLE, BRIDE_MOVES } from './heroMoves/theBride';
import { THE_KID_IDLE, THE_KID_MOVES } from './heroMoves/theKid';
import { THE_ONE_IDLE, THE_ONE_MOVES } from './heroMoves/theOne';

/**
 * The heroes you can play. Each has its own fighting stance, its own set of
 * attacks (unlocked in tiers as your combo grows, see getMoveForCombo) and its
 * own outfit (drawn by components/fighterArt.ts). The combo glow, lightning
 * and angel wings are shared by every hero, so levelling up always looks the same.
 */

export type HeroId = 'striker' | 'dragon' | 'babaYaga' | 'theOne' | 'drunkenMaster' | 'proWrestler' | 'ballerina' | 'stallion' | 'kid' | 'spartan' | 'discoKing' | 'bride' | 'sawFace';

export interface HeroDefinition {
  id: HeroId;
  /** Shown in the options menu */
  label: string;
  /** One short line under the hero on their card and unlock popup (a joke or a promise, never a film quote) */
  tagline: string;
  description: string;
  /** Fighting stance between attacks (facing right) */
  idlePose: SkeletonPose;
  moves: AttackMove[];
}

export const HEROES: HeroDefinition[] = [
  {
    id: 'striker',
    label: 'Neon Striker',
    tagline: 'The original, still unbeaten',
    description: 'The original cyber fighter: blades, flips and a flowing scarf',
    idlePose: IDLE_POSE,
    moves: ATTACK_MOVES,
  },
  {
    id: 'dragon',
    label: 'The Little Dragon',
    tagline: 'Small dragon, lightning feet',
    description: 'Lightning kung fu: one-inch punches, flying kicks and nunchaku',
    idlePose: LITTLE_DRAGON_IDLE,
    moves: LITTLE_DRAGON_MOVES,
  },
  {
    id: 'babaYaga',
    label: 'Baba Yaga',
    tagline: 'Never, ever touch his dog',
    description: 'Gun-fu assassin: point-blank shots, judo throws and a shotgun',
    idlePose: BABA_YAGA_IDLE,
    moves: BABA_YAGA_MOVES,
  },
  {
    id: 'theOne',
    label: 'The One',
    tagline: 'Dodges bullets. Literally.',
    description: 'Bullet-time kung fu: impossible dodges, and he floats while he kicks',
    idlePose: THE_ONE_IDLE,
    moves: THE_ONE_MOVES,
  },
  {
    id: 'drunkenMaster',
    label: 'Drunken Master',
    tagline: 'One more for the road',
    description: 'Drunken boxing: he staggers, stumbles and swigs, and every wild swing lands',
    idlePose: DRUNKEN_MASTER_IDLE,
    moves: DRUNKEN_MASTER_MOVES,
  },
  {
    id: 'proWrestler',
    label: 'The Pro Wrestler',
    tagline: 'Never without his chair',
    description: 'Championship wrestling: chops, a steel chair and earth-shaking slams',
    idlePose: PRO_WRESTLER_IDLE,
    moves: PRO_WRESTLER_MOVES,
  },
  {
    id: 'ballerina',
    label: 'The White Swan',
    tagline: 'Grace that breaks bones',
    description: 'Ballet as a weapon: kicks to the ceiling, and a swan tutu for her finishers',
    idlePose: PRIMA_BALLERINA_IDLE,
    moves: PRIMA_BALLERINA_MOVES,
  },
  {
    id: 'stallion',
    label: 'The Stallion',
    tagline: 'Hits like a side of beef',
    description: 'Heavyweight boxing: jabs, hooks, body shots and a haymaker that ends it',
    idlePose: STALLION_IDLE,
    moves: STALLION_MOVES,
  },
  {
    id: 'kid',
    label: 'The Kid',
    tagline: 'Every chore was training',
    description: 'Karate: crisp punches and kicks, chores that turn into blocks, and the crane kick',
    idlePose: THE_KID_IDLE,
    moves: THE_KID_MOVES,
  },
  {
    id: 'spartan',
    label: 'The Spartan',
    tagline: 'Shield up, spear ready',
    description: 'Shield and spear: thrusts over the shield, shield bashes, and the kick into the pit',
    idlePose: SPARTAN_IDLE,
    moves: SPARTAN_MOVES,
  },
  {
    id: 'discoKing',
    label: 'The Disco King',
    tagline: 'Fights like he dances',
    description: 'Fights like he dances: the point to the sky, hip-swing kicks, spins and knee slides',
    idlePose: DISCO_KING_IDLE,
    moves: DISCO_KING_MOVES,
  },
  {
    id: 'bride',
    label: 'The Bride',
    tagline: 'The Bride deserves her revenge',
    description: 'A katana and a list: quick draws, clean cuts and thrusts, and a whirlwind finisher',
    idlePose: BRIDE_IDLE,
    moves: BRIDE_MOVES,
  },
  {
    id: 'sawFace',
    label: 'Saw Face',
    tagline: 'Hear that engine? Run.',
    description: 'A roaring chainsaw and a stitched mask: thrusts, chops, lumbering spins, and the chainsaw dance',
    idlePose: SAW_FACE_IDLE,
    moves: SAW_FACE_MOVES,
  },
];

export const DEFAULT_HERO: HeroId = 'striker';

let editsSeen: HeroPoseLibrary | null = null;
const edited = new Map<HeroId, HeroDefinition>();

/**
 * The hero with this id, or the default one if it's unknown (old or
 * hand-edited settings), with any poses saved from the Pose Studio applied.
 */
export function getHero(id: string | undefined): HeroDefinition {
  const base = HEROES.find((h) => h.id === id) ?? HEROES[0];
  const lib = getSavedHeroPoses();
  if (lib !== editsSeen) {
    editsSeen = lib;
    edited.clear();
  }
  let hero = edited.get(base.id);
  if (!hero) {
    hero = heroWithEdits(base, lib);
    edited.set(base.id, hero);
  }
  return hero;
}
