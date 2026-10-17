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
  AudioSettings,
} from '../types/game';
import { ATTACK_MOVES, IDLE_POSE, getOrientedPose, getMoveForCombo } from './animations';
import { audioEngine } from '../audio/audioEngine';
import { getEnemyStyle, resolveBandTier } from './enemyStyles';
import { BREACH_LATE_SEC, judgeOffset, pickTarget, suggestLatencyOffsetMs } from './timing';
import { DebrisPiece, DebrisWorld, shatterEnemy, stepDebris } from './debrisPhysics';
import { BeatGrid, beatPosition, beatPulse, gridForNotes } from '../audio/beatGrid';
import { songTimeAtEvent } from '../audio/songClock';
import { idleBouncePose, strikeFrame } from './motion';
import { FLOOR_Y } from './layout';
import { buildForBand, DEFAULT_ENEMY_MOTION, ENEMY_MOTION_STYLES, enemyPose } from './enemyMotion';

export interface GameEngineCallbacks {
  onScoreUpdate: (score: GameScoreState) => void;
  onGameOver: (score: GameScoreState, cleared: boolean) => void;
  onJudgement: (judgement: TimingJudgementType, combo: number) => void;
}

/** Never keep more than this many debris pieces alive (protects frame rate on long combos). */
const MAX_DEBRIS = 260;
/** How far the fighter lunges toward the enemy on a strike (world units) */
const LUNGE_DISTANCE = 16;
/** Freeze-frame length on impact, by judgement (seconds). Sells the weight of a hit. */
const HIT_STOP: Record<TimingJudgementType, number> = { PERFECT: 0.06, GOOD: 0.04, OK: 0.025, MISS: 0 };

export class GameEngine {
  public track: Track | null = null;
  public enemies: Enemy[] = [];
  public particles: Particle[] = [];
  public debris: DebrisPiece[] = [];
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
  /** Brief camera nudge toward the side that was hit, plus a tiny zoom punch */
  public cameraKick = { x: 0, zoom: 0 };
  public hitLineOffset: number = 78; // Strike distance from center (world units)
  public pitRadius: number = 44; // Central abyss pit half-width
  public conveyorSpeed: number = 220; // Pixels per second moving inward towards the pit

  /** Song time (s) the player is hearing, with the latency setting applied. Updated every frame. */
  public songTime: number = 0;
  /** Exact tempo and beat positions, so visuals can pulse on the beat */
  public beatGrid: BeatGrid = { bpm: 120, offset: 0, strength: 0 };
  /** Seconds an enemy takes to walk from the screen edge to the strike line */
  public approachDuration: number = 1.35;
  /** Press-minus-beat timing error (s) of every successful hit this song */
  public hitOffsets: number[] = [];

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

  constructor(callbacks: GameEngineCallbacks) {
    this.callbacks = callbacks;
    this.loadSettings();
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
    this.currentMoveIndex = 0;
    this.isAttacking = false;
    this.strikeActive = false;
    this.playerOffsetX = 0;
    this.currentPose = { ...IDLE_POSE };
    this.screenShake = 0;
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
        trailHistory: [],
      };
    });

    audioEngine.startTrack(track, () => {
      this.finishSong(true);
    });
  }

  public stop() {
    this.songSession++;
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
    if (!target) {
      this.triggerMiss(this.attackDirection || 'left');
      return;
    }
    this.hitEnemy(target, time - target.targetTime, target.lane);
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

    const currentMove = getMoveForCombo(this.scoreState.combo, this.currentMoveIndex);
    this.startStrike(lane, getOrientedPose(currentMove.pose, lane), currentMove.durationMs / 1000 + 0.06, LUNGE_DISTANCE);

    const targetX = lane === 'left' ? -this.hitLineOffset : this.hitLineOffset;
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
  private startStrike(lane: Lane, pose: SkeletonPose, durationSec: number, lunge: number) {
    this.isAttacking = true;
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
    const comboPower = 1 + Math.min(0.9, combo * 0.02);
    const extraShards = combo >= 50 ? 9 : combo >= 32 ? 6 : combo >= 18 ? 4 : combo >= 8 ? 2 : 0;

    const pieces = shatterEnemy(
      {
        x: enemy.x,
        pose: enemyPose(this.settings.enemyMotion, enemy.animPhase, buildForBand(enemy.band)),
        facing: enemy.lane === 'left' ? 1 : -1,
        scale: style.scale,
        color: enemy.color,
        accent: style.accent,
        hasBlade: enemy.band !== 'sub',
        power: judgementPower * comboPower,
        extraShards,
      },
      () => this.nextDebrisId++
    );
    this.debris.push(...pieces);

    // Drop the oldest pieces if there are too many on screen.
    if (this.debris.length > MAX_DEBRIS) {
      this.debris.splice(0, this.debris.length - MAX_DEBRIS);
    }
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
    this.startStrike(lane, getOrientedPose(ATTACK_MOVES[0].pose, lane), 0.16, LUNGE_DISTANCE * 0.4);
  }

  private spawnHitParticles(
    x: number,
    y: number,
    lane: Lane,
    judgement: TimingJudgementType,
    color: string
  ) {
    const count = judgement === 'PERFECT' ? 36 : judgement === 'GOOD' ? 22 : 12;
    const away = lane === 'left' ? -1 : 1;

    // Bright flash at the point of impact
    this.particles.push({
      x: x - away * 6,
      y,
      vx: 0,
      vy: 0,
      color: '#ffffff',
      size: judgement === 'PERFECT' ? 34 : 24,
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
      const speed = 220 + Math.random() * (judgement === 'PERFECT' ? 520 : 340);

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
    const count = Math.min(8, Math.floor(strength / 120));
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

      if (Math.abs(enemy.x) < worldHalfWidth + 20) {
        enemy.trailHistory.push({ x: enemy.x, y: enemy.y, alpha: 0.5 });
        if (enemy.trailHistory.length > 4) {
          enemy.trailHistory.shift();
        }
      }

      if (timeRemaining < -BREACH_LATE_SEC) {
        this.triggerPlayerDeath();
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
      beltSpeed: this.conveyorSpeed * (this.beatGrid.bpm / 120) * 0.6,
      gravity: 1500,
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
    const kickDecay = Math.exp(-deltaTimeSec * 14);
    this.cameraKick.x *= kickDecay;
    this.cameraKick.zoom *= kickDecay;

    const now = performance.now();
    this.judgements = this.judgements.filter((j) => {
      const age = (now - j.createdAt) / 1000;
      return age < 0.7;
    });

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
    const restPose = idleBouncePose(IDLE_POSE, pulse, sway);

    if (this.isAttacking) {
      const progress = (this.animClock - this.strikeStart) / this.strikeDuration;
      if (progress >= 1) {
        this.isAttacking = false;
        this.strikeActive = false;
        this.playerOffsetX = 0;
        this.currentPose = restPose;
      } else {
        const frame = strikeFrame(progress, this.strikeFromPose, this.lastAttackPose, restPose, this.strikeLunge);
        this.currentPose = frame.pose;
        this.playerOffsetX = frame.lungeX;
        this.strikeActive = frame.active;
      }
    } else {
      this.currentPose = restPose;
      this.playerOffsetX = 0;
    }
  }

  private triggerPlayerDeath() {
    this.isRunning = false;
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
      this.callbacks.onGameOver(this.scoreState, false);
    }, 700);
  }

  private finishSong(cleared: boolean) {
    this.isRunning = false;
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
