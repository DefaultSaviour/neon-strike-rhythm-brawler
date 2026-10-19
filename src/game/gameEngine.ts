import {
  Track,
  Enemy,
  Lane,
  TimingJudgementType,
  FloatingJudgement,
  Particle,
  GameScoreState,
  HighScoreRecord,
  SkeletonPose,
  MoveKey,
  AudioSettings,
} from '../types/game';
import { IDLE_POSE, getOrientedPose, getMoveForCombo } from './animations';
import { DEFAULT_HERO, getHero, HeroDefinition, HeroId, HEROES } from './heroes';
import { addRun, isHeroUnlocked, LifetimeStats, loadStats, newlyUnlocked, saveStats } from './heroUnlocks';
import { audioEngine } from '../audio/audioEngine';
import { getEnemyStyle, resolveBandTier } from './enemyStyles';
import { BREACH_LATE_SEC, DeathReport, explainDeath, judgeOffset, pickTarget, PressRecord, suggestLatencyOffsetMs } from './timing';
import { DEBRIS_GRAVITY, DebrisPiece, DebrisWorld, shatterEnemy, stepDebris, trimDebris } from './debrisPhysics';
import { BeatGrid, beatPosition, beatPulse, gridForNotes } from '../audio/beatGrid';
import { songTimeAtEvent } from '../audio/songClock';
import { idleBouncePose, strikeFrame } from './motion';
import { comboDuration, comboFrame } from './combo';
import { FLOOR_Y } from './layout';
import { comboBlastPower, extraShardsForCombo, MAX_DEBRIS, MAX_PARTICLES } from './comboFx';
import { recordRunProgress, RunProgress } from './runProgress';
import { DEFAULT_ENEMY_MOTION, ENEMY_MOTION_STYLES } from './enemyMotion';
import { enemyPoseFor } from './customAnimation';
import { getActiveAnimations } from './animationLibrary';

export interface GameEngineCallbacks {
  onScoreUpdate: (score: GameScoreState) => void;
  /** `death` explains what went wrong when the run ended because an enemy got through. */
  onGameOver: (score: GameScoreState, cleared: boolean, death?: DeathReport) => void;
  onJudgement: (judgement: TimingJudgementType, combo: number) => void;
}

/** How far the fighter lunges toward the enemy on a strike (world units) */
const LUNGE_DISTANCE = 16;
/** How much harder a slam shakes the screen than an ordinary hit. */
export const SLAM_SHAKE = 1.8;
/** How long the crowd-pop flash at the screen edges lasts after a slam (seconds). */
export const CROWD_POP_SEC = 0.3;

/** Freeze-frame length on impact, by judgement (seconds). Sells the weight of a hit. */
const HIT_STOP: Record<TimingJudgementType, number> = { PERFECT: 0.06, GOOD: 0.04, OK: 0.025, MISS: 0 };

export class GameEngine {
  public track: Track | null = null;
  public enemies: Enemy[] = [];
  public particles: Particle[] = [];
  public debris: DebrisPiece[] = [];
  /** Half the visible screen width in world units, from the latest update() */
  private worldHalfWidth = 400;
  public judgements: FloatingJudgement[] = [];
  public currentPose: SkeletonPose = { ...IDLE_POSE };
  public isAttacking: boolean = false;
  /** True during the fast "blow landing" part of a strike (for slash trails) */
  public strikeActive: boolean = false;
  public attackDirection: Lane = 'right';
  public currentMoveIndex: number = 0;
  public lastAttackPose: SkeletonPose = { ...IDLE_POSE };
  /** Fighter's body offset from centre while lunging (world units) */
  public playerOffsetX: number = 0;

  public screenShake: number = 0;
  /** 1 right after a slam lands, fading to 0: the crowd-pop flash at the screen edges */
  public crowdPop: number = 0;
  /** Brief camera nudge toward the side that was hit, plus a tiny zoom punch */
  public cameraKick = { x: 0, zoom: 0 };
  public hitLineOffset: number = 78; // Strike distance from center (world units)
  public pitRadius: number = 44; // Central abyss pit half-width
  public conveyorSpeed: number = 220; // Pixels per second moving inward towards the pit

