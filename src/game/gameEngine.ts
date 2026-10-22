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
import { RunUnlock, unlocksBetween } from './runUnlocks';
import { accuracyPercent, addRun, HERO_UNLOCKS, isHeroUnlocked, LifetimeStats, loadStats, newlyUnlocked, saveStats } from './heroUnlocks';
import { isStanceUnlocked, nextStance } from './stanceUnlocks';
import { audioEngine, PRELOADED_TRACKS } from '../audio/audioEngine';
import { getEnemyStyle, resolveBandTier } from './enemyStyles';
import { BREACH_LATE_SEC, DeathReport, explainDeath, judgeOffset, pickTarget, PressRecord, suggestLatencyOffsetMs } from './timing';
import { burstOrb, DEBRIS_GRAVITY, DebrisPiece, DebrisWorld, shatterEnemy, stepDebris, trimDebris } from './debrisPhysics';
import { BeatGrid, beatPosition, beatPulse, gridForNotes } from '../audio/beatGrid';
import { songTimeAtEvent } from '../audio/songClock';
import { idleBouncePose, strikeFrame } from './motion';
import { comboDuration, comboFrame } from './combo';
import { FLOOR_Y, SPAWN_DISTANCE } from './layout';
import { comboBlastPower, extraShardsForCombo, MAX_DEBRIS, MAX_PARTICLES } from './comboFx';
import { practiceRunProgress, recordRunProgress, RunProgress } from './runProgress';
import { DEFAULT_ENEMY_MOTION, ENEMY_MOTION_STYLES, EnemyMotionStyle } from './enemyMotion';
import { enemyPoseFor } from './customAnimation';
import { getActiveAnimations } from './animationLibrary';
import { progressStore } from '../platform/crazyGames';
import { activeBackdrop, BACKDROP_ITEMS, BackdropItem, BackdropLayer, isBackdropUnlocked, nextBackdrop } from './backdrops';
import { loadSeen, saveSeen, UnlockKind, unlockKey, unseen } from './seenUnlocks';
import { BOSS_LOOKS, BOSS_SCALE, BossFigure, bossFigures, bossKindFor, BossPlan, fistFlightSec, HP_PER_ATTACK, planBoss, standX } from './boss';

/** The end-of-song boss while a song is playing (see boss.ts). */
export interface BossState {
  plan: BossPlan;
  /** Health left (the twins: both together) */
  hp: number;
  /** Twins: each one's health left */
  sideHp: Record<Lane, number>;
  /** Twins: performance.now() when each fell (0 = still standing) */
  downAt: Record<Lane, number>;
  ko: boolean;
  /** performance.now() of the KO, and of the last time it was hurt (and which twin) */
  koAt: number;
  hurtAt: number;
  hurtSide: Lane | null;
  /** Beat time of the last fist (each twin's own, and overall): hitting it is the killing blow */
  finalFist: Record<Lane, number>;
  finalFistAll: number;
  /** Health as the bar shows it: it drops when a hit-back fist lands, a moment after the hit */
  shownHp: number;
  shownSideHp: Record<Lane, number>;
}

/** A fist the player hit back, flying at the boss (see returnedFistPosition). */
export interface ReturningFist {
  fromX: number;
  /** The fist's side: for the twins, the twin it flies back to */
  lane: Lane;
  /** performance.now() when it was hit */
  start: number;
  /** It's the killing blow: the boss (or this twin) goes down when it lands */
  final: boolean;
}

/** How long a hit-back fist takes to reach the boss (ms). */
export const RETURN_MS = 280;

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

/**
 * Dev builds only: ?short ends every song at 2:00, to try out 2-minute songs
 * (and reach the boss) before the real ones are made. The boss moves to the new end.
 */
const SHORT_TEST_SEC =
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('short') ? 120 : 0;

