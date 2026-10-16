import {
  Track,
  Enemy,
  Lane,
  AttackDirection,
  TimingJudgementType,
  FloatingJudgement,
  Particle,
  DebrisPiece,
  GameScoreState,
  HighScoreRecord,
  SkeletonPose,
  AudioSettings,
} from '../types/game';
import { ATTACK_MOVES, IDLE_POSE, getOrientedPose, lerpPose, getMoveForCombo } from './animations';
import { audioEngine } from '../audio/audioEngine';
import { getEnemyStyle, resolveBandTier } from './enemyStyles';

export interface GameEngineCallbacks {
  onScoreUpdate: (score: GameScoreState) => void;
  onGameOver: (score: GameScoreState, cleared: boolean) => void;
  onJudgement: (judgement: TimingJudgementType, combo: number) => void;
}

export class GameEngine {
  public track: Track | null = null;
  public enemies: Enemy[] = [];
  public particles: Particle[] = [];
  public debris: DebrisPiece[] = [];
  public judgements: FloatingJudgement[] = [];
  public currentPose: SkeletonPose = { ...IDLE_POSE };
  public isAttacking: boolean = false;
  public attackDirection: AttackDirection = 'right';
  public currentMoveIndex: number = 0;
  public attackStartTime: number = 0;
  public attackDuration: number = 180;
  public lastAttackPose: SkeletonPose = { ...IDLE_POSE };

