/**
 * Game types and state definitions for Neon Strike: Rhythm Brawler
 */

export type Lane = 'left' | 'right';

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
}

export interface BeatNote {
  time: number;
  lane: Lane;
  enemyType: 'brawler' | 'speeder' | 'ronin';
  pitchCategory?: 'bass' | 'treble' | 'kick' | 'snare' | 'lead';
  band?: FrequencyBand;
  tier?: EnemyTier;
  color?: string;
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

export interface DebrisPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  color: string;
  shapeType: 'head' | 'chest' | 'arm' | 'leg' | 'blade' | 'shard';
  size: number;
  points?: Array<{ x: number; y: number }>;
  landed: boolean;
  fallingInPit: boolean;
  alpha: number;
  life: number;
  maxLife: number;
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
  trailHistory: Array<{ x: number; y: number; alpha: number }>;
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
  sparkType?: 'line' | 'dot' | 'ring' | 'ember';
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
  bladeSlash?: {
    start: Point2D;
    end: Point2D;
    curveOffset: number;
    color: string;
  };
}

export interface AttackMove {
  id: number;
  name: string;
  description: string;
  durationMs: number;
  pose: SkeletonPose;
  impactOffset?: Point2D;
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
}