/** Dev builds only: ?boss starts every song a few seconds before its boss. */
const BOSS_TEST =
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('boss');

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
  /** Seconds a boss fist is in the air (shorter than the walk, see boss.ts) */
  public fistFlight: number = 0.8;
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
      this.lifetimeStats = { enemiesDefeated: 1e9, perfects: 1e9, bestCombo: 1e9, songsCleared: 1e9, playSeconds: 1e9, adUnlocks: 0, heroAds: 1e9, totalScore: 1e9, backdropAds: 0, backdropsUnlocked: 1e9, okHits: 1e9, bestClearAccuracy: 100, flawlessClears: 1e9, mostMissesCleared: 1e9, songsDied: 1e9, songsQuit: 1e9, bestOkStreak: 1e9 };
      this.devUnlockAll = true;
    }
    this.loadSettings();
    this.loadSeenUnlocks();
  }

  /**
   * Load the saved progress again (totals and settings). Called once the
   * CrazyGames SDK has started: on CrazyGames, progress lives in its data
   * module, which can only be read after that.
   */
  public reloadProgress() {
    if (!this.devUnlockAll) this.lifetimeStats = loadStats(safeStorage());
    this.loadSettings();
    this.loadSeenUnlocks();
  }

  /** Unlocks already tapped on (see seenUnlocks): the rest wear a "new" badge */
  private seenUnlocks = new Set<string>();

  private loadSeenUnlocks() {
    // ?unlockAll opens everything: leave the real list alone, so every piece shows as new
    this.seenUnlocks = loadSeen(safeStorage(), this.openUnlockKeys(), { seed: !this.devUnlockAll });
  }

  /** Everything open right now, as seenUnlocks keys */
  private openUnlockKeys(): string[] {
    return [
      ...HEROES.filter((h) => this.isHeroUnlocked(h.id)).map((h) => unlockKey('hero', h.id)),
      ...ENEMY_MOTION_STYLES.filter((m) => this.isStanceUnlocked(m.id)).map((m) => unlockKey('stance', m.id)),
      ...BACKDROP_ITEMS.filter((b) => this.isBackdropUnlocked(b.id)).map((b) => unlockKey('backdrop', b.id)),
    ];
  }

  /** Open unlocks not yet tapped on, by kind: their ids */
  public unseenUnlocks(): Record<UnlockKind, string[]> {
    const out: Record<UnlockKind, string[]> = { hero: [], stance: [], backdrop: [] };
    for (const key of unseen(this.openUnlockKeys(), this.seenUnlocks)) {
      const [kind, id] = key.split(':') as [UnlockKind, string];
      out[kind].push(id);
    }
    return out;
  }

  /** The player tapped on an unlock: its badge goes. Returns true if it was new. */
  public markUnlockSeen(kind: UnlockKind, id: string): boolean {
    const key = unlockKey(kind, id);
    if (this.seenUnlocks.has(key)) return false;
    this.seenUnlocks = new Set(this.seenUnlocks).add(key);
    if (!this.devUnlockAll) saveSeen(safeStorage(), this.seenUnlocks);
    return true;
  }

  /** The player's totals over every song, which unlock the heroes (see heroUnlocks). */
  public lifetimeStats: LifetimeStats;
  /** Heroes the last song unlocked, for the results screen to announce */
  public newUnlocks: HeroId[] = [];
  /** Everything the last song unlocked (heroes, stances, backdrop pieces), for the unlock popup */
  public runUnlocks: RunUnlock[] = [];
  /** This song's results have already been added to the lifetime totals */
  private runCounted = false;
  /**
   * Practice mode: enemies that get through only count as a hit taken, and
   * the song plays on to the end. Nothing is saved or earned: no lifetime
   * stats or unlocks, no best progress, no high score.
   */
  public practice = false;
  /** The end-of-song boss for this song, or null when the song has none */
  public boss: BossState | null = null;
  /** Fists the player hit back, flying at the boss */
  public returningFists: ReturningFist[] = [];
  /** Song time the song is cut off at (only with the dev ?short switch) */
  private songEndAt = Infinity;
  /** Song times (s) of the hits taken this practice run */
  public practiceHits: number[] = [];
  /** Seconds played in practice this visit (only for pacing midgame ads, see adClockSeconds) */
  private practiceSeconds = 0;

  /** Play time for pacing midgame ads: practice counts too, so it's never an ad-free way to play. */
  public get adClockSeconds(): number {
    return this.lifetimeStats.playSeconds + this.practiceSeconds;
  }

  /** OK hits in a row right now, and the most this song (The Tin Man's goal) */
  private okStreak = 0;
  private bestOkStreak = 0;
  /** Dev ?unlockAll mode: every hero open, and real progress never saved over */
  private devUnlockAll = false;

  /** The hero being played (from the settings). A hero not yet earned plays as the default one. */
  public get hero(): HeroDefinition {
    return getHero(this.isHeroUnlocked(this.settings.hero) ? this.settings.hero : DEFAULT_HERO);
  }

  public isHeroUnlocked(id: HeroId): boolean {
    return isHeroUnlocked(id, this.lifetimeStats);
  }

  /** How the enemies move (from the settings). A stance not yet earned plays as the default one. */
  public get enemyMotion(): EnemyMotionStyle {
    return this.isStanceUnlocked(this.settings.enemyMotion) ? this.settings.enemyMotion : DEFAULT_ENEMY_MOTION;
  }

  public isStanceUnlocked(id: EnemyMotionStyle): boolean {
    return isStanceUnlocked(id, this.lifetimeStats);
  }

  /** The player watched a rewarded ad: open the next enemy stance now. Returns the stance opened. */
  public unlockStanceWithAd(): EnemyMotionStyle | null {
    const stance = nextStance(this.lifetimeStats);
    if (!stance) return null;
    this.lifetimeStats = { ...this.lifetimeStats, adUnlocks: this.lifetimeStats.adUnlocks + 1 };
    if (!this.devUnlockAll) saveStats(safeStorage(), this.lifetimeStats);
    return stance;
  }

  /** The backdrop being drawn: the chosen pieces, any locked ones swapped for the free piece of that layer. */
  public get backdrop(): Record<BackdropLayer, string> {
    return activeBackdrop(this.settings.backdrop, this.lifetimeStats);
  }

  public isBackdropUnlocked(id: string): boolean {
    return isBackdropUnlocked(id, this.lifetimeStats);
  }

  /** The player watched a rewarded ad: open the next backdrop piece now. Returns it, or null if they're all open. */
  public unlockBackdropWithAd(): BackdropItem | null {
    const next = nextBackdrop(this.lifetimeStats);
    if (!next) return null;
    this.lifetimeStats = { ...this.lifetimeStats, backdropAds: this.lifetimeStats.backdropAds + 1 };
    if (!this.devUnlockAll) saveStats(safeStorage(), this.lifetimeStats);
    return next;
  }

  /** The player watched a rewarded ad for this offer (see adOffer): unlock it. Returns false if it was already open. */
  public unlockWithAd(offer: RunUnlock): boolean {
    if (offer.kind === 'hero') return this.unlockHeroWithAd(offer.id as HeroId);
    if (offer.kind === 'stance') return this.unlockStanceWithAd() === offer.id;
    return this.unlockBackdropWithAd()?.id === offer.id;
  }

  /** The player watched a rewarded ad for an ad-only hero: unlock them. Returns false if there was nothing to unlock. */
  public unlockHeroWithAd(id: HeroId): boolean {
    if (!HERO_UNLOCKS[id]?.ad || this.isHeroUnlocked(id)) return false;
    this.lifetimeStats = { ...this.lifetimeStats, heroAds: this.lifetimeStats.heroAds + 1 };
    if (!this.devUnlockAll) saveStats(safeStorage(), this.lifetimeStats);
    return true;
  }

  /**
   * Add this song to the lifetime totals, once, however it ended (cleared,
   * died, or quit part way: the enemies you beat still count), and note any
   * heroes it unlocked.
   */
  private countRun(cleared: boolean, died = false, quit = false) {
    if (!this.track || this.runCounted) return;
    this.runCounted = true;
    // Practice counts for nothing (only for pacing ads), and neither does a dev ?boss run
    if (this.practice || BOSS_TEST) {
      this.practiceSeconds += this.songTime;
      return;
    }
    const s = this.scoreState;
    const before = this.lifetimeStats;
    this.lifetimeStats = addRun(before, {
      enemiesDefeated: s.perfectCount + s.goodCount + s.okCount,
      perfects: s.perfectCount,
      oks: s.okCount,
      misses: s.missCount,
      accuracy: accuracyPercent({ perfect: s.perfectCount, good: s.goodCount, ok: s.okCount, miss: s.missCount }),
      maxCombo: s.maxCombo,
      cleared,
      died,
      quit,
      okStreak: this.bestOkStreak,
      seconds: this.songTime,
      score: s.score,
    });
    this.newUnlocks = newlyUnlocked(
      HEROES.map((h) => h.id),
      before,
      this.lifetimeStats
    );
    this.runUnlocks = unlocksBetween(before, this.lifetimeStats);
    if (!this.devUnlockAll) saveStats(safeStorage(), this.lifetimeStats);
  }

  public loadSettings() {
    try {
      const saved = progressStore()?.getItem('neon_strike_settings');
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
      progressStore()?.setItem('neon_strike_settings', JSON.stringify(this.settings));
      audioEngine.setVolume(this.settings.volume, this.settings.sfxVolume);
    } catch {}
  }

  public async startSong(track: Track, practice = false) {
    const session = ++this.songSession;
    this.track = track;
    this.boss = null;
    this.returningFists = [];
    this.songEndAt = Infinity;
    this.practice = practice;
    this.practiceHits = [];
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
    this.runUnlocks = [];
    this.okStreak = 0;
    this.bestOkStreak = 0;
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

    // Dev ?short: drop the notes after 2:00 and end the song there.
    let notes = track.notes;
    if (SHORT_TEST_SEC && notes.length > 0 && notes[notes.length - 1].time > SHORT_TEST_SEC) {
      notes = notes.filter((n) => n.time <= SHORT_TEST_SEC - 1.5);
      this.songEndAt = SHORT_TEST_SEC;
    }

    this.scoreState = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      okCount: 0,
      missCount: 0,
      totalNotes: notes.length,
    };
    this.callbacks.onScoreUpdate(this.scoreState);

    // Lock visuals to the music: exact tempo + where the beats fall.
    const grid = gridForNotes(track.notes, track.bpm, 0.01);
    this.beatGrid = grid.strength > 0.15 ? grid : { bpm: track.bpm, offset: 0, strength: 0 };

    const beatSec = 60 / this.beatGrid.bpm;
    this.approachDuration = Math.max(1.1, Math.min(2.2, beatSec * 4)); // Exactly 4 musical beats (1 bar) approach
    this.fistFlight = fistFlightSec(this.beatGrid.bpm, this.approachDuration);

    // The end-of-song boss: it takes over the last stretch, turning those notes into its fists.
    const bossKind = bossKindFor(track.id, PRELOADED_TRACKS.map((t) => t.id));
    const bossPlan = planBoss(notes, this.beatGrid.bpm, bossKind);
    this.boss = bossPlan
      ? {
          plan: bossPlan,
          hp: bossPlan.maxHp,
          sideHp: { ...bossPlan.sideHp },
          // A twin with no fists to throw (a one-sided chart) counts as down from the start
          downAt: {
            left: bossPlan.kind === 'twins' && bossPlan.sideHp.left === 0 ? -1 : 0,
            right: bossPlan.kind === 'twins' && bossPlan.sideHp.right === 0 ? -1 : 0,
          },
          ko: false,
          koAt: 0,
          hurtAt: 0,
          hurtSide: null,
          finalFist: { left: -1, right: -1 },
          finalFistAll: -1,
          shownHp: bossPlan.maxHp,
          shownSideHp: { ...bossPlan.sideHp },
        }
      : null;
    this.scoreState.totalNotes = bossPlan ? bossPlan.keep.filter(Boolean).length : notes.length;

    this.enemies = notes.flatMap((note, index) => {
      if (bossPlan && !bossPlan.keep[index]) return [];
      const { band, tier } = resolveBandTier(note);
      const color = getEnemyStyle(band, tier).color;
      const lane = bossPlan ? bossPlan.lanes[index] : note.lane;

      return {
        id: `enemy_${index}_${note.time}`,
        lane,
        bossAttack: bossPlan?.attack[index] ?? false,
        targetTime: note.time,
        spawnTime: Math.max(0, note.time - (bossPlan?.attack[index] ? this.fistFlight : this.approachDuration)),
        speed: 1.0,
        x: lane === 'left' ? -9999 : 9999,
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
    }) as Enemy[];

    // Dev ?boss: skip straight to a few seconds before the boss arrives.
    let startAt = 0;
    if (BOSS_TEST && bossPlan) {
      startAt = Math.max(0, bossPlan.start - this.fistFlight - 3);
      this.enemies = this.enemies.filter((e) => e.targetTime > startAt + this.approachDuration);
      this.scoreState.totalNotes = this.enemies.length;
    }

    // Which fists are the last ones (the killing blows): each side's, and the very last
    if (this.boss) {
      for (const e of this.enemies) {
        if (!e.bossAttack) continue;
        this.boss.finalFist[e.lane] = Math.max(this.boss.finalFist[e.lane], e.targetTime);
        this.boss.finalFistAll = Math.max(this.boss.finalFistAll, e.targetTime);
      }
    }

    audioEngine.startTrack(
      track,
      () => {
        this.finishSong(true);
      },
      startAt
    );
  }

  public stop() {
    this.songSession++;
    // Quitting part way through still counts the enemies beaten so far.
    if (this.isRunning) this.countRun(false, false, true);
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
    // OKs in a row: anything better breaks the streak (so does a miss)
    this.okStreak = judgement === 'OK' ? this.okStreak + 1 : 0;
    this.bestOkStreak = Math.max(this.bestOkStreak, this.okStreak);

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

    if (enemy.bossAttack) {
      this.returnFist(enemy, judgement, this.damageBoss(enemy.lane, enemy.targetTime));
    } else this.spawnEnemyDebrisExplosion(enemy, judgement);
    this.spawnHitParticles(enemy.x, -22, lane, judgement, enemy.color);

    const remaining = this.enemies.filter((e) => !e.defeated);
    if (remaining.length === 0) {
      // Only if it's still this song: pressing R in the gap starts a new one, which must not end
      const session = this.songSession;
      setTimeout(() => {
        if (session === this.songSession) this.finishSong(true);
      }, 600);
    }
  }

  /** How the boss fight went: null when the song has no boss or the run ended before it arrived. */
  public bossResult(): 'ko' | 'standing' | null {
    if (!this.boss) return null;
    if (this.boss.ko) return 'ko';
    return this.songTime >= this.boss.plan.start - this.fistFlight ? 'standing' : null;
  }

  /** A boss fist smashed back: it bursts into hot shards and a ring of light. Better timing, bigger burst. */
  private returnFist(enemy: Enemy, judgement: TimingJudgementType, final: boolean) {
    const look = BOSS_LOOKS[this.boss?.plan.kind ?? 'leaper'];
    // A ring of light where it was struck, then it flies back at the boss
    this.returningFists.push({ fromX: enemy.x, lane: enemy.lane, start: performance.now(), final });
    this.particles.push({
      x: enemy.x,
      y: -6,
      vx: 0,
      vy: 0,
      color: look.accent,
      size: 8,
      alpha: 1,
      life: 0,
      maxLife: judgement === 'PERFECT' ? 0.35 : 0.25,
      sparkType: 'ring',
    });
  }

  /**
   * A fist was hit back: every fist takes the same chunk of health, so the boss goes down
   * on its last fist (the last thing to hit in the song). One that got through in practice
   * leaves it standing. Each twin takes damage from its own fists and falls on its own last.
   * Returns true for the killing blow, which floors it when the fist lands (landReturnedFist).
   */
  private damageBoss(lane: Lane, fistTime: number): boolean {
    const boss = this.boss;
    if (!boss || boss.ko) return false;
    const twins = boss.plan.kind === 'twins';
    if (twins && boss.downAt[lane]) return false;
    const damage = Math.min(HP_PER_ATTACK, twins ? boss.sideHp[lane] : boss.hp);
    boss.hp -= damage;
    if (twins) boss.sideHp[lane] -= damage;
    if (twins) return fistTime >= boss.finalFist[lane] && boss.sideHp[lane] <= 0;
    return fistTime >= boss.finalFistAll && boss.hp <= 0;
  }

  /** Where a hit-back fist is now: curving up and back into the boss's chest (it homes in as the boss moves). */
  public returnedFistPosition(f: ReturningFist, now: number): { x: number; y: number; u: number } {
    const u = Math.min(1, Math.max(0, (now - f.start) / RETURN_MS));
    const target = this.boss ? this.bossFigure(this.boss.plan.kind === 'twins' ? f.lane : null) : null;
    const tx = target ? target.x : f.fromX;
    const ty = target ? -target.lift - 70 : -70;
    const ease = u * u * (3 - 2 * u);
    return { x: f.fromX + (tx - f.fromX) * ease, y: -6 + (ty + 6) * ease - Math.sin(u * Math.PI) * 34, u };
  }

  /** A hit-back fist reaches the boss: it bursts on it, the boss flinches, the bar drops, and the last one floors it. */
  private landReturnedFist(f: ReturningFist) {
    const boss = this.boss;
    if (!boss) return;
    const look = BOSS_LOOKS[boss.plan.kind];
    const twins = boss.plan.kind === 'twins';
    const at = this.returnedFistPosition(f, f.start + RETURN_MS);
    const power = Math.min(1.4, comboBlastPower(this.scoreState.combo));
    this.debris.push(
      ...burstOrb({ x: at.x, y: at.y, color: look.color, accent: look.accent, power, count: 7 }, () => this.nextDebrisId++)
    );
    trimDebris(this.debris, MAX_DEBRIS, this.worldHalfWidth);
    boss.hurtAt = performance.now();
    boss.hurtSide = f.lane;
    boss.shownHp = Math.max(0, boss.shownHp - HP_PER_ATTACK);
    if (twins) boss.shownSideHp[f.lane] = Math.max(0, boss.shownSideHp[f.lane] - HP_PER_ATTACK);
    if (!f.final) return;

    if (twins) {
      boss.downAt[f.lane] = performance.now();
      const other: Lane = f.lane === 'left' ? 'right' : 'left';
      const last = !!boss.downAt[other];
      this.blowUpBoss(this.bossFigure(f.lane), last);
      if (last) {
        boss.ko = true;
        boss.koAt = performance.now();
      }
      return;
    }
    boss.ko = true;
    boss.koAt = performance.now();
    this.blowUpBoss(this.bossFigure(null), true);
  }

  /** Where a boss figure is right now (the twin on `lane`, or the single boss). */
  private bossFigure(lane: Lane | null): BossFigure {
    const figures = bossFigures(this.boss!.plan, this.songTime, this.fistFlight);
    return figures.find((f) => f.side === lane) ?? figures[0];
  }


  /** A boss blows apart into big pieces; the final KO also gets a long freeze, a heavy shake and the crowd pop. */
  private blowUpBoss(figure: BossFigure, final: boolean) {
    const look = BOSS_LOOKS[this.boss!.plan.kind];
    const pieces = shatterEnemy(
      {
        x: figure.x,
        pose: enemyPoseFor(this.settings.enemyMotion, beatPosition(this.songTime, this.beatGrid), look.band, look.tier, getActiveAnimations()),
        facing: figure.facing,
        scale: BOSS_SCALE,
        color: look.color,
        accent: look.accent,
        limbScale: getEnemyStyle(look.band, look.tier).limbScale,
        hasBlade: look.band !== 'sub',
        power: 2.4,
        extraShards: 14,
      },
      () => this.nextDebrisId++
    );
    this.debris.push(...pieces);
    trimDebris(this.debris, MAX_DEBRIS, this.worldHalfWidth);

    const shakeMode = this.settings.screenShake || 'subtle';
    const shakeAmount = shakeMode === 'none' ? 0 : shakeMode === 'subtle' ? 0.5 : 1;
    this.screenShake = Math.max(this.screenShake, (final ? 14 : 9) * shakeAmount);
    if (final && shakeAmount > 0) this.crowdPop = 1;
    this.hitStopRemaining = final ? 0.32 : 0.18;
    audioEngine.playHitSound('PERFECT', 'sub', 55, this.settings.hitSound);
    this.spawnHitParticles(figure.x, -60, figure.side, 'PERFECT', look.accent);
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
    this.okStreak = 0;
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
    if (effectiveTime >= this.songEndAt) {
      this.finishSong(true);
      return;
    }
    const beatPos = beatPosition(effectiveTime, this.beatGrid);

    // 1. ENEMIES: position comes straight from the song clock, so they always
    // reach the strike line exactly on their beat.
    const minX = this.hitLineOffset * 0.55;
    for (const enemy of this.enemies) {
      if (enemy.defeated) continue;

      const timeRemaining = enemy.targetTime - effectiveTime;
      const t = timeRemaining / (enemy.bossAttack ? this.fistFlight : this.approachDuration);

      const hitX = enemy.lane === 'left' ? -this.hitLineOffset : this.hitLineOffset;
      // Every screen: the same start point and speed (see SPAWN_DISTANCE). Boss fists start at the boss.
      const spawnDistance = enemy.bossAttack && this.boss ? standX(this.boss.plan.kind) : SPAWN_DISTANCE;
      const spawnX = enemy.lane === 'left' ? -spawnDistance : spawnDistance;

      enemy.x = hitX + (spawnX - hitX) * t;
      // Late enemies press in but never walk through the player.
      if (Math.abs(enemy.x) < minX) enemy.x = Math.sign(enemy.x || (enemy.lane === 'left' ? -1 : 1)) * minX;

      // Motion cycle in beats, so every motion style moves on the beat
      // (double-time for the speeder units).
      const speed = enemy.band === 'high' && enemy.tier === 1 ? 2 : 1;
      enemy.animPhase = beatPos * speed + (enemy.stepOffset ?? 0);

      if (timeRemaining < -BREACH_LATE_SEC) {
        if (this.practice) {
          this.takePracticeHit(enemy);
          continue;
        }
        this.triggerPlayerDeath(enemy);
        return;
      }
    }

    // Fists the player hit back reach the boss
    if (this.returningFists.length > 0) {
      const nowMs = performance.now();
      const landed = this.returningFists.filter((f) => nowMs - f.start >= RETURN_MS);
      this.returningFists = this.returningFists.filter((f) => nowMs - f.start < RETURN_MS);
      for (const f of landed) this.landReturnedFist(f);
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
    // Some tiers have their own pose between attacks (The Stallion's skipping rope)
    const tierRest = getMoveForCombo(this.scoreState.combo, this.currentMoveIndex, this.hero.moves).restPose;
    const restPose = idleBouncePose(tierRest ?? this.hero.idlePose, pulse, sway);

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

  /** Practice: an enemy got through. It counts as a miss and a hit taken, and the song goes on. */
  private takePracticeHit(enemy: Enemy) {
    enemy.defeated = true;
    this.practiceHits.push(this.songTime);
    this.scoreState.combo = 0;
    this.scoreState.missCount++;
    this.okStreak = 0;
    this.callbacks.onScoreUpdate({ ...this.scoreState });
    this.callbacks.onJudgement('MISS', 0);
    this.screenShake = Math.max(this.screenShake, 6);
    this.judgements.push({
      id: this.nextJudgementId++,
      text: 'MISS',
      x: enemy.lane === 'left' ? -this.hitLineOffset : this.hitLineOffset,
      y: -80,
      color: '#ff2a5f',
      createdAt: performance.now(),
      scale: 1.2,
      lane: enemy.lane,
    });
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x: enemy.lane === 'left' ? -20 : 20,
        y: -10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#ff2a5f',
        size: 2 + Math.random() * 3,
        alpha: 1.0,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.2,
        sparkType: 'line',
      });
    }
  }

  private triggerPlayerDeath(killer: Enemy) {
    this.isRunning = false;
    this.recordProgress(false);
    this.countRun(false, true);
    const report = explainDeath(
      {
        name: killer.bossAttack ? 'boss fist' : getEnemyStyle(killer.band, killer.tier).name,
        lane: killer.lane,
        targetTime: killer.targetTime,
      },
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

    // The results come up a moment later, unless a new song started in the gap (R pressed)
    const session = this.songSession;
    setTimeout(() => {
      if (session !== this.songSession) return;
      this.callbacks.onGameOver(this.scoreState, false, report);
    }, 700);
  }

  /** Save how far this run got, and compare it with the best attempt on this song. */
  private recordProgress(cleared: boolean) {
    if (!this.track || this.lastRun) return;
    const duration = Math.min(this.track.audioBuffer?.duration ?? this.track.duration, this.songEndAt);
    this.lastRun = this.practice || BOSS_TEST
      ? practiceRunProgress(this.track.id, this.songTime, duration, cleared, this.practiceHits, progressStore())
      : recordRunProgress(this.track.id, this.songTime, duration, cleared, progressStore());
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
    if (!this.track || this.practice || BOSS_TEST) return;
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
      const current = JSON.parse(progressStore()?.getItem(key) || '{}');
      const prevBest: HighScoreRecord | undefined = current[this.track.id];

      if (!prevBest || record.highScore > prevBest.highScore) {
        // A new best run, keeping the song's best combo even if this run's was lower
        current[this.track.id] = { ...record, maxCombo: Math.max(record.maxCombo, prevBest?.maxCombo ?? 0) };
        progressStore()?.setItem(key, JSON.stringify(current));
      } else if (record.maxCombo > prevBest.maxCombo) {
        // Not a better score, but a longer combo: the song's best combo is kept on its own
        current[this.track.id] = { ...prevBest, maxCombo: record.maxCombo };
        progressStore()?.setItem(key, JSON.stringify(current));
      }
    } catch {}
  }

  public getHighScore(trackId: string): HighScoreRecord | null {
    try {
      const key = `neon_strike_highscores_v1`;
      const current = JSON.parse(progressStore()?.getItem(key) || '{}');
      return current[trackId] || null;
    } catch {
      return null;
    }
  }

  public getAllHighScores(): Record<string, HighScoreRecord> {
    try {
      const key = `neon_strike_highscores_v1`;
      return JSON.parse(progressStore()?.getItem(key) || '{}');
    } catch {
      return {};
    }
  }
}

/** Where progress is kept: the CrazyGames data module there, localStorage everywhere else (see progressStore). */
function safeStorage() {
  return progressStore();
}
