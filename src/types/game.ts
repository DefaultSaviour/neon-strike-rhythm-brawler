/**
 * Game types and state definitions for Neon Strike: Rhythm Brawler
 */

import type { EnemyMotionStyle, EnemyPose } from '../game/enemyMotion';
import type { HeroId } from '../game/heroes';

export type Lane = 'left' | 'right';

/** What plays when you hit an enemy */
export type HitSoundMode = 'both' | 'tone' | 'surge' | 'off';

/** Acoustic frequency band a beat was detected in */
export type FrequencyBand = 'sub' | 'bass' | 'high';

/** 1 = lowest end of the band's Hz range, 3 = highest end */
export type EnemyTier = 1 | 2 | 3;

export type TimingJudgementType = 'PERFECT' | 'GOOD' | 'OK' | 'MISS';

export interface FloatingJudgement {
  id: number;
  text: TimingJudgementType;
  x: number;
  y: number;
  color: string;
  createdAt: number;
  scale: number;
  lane: Lane;
  /** For non-PERFECT hits: whether the press was early or late (helps players adjust) */
  detail?: 'EARLY' | 'LATE';
}

export interface BeatNote {
  time: number;
  lane: Lane;
  enemyType: 'brawler' | 'speeder' | 'ronin';
  pitchCategory?: 'bass' | 'treble' | 'kick' | 'snare' | 'lead';
  band?: FrequencyBand;
  tier?: EnemyTier;
  color?: string;
  /** Strongest frequency (Hz) in the note's band at the hit, used to tune the hit tone */
  pitchHz?: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Custom';
  duration: number;
  description: string;
  notes: BeatNote[];
  isCustom?: boolean;
  audioBuffer?: AudioBuffer;
  audioUrl?: string;
}

export interface Enemy {
  id: string;
  lane: Lane;
  targetTime: number;
  spawnTime: number;
  speed: number;
  x: number;
  y: number;
  color: string;
  enemyType: 'brawler' | 'speeder' | 'ronin';
  pitchCategory?: 'bass' | 'treble' | 'kick' | 'snare' | 'lead';
  band: FrequencyBand;
  tier: EnemyTier;
  defeated: boolean;
  deathTime?: number;
  animPhase: number;
  /** Beats added to the motion cycle so neighbouring enemies lead with opposite feet */
  stepOffset?: number;
  /** Pitch (Hz) of the musical note this enemy was charted from */
  pitchHz?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  sparkType?: 'line' | 'dot' | 'ring' | 'ember' | 'flash';
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SkeletonPose {
  head: Point2D;
  chest: Point2D;
  pelvis: Point2D;
  leftShoulder: Point2D;
  leftElbow: Point2D;
  leftHand: Point2D;
  rightShoulder: Point2D;
  rightElbow: Point2D;
  rightHand: Point2D;
  leftHip: Point2D;
  leftKnee: Point2D;
  leftFoot: Point2D;
  rightHip: Point2D;
  rightKnee: Point2D;
  rightFoot: Point2D;
  scarf?: Point2D[];
  /** A weapon held in the lead hand during this pose (drawn by fighterArt) */
  prop?: 'nunchaku' | 'pistol' | 'pistols' | 'shotgun' | 'pencil' | 'gourd' | 'gourdSwing' | 'bench' | 'chair' | 'ropeOver' | 'ropeUnder' | 'meat';
  /** The gun in this hand fires in this pose (muzzle flash; the trail is the bullet streak) */
  shot?: 'lead' | 'rear';
  /** Turning fast in this pose (a pirouette): draws a spin blur round the body */
  spin?: boolean;
  bladeSlash?: {
    start: Point2D;
    end: Point2D;
    curveOffset: number;
    color: string;
  };
}

/** One keyframe of a multi-hit move (see AttackMove.sequence). */
export interface MoveKey {
  /** The body at this keyframe, facing right (enemy-style skeleton) */
  pose: EnemyPose;
  /** Trail swept by the striking limb on the way into this keyframe */
  trail?: SkeletonPose['bladeSlash'];
  /** Milliseconds to reach this keyframe from the previous one (ignored for the first) */
  ms: number;
  /** Weapon in the lead hand at this keyframe */
  prop?: SkeletonPose['prop'];
  /** The gun in this hand fires on the way into this keyframe (needs a trail: it's the bullet streak) */
  shot?: SkeletonPose['shot'];
  /** Turning fast on the way into this keyframe (a pirouette) */
  spin?: boolean;
  /** A hold: the previous pose kept still, with its hit effect (trail, flash) still showing */
  hold?: boolean;
}

export interface AttackMove {
  id: number;
  name: string;
  description: string;
  durationMs: number;
  /** The impact pose (the first hit), facing right */
  pose: SkeletonPose;
  /**
   * Optional combo: keyframes played after the first hit lands (wind-down,
   * follow-up hits, landing). The first keyframe is the impact pose.
   */
  sequence?: MoveKey[];
  impactOffset?: Point2D;
  /** A slam: shakes the screen harder and gets a crowd-pop flash at the screen edges */
  slam?: boolean;
  /** While this move's tier is up, the hero holds this pose between attacks instead of their stance */
  restPose?: SkeletonPose;
  tier: 1 | 2 | 3 | 4 | 5; // 1: Basic, 2: Advanced Acrobatic, 3: Superhuman Cyber, 4: Overdrive Master, 5: God-Tier Finisher
}

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'CLEARED' | 'GAME_OVER';

export interface GameScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  goodCount: number;
  okCount: number;
  missCount: number;
  totalNotes: number;
}

export interface HighScoreRecord {
  trackId: string;
  highScore: number;
  maxCombo: number;
  accuracy: number;
  grade: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  cleared: boolean;
  timestamp: number;
}

export interface AudioSettings {
  volume: number;
  sfxVolume: number;
  latencyOffsetMs: number;
  scanlines: boolean;
  screenShake: 'none' | 'subtle' | 'normal';
  oneButtonMode: boolean;
  /** How enemies move while riding the conveyor */
  enemyMotion: EnemyMotionStyle;
  /** Which hero you play (see game/heroes.ts) */
  hero: HeroId;
  /** Hit feedback sound */
  hitSound: HitSoundMode;
}