  /**
   * Conveyor surface speed (world units/s), scaled with the song's tempo.
   * Fast enough that debris reaches the pit quickly (less clutter), slow
   * enough that you can watch it ride there. The floor arrows use it too.
   */
  public beltSpeed(): number {
    return this.conveyorSpeed * (this.beatGrid.bpm / 120);
  }

  /** Song time (s) the player is hearing, with the latency setting applied. Updated every frame. */
  public songTime: number = 0;
  /** Exact tempo and beat positions, so visuals can pulse on the beat */
  public beatGrid: BeatGrid = { bpm: 120, offset: 0, strength: 0 };
  /** Seconds an enemy takes to walk from the screen edge to the strike line */
  public approachDuration: number = 1.35;
  /** Press-minus-beat timing error (s) of every successful hit this song */
  public hitOffsets: number[] = [];
  /** The player's last few presses, used to explain a death */
  private recentPresses: PressRecord[] = [];
  /** How far the last finished run got (for the results screen's progress bar) */
  public lastRun: RunProgress | null = null;

  public scoreState: GameScoreState = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    okCount: 0,
    missCount: 0,
    totalNotes: 0,
  };

  public settings: AudioSettings = {
    volume: 0.8,
    sfxVolume: 0.9,
    latencyOffsetMs: 0,
    scanlines: true,
    screenShake: 'subtle',
    oneButtonMode: false,
    enemyMotion: DEFAULT_ENEMY_MOTION,
    hero: DEFAULT_HERO,
    hitSound: 'both',
  };

  /** True while the song is paused (audio clock frozen, nothing moves) */
  public paused: boolean = false;

  private callbacks: GameEngineCallbacks;
  private isRunning: boolean = false;
  private nextJudgementId: number = 1;
  private nextDebrisId: number = 1;
  private songSession: number = 0;

  // Animation clock: like real time, but it stops during hit-stop freeze frames.
  private animClock: number = 0;
  private hitStopRemaining: number = 0;
  private strikeStart: number = 0;
  private strikeDuration: number = 0.2;
  private strikeFromPose: SkeletonPose = { ...IDLE_POSE };
  private strikeLunge: number = 0;
  /** Keyframes of the combo being played, or null for a single-pose strike */
  private strikeKeys: MoveKey[] | null = null;

  constructor(callbacks: GameEngineCallbacks) {
    this.callbacks = callbacks;
    this.lifetimeStats = loadStats(safeStorage());
    // Dev builds only: open the game with ?unlockAll to try every hero. Not saved, and
    // stripped from the published build (import.meta.env.DEV is false there).
    if (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('unlockAll')) {
      this.lifetimeStats = { enemiesDefeated: 1e9, perfects: 1e9, bestCombo: 1e9, songsCleared: 1e9 };
      this.devUnlockAll = true;
    }
    this.loadSettings();
  }

  /** The player's totals over every song, which unlock the heroes (see heroUnlocks). */
  public lifetimeStats: LifetimeStats;
  /** Heroes the last song unlocked, for the results screen to announce */
  public newUnlocks: HeroId[] = [];
  /** This song's results have already been added to the lifetime totals */
  private runCounted = false;
  /** Dev ?unlockAll mode: every hero open, and real progress never saved over */
  private devUnlockAll = false;

  /** The hero being played (from the settings). A hero not yet earned plays as the default one. */
  public get hero(): HeroDefinition {
    return getHero(this.isHeroUnlocked(this.settings.hero) ? this.settings.hero : DEFAULT_HERO);
  }

  public isHeroUnlocked(id: HeroId): boolean {
    return isHeroUnlocked(id, this.lifetimeStats);
  }

  /**
   * Add this song to the lifetime totals, once, however it ended (cleared,
   * died, or quit part way: the enemies you beat still count), and note any
   * heroes it unlocked.
   */
  private countRun(cleared: boolean) {
    if (!this.track || this.runCounted) return;
    this.runCounted = true;
    const s = this.scoreState;
    const before = this.lifetimeStats;
    this.lifetimeStats = addRun(before, {
      enemiesDefeated: s.perfectCount + s.goodCount + s.okCount,
      perfects: s.perfectCount,
      maxCombo: s.maxCombo,
      cleared,
    });
    this.newUnlocks = newlyUnlocked(
      HEROES.map((h) => h.id),
      before,
      this.lifetimeStats
    );
    if (!this.devUnlockAll) saveStats(safeStorage(), this.lifetimeStats);
  }

  public loadSettings() {
    try {
      const saved = localStorage.getItem('neon_strike_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
        // Settings saved by older versions (or edited by hand) may hold values we no longer know.
        if (!ENEMY_MOTION_STYLES.some((m) => m.id === this.settings.enemyMotion)) {
          this.settings.enemyMotion = DEFAULT_ENEMY_MOTION;
        }
        if (!HEROES.some((h) => h.id === this.settings.hero)) {
          this.settings.hero = DEFAULT_HERO;
        }
        if (!['both', 'tone', 'surge', 'off'].includes(this.settings.hitSound)) {
          this.settings.hitSound = 'both';
        }
        audioEngine.setVolume(this.settings.volume, this.settings.sfxVolume);
      }
    } catch {}
  }

  public saveSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('neon_strike_settings', JSON.stringify(this.settings));
      audioEngine.setVolume(this.settings.volume, this.settings.sfxVolume);
    } catch {}
  }

  public async startSong(track: Track) {
    const session = ++this.songSession;
    this.track = track;
    this.isRunning = false;
    this.enemies = [];
    this.particles = [];
    this.debris = [];
    this.judgements = [];
    this.hitOffsets = [];
    this.recentPresses = [];
    this.lastRun = null;
    this.runCounted = false;
    this.newUnlocks = [];
    this.currentMoveIndex = 0;
    this.isAttacking = false;
    this.strikeActive = false;
    this.playerOffsetX = 0;
    this.currentPose = { ...IDLE_POSE };
    this.screenShake = 0;
    this.crowdPop = 0;
    this.cameraKick = { x: 0, zoom: 0 };
    this.hitStopRemaining = 0;
    this.songTime = 0;
    this.paused = false;
    audioEngine.stop();

    // Bundled tracks are charted from their audio on first play
    await audioEngine.prepareTrack(track);
    if (session !== this.songSession) return;
    this.isRunning = true;

    this.scoreState = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      okCount: 0,
      missCount: 0,
      totalNotes: track.notes.length,
    };
    this.callbacks.onScoreUpdate(this.scoreState);

    // Lock visuals to the music: exact tempo + where the beats fall.
    const grid = gridForNotes(track.notes, track.bpm, 0.01);
    this.beatGrid = grid.strength > 0.15 ? grid : { bpm: track.bpm, offset: 0, strength: 0 };

    const beatSec = 60 / this.beatGrid.bpm;
    this.approachDuration = Math.max(1.1, Math.min(2.2, beatSec * 4)); // Exactly 4 musical beats (1 bar) approach

    this.enemies = track.notes.map((note, index) => {
      const { band, tier } = resolveBandTier(note);
      const color = getEnemyStyle(band, tier).color;

      return {
        id: `enemy_${index}_${note.time}`,
        lane: note.lane,
        targetTime: note.time,
        spawnTime: Math.max(0, note.time - this.approachDuration),
        speed: 1.0,
        x: note.lane === 'left' ? -9999 : 9999,
        y: 0,
        color,
        enemyType: note.enemyType,
        pitchCategory: note.pitchCategory,
        band,
        tier,
        defeated: false,
        animPhase: 0,
        // One beat apart: neighbours lead with opposite feet / arms, still on the beat.
        stepOffset: index % 2,
        pitchHz: note.pitchHz,
      };
    });

    audioEngine.startTrack(track, () => {
      this.finishSong(true);
    });
  }

  public stop() {
    this.songSession++;
    // Quitting part way through still counts the enemies beaten so far.
    if (this.isRunning) this.countRun(false);
    this.isRunning = false;
    this.paused = false;
    audioEngine.stop();
  }

  /** Freeze the song exactly where it is. Nothing is reset. */
  public pause() {
    if (!this.isRunning || this.paused) return;
    this.paused = true;
    audioEngine.pause();
  }

  /** Carry on from where pause() stopped. */
  public resume() {
    if (!this.paused) return;
    this.paused = false;
    audioEngine.resume();
  }

  /** Song time of a press, corrected for event delay and the player's latency setting. */
  private pressTime(eventTimeStamp?: number): number {
    const heard = songTimeAtEvent(audioEngine.getPlaybackTime(), performance.now(), eventTimeStamp);
    return heard - this.settings.latencyOffsetMs / 1000;
  }

  /**
   * Strike toward a lane. `eventTimeStamp` is the key/pointer event's
   * `timeStamp`, so the press is judged when it happened, not when we got to it.
   */
  public handleInput(lane: Lane, eventTimeStamp?: number) {
    if (!this.isRunning || !this.track || this.paused) return;

    if (this.settings.oneButtonMode) {
      this.handleOneButtonInput(eventTimeStamp);
      return;
    }

    const time = this.pressTime(eventTimeStamp);
    const target = pickTarget(this.enemies, time, lane);
    this.recordPress(time, lane, target);
    if (!target) {
      this.triggerMiss(lane);
      return;
    }
    this.hitEnemy(target, time - target.targetTime, lane);
  }

  /** One-button mode: strike whichever lane has the next enemy due. */
  public handleOneButtonInput(eventTimeStamp?: number) {
    if (!this.isRunning || !this.track || this.paused) return;

    const time = this.pressTime(eventTimeStamp);
    const target = pickTarget(this.enemies, time, null);
    this.recordPress(time, target?.lane ?? this.attackDirection ?? 'left', target);
    if (!target) {
      this.triggerMiss(this.attackDirection || 'left');
      return;
    }
    this.hitEnemy(target, time - target.targetTime, target.lane);
  }

  /** Remember a press (and what it hit) for a few seconds, to explain a death. */
  private recordPress(time: number, lane: Lane, target: Enemy | null) {
    this.recentPresses.push({
      time,
      lane,
      hitEnemyName: target ? getEnemyStyle(target.band, target.tier).name : undefined,
    });
    this.recentPresses = this.recentPresses.filter((p) => p.time > time - 3);
  }

  /** Latency offset (ms) suggested from this song's hits, or null if there weren't enough. */
  public getSuggestedLatencyOffsetMs(): number | null {
    return suggestLatencyOffsetMs(this.settings.latencyOffsetMs, this.hitOffsets);
  }

  /** Median press-minus-beat error of this song's hits in ms (positive = late). */
  public getAverageTimingErrorMs(): number | null {
    if (this.hitOffsets.length === 0) return null;
    const sorted = [...this.hitOffsets].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length / 2)] * 1000);
  }

  private hitEnemy(enemy: Enemy, offsetSec: number, lane: Lane) {
    const judgement = judgeOffset(offsetSec);
    enemy.defeated = true;
    enemy.deathTime = performance.now();
    this.hitOffsets.push(offsetSec);

    const multiplier = 1 + Math.floor(this.scoreState.combo / 10) * 0.5;
    let baseScore = 300;
    if (judgement === 'GOOD') baseScore = 180;
    if (judgement === 'OK') baseScore = 80;

    const addedScore = Math.round(baseScore * multiplier);
    this.scoreState.score += addedScore;
    this.scoreState.combo += 1;
    if (this.scoreState.combo > this.scoreState.maxCombo) {
      this.scoreState.maxCombo = this.scoreState.combo;
    }

    if (judgement === 'PERFECT') {
      this.scoreState.perfectCount++;
    } else if (judgement === 'GOOD') {
      this.scoreState.goodCount++;
    } else {
      this.scoreState.okCount++;
    }

    // Impact feel: freeze frame + camera nudge, scaled by the player's shake setting.
    const shakeMode = this.settings.screenShake || 'subtle';
    const shakeAmount = shakeMode === 'none' ? 0 : shakeMode === 'subtle' ? 0.5 : 1;
    this.screenShake = shakeAmount * (judgement === 'PERFECT' ? 2.2 : judgement === 'GOOD' ? 1.2 : 0.5);
    const sideSign = lane === 'left' ? -1 : 1;
    this.cameraKick = {
      x: sideSign * 7 * shakeAmount,
      zoom: (judgement === 'PERFECT' ? 0.045 : 0.025) * shakeAmount,
    };
    this.hitStopRemaining = HIT_STOP[judgement];

    this.callbacks.onScoreUpdate({ ...this.scoreState });
    this.callbacks.onJudgement(judgement, this.scoreState.combo);
    audioEngine.playHitSound(judgement, enemy.band, enemy.pitchHz, this.settings.hitSound);

    // Moves progress from basic martial arts -> acrobatic -> superhuman -> god-tier finishers!
    if (judgement === 'PERFECT' || judgement === 'GOOD') {
      this.currentMoveIndex++;
    }

    const currentMove = getMoveForCombo(this.scoreState.combo, this.currentMoveIndex, this.hero.moves);
    // Slams hit the mat harder: a bigger shake and a pop from the crowd. Both follow
    // the shake setting, so players who turn shake off get no flash either.
    if (currentMove.slam && shakeAmount > 0) {
      this.screenShake *= SLAM_SHAKE;
      this.crowdPop = 1;
    }
    if (currentMove.sequence) {
      this.startStrike(lane, getOrientedPose(currentMove.pose, lane), comboDuration(currentMove.sequence), LUNGE_DISTANCE, currentMove.sequence);
    } else {
      this.startStrike(lane, getOrientedPose(currentMove.pose, lane), currentMove.durationMs / 1000 + 0.06, LUNGE_DISTANCE);
    }

    const targetX = lane === 'left' ? -this.hitLineOffset : this.hitLineOffset;
    // One judgement word per side: the newest replaces the last, so they never stack up.
    this.judgements = this.judgements.filter((j) => j.lane !== lane);
    this.judgements.push({
      id: this.nextJudgementId++,
      text: judgement,
      x: targetX,
      y: -92 - Math.random() * 8,
      color: judgement === 'PERFECT' ? '#00f3ff' : judgement === 'GOOD' ? '#ff007f' : '#ffe600',
      createdAt: performance.now(),
      scale: judgement === 'PERFECT' ? 1.4 : judgement === 'GOOD' ? 1.2 : 1.0,
      lane,
      detail: judgement === 'PERFECT' ? undefined : offsetSec < 0 ? 'EARLY' : 'LATE',
    });

    this.spawnEnemyDebrisExplosion(enemy, judgement);
    this.spawnHitParticles(enemy.x, -22, lane, judgement, enemy.color);

    const remaining = this.enemies.filter((e) => !e.defeated);
    if (remaining.length === 0) {
      setTimeout(() => this.finishSong(true), 600);
    }
  }

  /** Begin a strike animation from wherever the fighter currently is. */
  private startStrike(lane: Lane, pose: SkeletonPose, durationSec: number, lunge: number, keys: MoveKey[] | null = null) {
    this.isAttacking = true;
    this.strikeKeys = keys;
    this.attackDirection = lane;
    this.strikeFromPose = this.currentPose;
    this.lastAttackPose = pose;
    this.strikeStart = this.animClock;
    this.strikeDuration = durationSec;
    this.strikeLunge = (lane === 'left' ? -1 : 1) * lunge;
  }

  // Break the enemy into rigid pieces where its body parts were, then knock them away.
  private spawnEnemyDebrisExplosion(enemy: Enemy, judgement: TimingJudgementType) {
    const style = getEnemyStyle(enemy.band, enemy.tier);
    const combo = this.scoreState.combo;
    const judgementPower = judgement === 'PERFECT' ? 1.35 : judgement === 'GOOD' ? 1.1 : 0.9;
    // The longer the chain, the harder enemies are blown apart (see comboFx.ts).
    const comboPower = comboBlastPower(combo);
    const extraShards = extraShardsForCombo(combo);

    const pieces = shatterEnemy(
      {
        x: enemy.x,
        pose: enemyPoseFor(this.settings.enemyMotion, enemy.animPhase, enemy.band, enemy.tier, getActiveAnimations()),
        facing: enemy.lane === 'left' ? 1 : -1,
        scale: style.scale,
        color: enemy.color,
        accent: style.accent,
        limbScale: style.limbScale,
        hasBlade: enemy.band !== 'sub',
        power: judgementPower * comboPower,
        extraShards,
      },
      () => this.nextDebrisId++
    );
    this.debris.push(...pieces);

    // Too many pieces: drop fading and off-screen ones before the belt riders.
    trimDebris(this.debris, MAX_DEBRIS, this.worldHalfWidth);
  }

  private triggerMiss(lane: Lane) {
    this.scoreState.combo = 0;
    this.scoreState.missCount++;
    this.callbacks.onScoreUpdate({ ...this.scoreState });
    this.callbacks.onJudgement('MISS', 0);
    audioEngine.playSwingSound();

    const targetX = lane === 'left' ? -this.hitLineOffset : this.hitLineOffset;
    this.judgements.push({
      id: this.nextJudgementId++,
      text: 'MISS',
      x: targetX,
      y: -80,
      color: '#ff2a5f',
      createdAt: performance.now(),
      scale: 1.0,
      lane,
    });

    // A whiff: quick jab into empty air with only a small lunge.
    this.startStrike(lane, getOrientedPose(this.hero.moves[0].pose, lane), 0.16, LUNGE_DISTANCE * 0.4);
  }

  private spawnHitParticles(
    x: number,
    y: number,
    lane: Lane,
    judgement: TimingJudgementType,
    color: string
  ) {
    const count = judgement === 'PERFECT' ? 16 : judgement === 'GOOD' ? 10 : 6;
    const away = lane === 'left' ? -1 : 1;
    const blast = comboBlastPower(this.scoreState.combo);

    // Bright flash at the point of impact
    this.particles.push({
      x: x - away * 6,
      y,
      vx: 0,
      vy: 0,
      color: '#ffffff',
      // The impact flash swells with the combo, so big chains feel bigger.
      size: (judgement === 'PERFECT' ? 30 : 22) * (0.8 + blast * 0.3),
      alpha: 1,
      life: 0,
      maxLife: 0.12,
      sparkType: 'flash',
    });

    // Shockwave ring along the floor
    this.particles.push({
      x,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      color,
      size: 10,
      alpha: 1.0,
      life: 0,
      maxLife: 0.35,
      sparkType: 'ring',
    });

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 1.2 + (away < 0 ? Math.PI : 0);
      const speed = (220 + Math.random() * (judgement === 'PERFECT' ? 520 : 340)) * (0.8 + blast * 0.25);

      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        color: Math.random() > 0.4 ? color : '#ffffff',
        size: 2 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.35,
        sparkType: Math.random() > 0.35 ? 'line' : 'dot',
      });
    }
  }

  private spawnFloorSparks(x: number, strength: number, color: string) {
    const count = Math.min(4, Math.floor(strength / 200));
    for (let i = 0; i < count; i++) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      this.particles.push({
        x,
        y: FLOOR_Y - 1,
        vx: dir * (60 + Math.random() * strength * 0.4),
        vy: -(60 + Math.random() * strength * 0.35),
        color: Math.random() > 0.5 ? color : '#ffffff',
        size: 1.5 + Math.random() * 1.5,
        alpha: 1,
        life: 0,
        maxLife: 0.18 + Math.random() * 0.2,
        sparkType: 'line',
      });
    }
  }

  /**
   * Advance the game by `deltaTimeSec`. `worldHalfWidth` is half the screen
   * width in world units (enemies spawn just beyond it).
   */
  public update(deltaTimeSec: number, worldHalfWidth: number) {
    if (!this.isRunning || !this.track || this.paused) return;
    this.worldHalfWidth = worldHalfWidth;

    const audioTime = audioEngine.getPlaybackTime();
    const effectiveTime = audioTime - this.settings.latencyOffsetMs / 1000;
    this.songTime = effectiveTime;
    const beatPos = beatPosition(effectiveTime, this.beatGrid);

    // 1. ENEMIES: position comes straight from the song clock, so they always
    // reach the strike line exactly on their beat.
    const minX = this.hitLineOffset * 0.55;
    for (const enemy of this.enemies) {
      if (enemy.defeated) continue;

      const timeRemaining = enemy.targetTime - effectiveTime;
      const t = timeRemaining / this.approachDuration;

      const hitX = enemy.lane === 'left' ? -this.hitLineOffset : this.hitLineOffset;
      const spawnX = enemy.lane === 'left' ? -worldHalfWidth - 80 : worldHalfWidth + 80;

      enemy.x = hitX + (spawnX - hitX) * t;
      // Late enemies press in but never walk through the player.
      if (Math.abs(enemy.x) < minX) enemy.x = Math.sign(enemy.x || (enemy.lane === 'left' ? -1 : 1)) * minX;

      // Motion cycle in beats, so every motion style moves on the beat
      // (double-time for the speeder units).
      const speed = enemy.band === 'high' && enemy.tier === 1 ? 2 : 1;
      enemy.animPhase = beatPos * speed + (enemy.stepOffset ?? 0);

      if (timeRemaining < -BREACH_LATE_SEC) {
        this.triggerPlayerDeath(enemy);
        return;
      }
    }

    // 2. HIT-STOP: on impact, effects and the fighter freeze for a few frames.
    // Enemies above keep moving, because they must stay locked to the music.
    let fxDt = deltaTimeSec;
    if (this.hitStopRemaining > 0) {
      fxDt = 0;
      this.hitStopRemaining -= deltaTimeSec;
    }
    this.animClock += fxDt;

    // 3. DEBRIS: rigid-body physics with bouncing, friction, conveyors and the pit.
    const world: DebrisWorld = {
      floorY: FLOOR_Y,
      pitHalfWidth: this.pitRadius,
      beltSpeed: this.beltSpeed(),
      gravity: DEBRIS_GRAVITY,
      halfWidth: worldHalfWidth,
    };
    if (fxDt > 0) {
      const { impacts, sunk } = stepDebris(this.debris, world, fxDt);
      for (const hit of impacts) this.spawnFloorSparks(hit.x, hit.strength, hit.color);
      for (const piece of sunk) {
        this.particles.push({
          x: piece.x,
          y: FLOOR_Y + 30,
          vx: (Math.random() - 0.5) * 80,
          vy: -60 - Math.random() * 90,
          color: piece.color,
          size: 2.5,
          alpha: 0.9,
          life: 0,
          maxLife: 0.45,
          sparkType: 'ember',
        });
      }
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - deltaTimeSec * 18);
    }
    if (this.crowdPop > 0) {
      this.crowdPop = Math.max(0, this.crowdPop - deltaTimeSec / CROWD_POP_SEC);
    }
    const kickDecay = Math.exp(-deltaTimeSec * 14);
    this.cameraKick.x *= kickDecay;
    this.cameraKick.zoom *= kickDecay;

    const now = performance.now();
    this.judgements = this.judgements.filter((j) => {
      const age = (now - j.createdAt) / 1000;
      return age < 0.7;
    });

    // Keep the newest sparks if there are too many on screen.
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += fxDt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.sparkType === 'ring') {
        p.size += 220 * fxDt;
      } else if (p.sparkType === 'flash') {
        p.size += 160 * fxDt;
      } else if (p.sparkType === 'ember') {
        p.x += p.vx * fxDt;
        p.y += p.vy * fxDt;
      } else {
        p.x += p.vx * fxDt;
        p.y += p.vy * fxDt;
        p.vy += 900 * fxDt;
      }
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    // 4. PLAYER ANIMATION
    const pulse = beatPulse(effectiveTime, this.beatGrid, 5);
    const sway = Math.sin(beatPos * Math.PI) * 1.5;
    const restPose = idleBouncePose(this.hero.idlePose, pulse, sway);

    if (this.isAttacking) {
      const progress = (this.animClock - this.strikeStart) / this.strikeDuration;
      if (progress >= 1) {
        this.isAttacking = false;
        this.strikeActive = false;
        this.playerOffsetX = 0;
        this.currentPose = restPose;
      } else {
        const lane = this.attackDirection;
        const frame = this.strikeKeys
          ? comboFrame(this.animClock - this.strikeStart, this.strikeFromPose, this.strikeKeys, restPose, this.strikeLunge, (p) =>
              getOrientedPose(p, lane)
            )
          : strikeFrame(progress, this.strikeFromPose, this.lastAttackPose, restPose, this.strikeLunge);
        this.currentPose = frame.pose;
        this.playerOffsetX = frame.lungeX;
        this.strikeActive = frame.active;
      }
    } else {
      this.currentPose = restPose;
      this.playerOffsetX = 0;
    }
  }

  private triggerPlayerDeath(killer: Enemy) {
    this.isRunning = false;
    this.recordProgress(false);
    this.countRun(false);
    const report = explainDeath(
      { name: getEnemyStyle(killer.band, killer.tier).name, lane: killer.lane, targetTime: killer.targetTime },
      this.recentPresses,
      this.settings.oneButtonMode
    );
    audioEngine.stop();
    audioEngine.playDeathSound();
    this.screenShake = 20;

    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 450;
      this.particles.push({
        x: 0,
        y: -10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#ff2a5f' : '#00f3ff',
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        sparkType: 'line',
      });
    }

    setTimeout(() => {
      this.callbacks.onGameOver(this.scoreState, false, report);
    }, 700);
  }

  /** Save how far this run got, and compare it with the best attempt on this song. */
  private recordProgress(cleared: boolean) {
    if (!this.track || this.lastRun) return;
    const duration = this.track.audioBuffer?.duration ?? this.track.duration;
    let store: Storage | undefined;
    try {
      store = typeof localStorage !== 'undefined' ? localStorage : undefined;
    } catch {
      store = undefined;
    }
    this.lastRun = recordRunProgress(this.track.id, this.songTime, duration, cleared, store);
  }

  private finishSong(cleared: boolean) {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.recordProgress(cleared);
    this.countRun(cleared);
    audioEngine.stop();
    this.saveHighScore(cleared);
    this.callbacks.onGameOver(this.scoreState, cleared);
  }

  private saveHighScore(cleared: boolean) {
    if (!this.track) return;
    const totalHits =
      this.scoreState.perfectCount +
      this.scoreState.goodCount +
      this.scoreState.okCount +
      this.scoreState.missCount;
    const accuracy =
      totalHits > 0
        ? Math.round(
            ((this.scoreState.perfectCount * 100 +
              this.scoreState.goodCount * 70 +
              this.scoreState.okCount * 40) /
              (totalHits * 100)) *
              100
          )
        : 0;

    let grade: HighScoreRecord['grade'] = 'D';
    if (accuracy >= 98 && this.scoreState.missCount === 0) grade = 'SSS';
    else if (accuracy >= 94) grade = 'SS';
    else if (accuracy >= 90) grade = 'S';
    else if (accuracy >= 80) grade = 'A';
    else if (accuracy >= 70) grade = 'B';
    else if (accuracy >= 60) grade = 'C';

    const record: HighScoreRecord = {
      trackId: this.track.id,
      highScore: this.scoreState.score,
      maxCombo: this.scoreState.maxCombo,
      accuracy,
      grade,
      cleared,
      timestamp: Date.now(),
    };

    try {
      const key = `neon_strike_highscores_v1`;
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      const prevBest: HighScoreRecord | undefined = current[this.track.id];

      if (!prevBest || record.highScore > prevBest.highScore) {
        current[this.track.id] = record;
        localStorage.setItem(key, JSON.stringify(current));
      }
    } catch {}
  }

  public getHighScore(trackId: string): HighScoreRecord | null {
    try {
      const key = `neon_strike_highscores_v1`;
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      return current[trackId] || null;
    } catch {
      return null;
    }
  }

  public getAllHighScores(): Record<string, HighScoreRecord> {
    try {
      const key = `neon_strike_highscores_v1`;
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  }
}

/** localStorage, or nothing when the browser won't allow it (some privacy modes throw just for touching it). */
function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