  public screenShake: number = 0;
  public freezeFrameMs: number = 0;
  public hitLineOffset: number = 70; // Strike distance from center
  public pitRadius: number = 44; // Central abyss pit half-width
  public conveyorSpeed: number = 220; // Pixels per second moving inward towards the pit

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
  };

  private callbacks: GameEngineCallbacks;
  private isRunning: boolean = false;
  private approachDuration: number = 1.35;
  private nextJudgementId: number = 1;
  private nextDebrisId: number = 1;
  private songSession: number = 0;

  constructor(callbacks: GameEngineCallbacks) {
    this.callbacks = callbacks;
    this.loadSettings();
  }

  public loadSettings() {
    try {
      const saved = localStorage.getItem('neon_strike_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
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
    this.currentMoveIndex = 0;
    this.isAttacking = false;
    this.currentPose = { ...IDLE_POSE };
    this.screenShake = 0;
    this.freezeFrameMs = 0;
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

    const beatSec = 60 / track.bpm;
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
        x: note.lane === 'left' ? -999 : note.lane === 'right' ? 999 : 0,
        y: note.lane === 'air' ? -250 : 0,
        color,
        enemyType: note.enemyType,
        pitchCategory: note.pitchCategory,
        band,
        tier,
        defeated: false,
        animPhase: Math.random() * Math.PI * 2,
        trailHistory: [],
        aerialOrigin: note.aerialOrigin,
      };
    });

    audioEngine.startTrack(track, () => {
      this.finishSong(true);
    });
  }

  public stop() {
    this.songSession++;
    this.isRunning = false;
    audioEngine.stop();
  }

  public handleInput(lane: Lane) {
    if (!this.isRunning || !this.track) return;

    if (this.settings.oneButtonMode) {
      this.handleOneButtonInput();
      return;
    }

    const audioTime = audioEngine.getPlaybackTime();
    const effectiveTime = audioTime - this.settings.latencyOffsetMs / 1000;

    const candidates = this.enemies.filter((e) => !e.defeated && e.lane === lane);

    if (candidates.length === 0) {
      this.triggerMiss(lane);
      return;
    }

    candidates.sort(
      (a, b) => Math.abs(a.targetTime - effectiveTime) - Math.abs(b.targetTime - effectiveTime)
    );
    const closest = candidates[0];
    const delta = Math.abs(closest.targetTime - effectiveTime);

    if (delta <= 0.080) {
      this.hitEnemy(closest, 'PERFECT', lane);
    } else if (delta <= 0.160) {
      this.hitEnemy(closest, 'GOOD', lane);
    } else if (delta <= 0.250) {
      this.hitEnemy(closest, 'OK', lane);
    } else {
      this.triggerMiss(lane);
    }
  }

  public handleOneButtonInput() {
    if (!this.isRunning || !this.track) return;

    const audioTime = audioEngine.getPlaybackTime();
    const effectiveTime = audioTime - this.settings.latencyOffsetMs / 1000;

    // In One-Button Mode, search across both lanes for the nearest beat enemy
    const candidates = this.enemies.filter((e) => !e.defeated);

    if (candidates.length === 0) {
      const fallbackLane: Lane = this.attackDirection === 'both' ? 'left' : (this.attackDirection || 'left');
      this.triggerMiss(fallbackLane);
      return;
    }

    candidates.sort(
      (a, b) => Math.abs(a.targetTime - effectiveTime) - Math.abs(b.targetTime - effectiveTime)
    );
    const closest = candidates[0];
    const delta = Math.abs(closest.targetTime - effectiveTime);

    if (delta <= 0.250) {
      const judgement: TimingJudgementType = delta <= 0.080 ? 'PERFECT' : delta <= 0.160 ? 'GOOD' : 'OK';

      // Hit primary nearest enemy
      this.hitEnemy(closest, judgement, closest.lane);

      // Hit any simultaneous overlapping chord notes arriving within 75ms (e.g. Ground + Air or Left + Right)
      const simultaneous = candidates.filter(
        (e) =>
          !e.defeated &&
          e !== closest &&
          Math.abs(e.targetTime - closest.targetTime) <= 0.075 &&
          Math.abs(e.targetTime - effectiveTime) <= 0.250
      );

      for (const extra of simultaneous) {
        this.hitEnemy(extra, judgement, extra.lane);
      }

      if (simultaneous.length > 0) {
        const hasAir = closest.lane === 'air' || simultaneous.some((e) => e.lane === 'air');
        const hasGround = closest.lane !== 'air' || simultaneous.some((e) => e.lane !== 'air');
        if (hasAir && hasGround) {
          this.attackDirection = 'air';
        } else if (
          closest.lane !== 'air' &&
          simultaneous.some((e) => e.lane !== 'air' && e.lane !== closest.lane)
        ) {
          this.attackDirection = 'both';
        }
      }
    } else {
      this.triggerMiss(closest.lane);
    }
  }

  private hitEnemy(enemy: Enemy, judgement: TimingJudgementType, lane: Lane) {
    enemy.defeated = true;
    enemy.deathTime = performance.now();

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

    // Extremely subtle micro-vibration (virtually zero disorientation)
    const shakeMode = this.settings.screenShake || 'subtle';
    if (shakeMode === 'none') {
      this.screenShake = 0;
    } else if (shakeMode === 'subtle') {
      this.screenShake = judgement === 'PERFECT' ? 0.6 : 0;
    } else {
      this.screenShake = judgement === 'PERFECT' ? 1.2 : judgement === 'GOOD' ? 0.5 : 0;
    }

    this.callbacks.onScoreUpdate({ ...this.scoreState });
    this.callbacks.onJudgement(judgement, this.scoreState.combo);
    audioEngine.playHitSound(judgement, enemy.band);

    // Moves progress from basic martial arts -> acrobatic -> superhuman -> god-tier finishers!
    if (judgement === 'PERFECT' || judgement === 'GOOD') {
      this.currentMoveIndex++;
    }

    const currentMove = getMoveForCombo(this.scoreState.combo, this.currentMoveIndex);
    this.isAttacking = true;
    this.attackDirection = lane;
    this.attackStartTime = performance.now();
    this.attackDuration = currentMove.durationMs;
    this.lastAttackPose = getOrientedPose(currentMove.pose, lane);

    const targetX = lane === 'left' ? -this.hitLineOffset : lane === 'right' ? this.hitLineOffset : 0;
    const targetY = lane === 'air' ? -55 : 0;
    this.judgements.push({
      id: this.nextJudgementId++,
      text: judgement,
      x: targetX,
      y: targetY - 65 - Math.random() * 20,
      color: judgement === 'PERFECT' ? '#00f3ff' : judgement === 'GOOD' ? '#ff007f' : '#ffe600',
      createdAt: performance.now(),
      scale: judgement === 'PERFECT' ? 1.4 : judgement === 'GOOD' ? 1.2 : 1.0,
      lane,
    });

    // SPAWN EXPLODING CONSTITUENT GEOMETRIC SHAPES (Knocked harder with high combo!)
    this.spawnEnemyDebrisExplosion(enemy, targetX, judgement, targetY);

    // Spawn sparks and shockwave ring
    this.spawnHitParticles(targetX, targetY, lane, judgement, enemy.color);

    const remaining = this.enemies.filter((e) => !e.defeated);
    if (remaining.length === 0) {
      setTimeout(() => this.finishSong(true), 600);
    }
  }

  // Explode enemy into its basic geometric vector pieces (Knocked harder with higher combos!)
  private spawnEnemyDebrisExplosion(
    enemy: Enemy,
    hitX: number,
    judgement: TimingJudgementType,
    hitY: number = 0
  ) {
    const dirSign =
      enemy.lane === 'left' ? -1 : enemy.lane === 'right' ? 1 : Math.random() > 0.5 ? 1 : -1;
    const power = judgement === 'PERFECT' ? 1.4 : judgement === 'GOOD' ? 1.1 : 0.85;

    // Explosive knockback speed and fragment count scales with combo count
    const comboBoost = 1.0 + Math.min(3.8, this.scoreState.combo * 0.12);

    // Core constituent body parts of the enemy
    const pieces: Array<{
      shapeType: DebrisPiece['shapeType'];
      size: number;
      offsetY: number;
      points?: Array<{ x: number; y: number }>;
    }> = [
      // Head / helmet
      { shapeType: 'head', size: 11, offsetY: -52 },
      // Chest core armor plate
      {
        shapeType: 'chest',
        size: 16,
        offsetY: -25,
        points: [
          { x: -12, y: -12 },
          { x: 12, y: -12 },
          { x: 8, y: 12 },
          { x: -8, y: 12 },
        ],
      },
      // Pelvis block
      { shapeType: 'shard', size: 10, offsetY: 5 },
      // Left Arm limb
      { shapeType: 'arm', size: 18, offsetY: -18 },
      // Right Arm limb
      { shapeType: 'arm', size: 18, offsetY: -14 },
      // Left Leg limb
      { shapeType: 'leg', size: 22, offsetY: 32 },
      // Right Leg limb
      { shapeType: 'leg', size: 22, offsetY: 36 },
      // Signature weapon / armor piece
      {
        shapeType: 'blade',
        size: enemy.band === 'bass' ? 32 : 18,
        offsetY: -5,
      },
      // Cyber armor shards
      { shapeType: 'shard', size: 8, offsetY: -10 },
      { shapeType: 'shard', size: 8, offsetY: 15 },
    ];

    // High combo = massively more shattered shards & explosive debris
    if (this.scoreState.combo >= 8) {
      pieces.push({ shapeType: 'shard', size: 9, offsetY: -32 });
      pieces.push({ shapeType: 'shard', size: 9, offsetY: -5 });
      pieces.push({ shapeType: 'shard', size: 8, offsetY: 22 });
    }
    if (this.scoreState.combo >= 18) {
      pieces.push({ shapeType: 'shard', size: 11, offsetY: -45 });
      pieces.push({ shapeType: 'shard', size: 10, offsetY: 10 });
      pieces.push({ shapeType: 'shard', size: 11, offsetY: -15 });
      pieces.push({ shapeType: 'shard', size: 12, offsetY: 35 });
    }
    if (this.scoreState.combo >= 32) {
      pieces.push({ shapeType: 'shard', size: 14, offsetY: -50 });
      pieces.push({ shapeType: 'shard', size: 13, offsetY: 0 });
      pieces.push({ shapeType: 'blade', size: 22, offsetY: -20 });
      pieces.push({ shapeType: 'shard', size: 12, offsetY: 40 });
    }
    if (this.scoreState.combo >= 50) {
      for (let s = 0; s < 8; s++) {
        pieces.push({
          shapeType: 'shard',
          size: 10 + Math.random() * 8,
          offsetY: -50 + Math.random() * 90,
        });
      }
    }

    for (const p of pieces) {
      // Explosive dispersal arc: knocked back harder away from player with extreme velocity
      const angle = (Math.random() - 0.5) * Math.PI * 0.95 - Math.PI * 0.5;
      const speed = (280 + Math.random() * 400) * power * comboBoost;
      const vx = Math.cos(angle) * speed + dirSign * (110 + Math.random() * 180) * comboBoost;
      const vy = Math.sin(angle) * speed;

      this.debris.push({
        id: this.nextDebrisId++,
        x: hitX + (Math.random() - 0.5) * 20,
        y: hitY + p.offsetY,
        vx,
        vy,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 24 * comboBoost,
        color: enemy.color,
        shapeType: p.shapeType,
        size: p.size,
        points: p.points,
        landed: false,
        fallingInPit: false,
        alpha: 1.0,
        life: 0,
        maxLife: 3.8,
      });
    }
  }

  private triggerMiss(lane: Lane) {
    this.scoreState.combo = 0;
    this.scoreState.missCount++;
    this.callbacks.onScoreUpdate({ ...this.scoreState });
    this.callbacks.onJudgement('MISS', 0);
    audioEngine.playSwingSound();

    const targetX = lane === 'left' ? -this.hitLineOffset : lane === 'right' ? this.hitLineOffset : 0;
    const targetY = lane === 'air' ? -95 : -55;
    this.judgements.push({
      id: this.nextJudgementId++,
      text: 'MISS',
      x: targetX,
      y: targetY,
      color: '#ff2a5f',
      createdAt: performance.now(),
      scale: 1.0,
      lane,
    });

    this.isAttacking = true;
    this.attackDirection = lane;
    this.attackStartTime = performance.now();
    this.attackDuration = 140;
    this.lastAttackPose = getOrientedPose(ATTACK_MOVES[0].pose, lane);
  }

  private spawnHitParticles(
    x: number,
    y: number,
    lane: Lane,
    judgement: TimingJudgementType,
    color: string
  ) {
    const count = judgement === 'PERFECT' ? 36 : judgement === 'GOOD' ? 22 : 12;

    this.particles.push({
      x,
      y: 68,
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
      const angle = (Math.random() - 0.5) * Math.PI * 1.5 + (lane === 'left' ? Math.PI : 0);
      const speed = 180 + Math.random() * (judgement === 'PERFECT' ? 450 : 300);

      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: Math.random() > 0.4 ? color : '#00f3ff',
        size: 2 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        sparkType: Math.random() > 0.4 ? 'line' : 'dot',
      });
    }
  }

  public update(deltaTimeSec: number, canvasWidth: number) {
    if (!this.isRunning || !this.track) return;

    const audioTime = audioEngine.getPlaybackTime();
    const effectiveTime = audioTime - this.settings.latencyOffsetMs / 1000;
    const halfWidth = canvasWidth / 2;

    // 1. UPDATE ENEMIES
    for (const enemy of this.enemies) {
      if (enemy.defeated) continue;

      const timeRemaining = enemy.targetTime - effectiveTime;
      const t = timeRemaining / this.approachDuration;

      if (enemy.lane === 'air') {
        const originX =
          enemy.aerialOrigin === 'left'
            ? -halfWidth * 0.65
            : enemy.aerialOrigin === 'right'
            ? halfWidth * 0.65
            : 0;
        enemy.x = originX * t;
        // Swoop down from sky (-240px) to player head level (-55px) with graceful swoop arc
        enemy.y = -55 - 190 * t - 30 * Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
      } else {
        const hitX = enemy.lane === 'left' ? -this.hitLineOffset : this.hitLineOffset;
        const spawnX = enemy.lane === 'left' ? -halfWidth - 80 : halfWidth + 80;
        enemy.x = hitX + (spawnX - hitX) * t;
        enemy.y = 0;
      }

      const bpm = this.track?.bpm || 120;
      const strideRate = (bpm / 60) * Math.PI * 2 * (enemy.band === 'high' && enemy.tier === 1 ? 1.4 : 1.0);
      enemy.animPhase += deltaTimeSec * strideRate;

      if (Math.abs(enemy.x) < halfWidth + 20) {
        enemy.trailHistory.push({ x: enemy.x, y: enemy.y, alpha: 0.5 });
        if (enemy.trailHistory.length > 4) {
          enemy.trailHistory.shift();
        }
      }

      if (timeRemaining < -0.12) {
        this.triggerPlayerDeath();
        return;
      }
    }

    // 2. UPDATE EXPLODED DEBRIS PIECES WITH CONVEYOR & PIT PHYSICS
    const groundLevel = 68;
    const bpm = this.track?.bpm || 120;
    const currentConveyorSpeed = this.conveyorSpeed * (bpm / 120);

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const piece = this.debris[i];
      piece.life += deltaTimeSec;

      if (piece.fallingInPit) {
        // Accelerate into the abyss pit
        piece.vy += 850 * deltaTimeSec;
        piece.y += piece.vy * deltaTimeSec;
        piece.x += piece.vx * 0.3 * deltaTimeSec;
        piece.angle += piece.vAngle * 0.5 * deltaTimeSec;
        piece.alpha -= 1.8 * deltaTimeSec;

        if (piece.y > 220 || piece.alpha <= 0) {
          // Despawn in pit with a small disintegrating spark
          this.particles.push({
            x: piece.x,
            y: Math.min(piece.y, 140),
            vx: (Math.random() - 0.5) * 80,
            vy: -40 - Math.random() * 80,
            color: piece.color,
            size: 2.5,
            alpha: 0.9,
            life: 0,
            maxLife: 0.4,
            sparkType: 'ember',
          });
          this.debris.splice(i, 1);
          continue;
        }
      } else {
        // Normal airborne / ground motion
        piece.vy += 750 * deltaTimeSec;
        piece.x += piece.vx * deltaTimeSec;
        piece.y += piece.vy * deltaTimeSec;
        piece.angle += piece.vAngle * deltaTimeSec;

        // Check if over the Central Pit
        if (Math.abs(piece.x) <= this.pitRadius) {
          // Inside the pit region: falls straight down into the pit!
          if (piece.y >= groundLevel - 5) {
            piece.fallingInPit = true;
            piece.vx *= 0.3;
          }
        } else {
          // Over Left or Right Conveyors: check ground bounce
          if (piece.y >= groundLevel) {
            piece.y = groundLevel;
            if (Math.abs(piece.vy) > 80) {
              piece.vy = -piece.vy * 0.42;
              piece.vx *= 0.75;
              piece.vAngle *= 0.8;
            } else {
              piece.landed = true;
              piece.vy = 0;
            }
          }

          // If landed on conveyor: Conveyors move inwards towards the pit!
          if (piece.y >= groundLevel - 2) {
            if (piece.x < -this.pitRadius) {
              // Left side conveyor moves RIGHT (towards center pit)
              piece.x += currentConveyorSpeed * deltaTimeSec;
              piece.angle += 3 * deltaTimeSec;
            } else if (piece.x > this.pitRadius) {
              // Right side conveyor moves LEFT (towards center pit)
              piece.x -= currentConveyorSpeed * deltaTimeSec;
              piece.angle -= 3 * deltaTimeSec;
            }
          }
        }
      }

      if (piece.life >= piece.maxLife && !piece.fallingInPit) {
        piece.alpha -= 1.5 * deltaTimeSec;
        if (piece.alpha <= 0) {
          this.debris.splice(i, 1);
        }
      }
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - deltaTimeSec * 35);
    }

    const now = performance.now();
    this.judgements = this.judgements.filter((j) => {
      const age = (now - j.createdAt) / 1000;
      return age < 0.65;
    });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaTimeSec;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.sparkType === 'ring') {
        p.size += 180 * deltaTimeSec;
      } else if (p.sparkType === 'ember') {
        p.x += p.vx * deltaTimeSec;
        p.y += p.vy * deltaTimeSec;
      } else {
        p.x += p.vx * deltaTimeSec;
        p.y += p.vy * deltaTimeSec;
        p.vy += 480 * deltaTimeSec;
      }
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    const scarfWind = Math.sin(now * 0.008) * 6;
    if (this.isAttacking) {
      const elapsedMs = now - this.attackStartTime;
      const progress = elapsedMs / this.attackDuration;

      if (progress < 0.4) {
        const t = progress / 0.4;
        this.currentPose = lerpPose(IDLE_POSE, this.lastAttackPose, t * t);
      } else if (progress < 0.75) {
        this.currentPose = this.lastAttackPose;
      } else if (progress < 1.0) {
        const t = (progress - 0.75) / 0.25;
        this.currentPose = lerpPose(this.lastAttackPose, IDLE_POSE, t);
      } else {
        this.isAttacking = false;
        this.currentPose = { ...IDLE_POSE };
      }
    } else {
      const breath = Math.sin(now * 0.005) * 1.5;
      this.currentPose = {
        ...IDLE_POSE,
        chest: { x: IDLE_POSE.chest.x, y: IDLE_POSE.chest.y + breath * 0.5 },
        head: { x: IDLE_POSE.head.x, y: IDLE_POSE.head.y + breath },
        scarf: [
          { x: -8, y: -48 + breath },
          { x: -22, y: -44 + scarfWind * 0.5 },
          { x: -38, y: -38 + scarfWind },
          { x: -55, y: -32 + scarfWind * 1.5 },
        ],
      };
    }
  }

  private triggerPlayerDeath() {
    this.isRunning = false;
    audioEngine.stop();
    audioEngine.playDeathSound();
    this.screenShake = 28;

    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 450;
      this.particles.push({
        x: 0,
        y: 10,
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
