import type { Lane, TimingJudgementType } from '../types/game';

/**
 * The hit lists up the sides of the screen: every hit or miss on the left
 * lane goes in the left list, the right lane in the right list. Each line
 * is the judgement (PERFECT, GOOD, OK, MISS), EARLY/LATE when it was off,
 * and the move the hit was. The newest line comes in at the bottom and the
 * older ones scroll up and fade, so nothing ever pops up over the fight.
 */

export interface HitLogEntry {
  id: number;
  lane: Lane;
  text: TimingJudgementType;
  /** For hits that weren't PERFECT: which way the press was off */
  detail?: 'EARLY' | 'LATE';
  /** The move the hit was ("Flying Knee"); none for a miss */
  move?: string;
  /** performance.now() when it happened */
  at: number;
}

/** How long a line stays up (seconds), the last part of it fading out */
export const HIT_LOG_SECONDS = 5;
export const HIT_LOG_FADE_SECONDS = 1;
/** Lines per side: the same on every screen that has room for them */
export const HIT_LOG_MAX_ROWS = 6;

export const JUDGEMENT_COLORS: Record<TimingJudgementType, string> = {
  PERFECT: '#00f3ff',
  GOOD: '#ff007f',
  OK: '#ffe600',
  MISS: '#ff2a5f',
};

/** Add a line: keeps at most HIT_LOG_MAX_ROWS per side, dropping the oldest. */
export function addHitLog(log: HitLogEntry[], entry: HitLogEntry): HitLogEntry[] {
  const next = [...log, entry];
  const side = next.filter((e) => e.lane === entry.lane);
  if (side.length <= HIT_LOG_MAX_ROWS) return next;
  const drop = side[0];
  return next.filter((e) => e !== drop);
}

/** Lines still up at `now` (ms). */
export function liveHitLog(log: HitLogEntry[], now: number): HitLogEntry[] {
  return log.filter((e) => now - e.at < HIT_LOG_SECONDS * 1000);
}

/** Where the lists go on screen, in CSS pixels. */
export interface HitLogArea {
  /** The left list's left edge */
  leftX: number;
  /** The right list's right edge (its lines are right-aligned) */
  rightX: number;
  /** How wide a line may be */
  maxWidth: number;
  /** The newest line's baseline (the bottom of the list) */
  bottom: number;
  /** Height of one line */
  lineH: number;
  /** How many lines fit */
  rows: number;
}

/**
 * The HUD's score row, so the lists stay clear of it: its outline, and the
 * inner edges of its three blocks (combo on the left, rank in the middle,
 * score on the right).
 */
export interface HudBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Right edge of the combo counter */
  comboRight: number;
  /** Left and right edges of the rank */
  rankLeft: number;
  rankRight: number;
  /** Left edge of the score */
  scoreLeft: number;
}

/** Fewest lines worth showing in the sky; with less room than this, the lists move up into the score row */
const MIN_SKY_ROWS = 3;

/**
 * The lists look the same on every screen, just scaled with the fight: six
 * lines a side, rising from the horizon (`horizon`), dipping below it if
 * that's what it takes to fit all six, but never below `lowest` (clear of
 * the fighters' and enemies' heads), at the edges of the 16:9 middle of the screen (so on
 * ultra-wide screens they stay near the fight), with text sized to the
 * fighters (`scale`, screen pixels per world unit). They stay below the
 * score row and narrow enough to leave the middle clear (the fighter, the
 * PRACTICE banner). Only when there's no sky left under the score row (a
 * phone on its side) do they switch, to the score row's gaps: between the
 * combo and the rank, and between the rank and the score.
 */
export function hitLogArea(width: number, height: number, horizon: number, lowest: number, scale: number, hud: HudBox | null): HitLogArea {
  const lineH = Math.max(14, Math.min(34, 13 * scale));
  const inset = width >= 768 ? 24 : 16;
  const box = Math.min(width, (height * 16) / 9);
  const margin = (width - box) / 2;
  const maxWidth = Math.min(15 * lineH, box * 0.3);
  // Below the score row, unless the lists sit entirely beside it
  const besideRow = hud && margin + inset + maxWidth <= hud.left - 12;
  const top = besideRow || !hud ? inset : hud.bottom + 6;
  const skyBottom = Math.min(lowest, Math.max(horizon, top + HIT_LOG_MAX_ROWS * lineH));
  // (a hair of slack, so a line that fits to the pixel isn't dropped)
  const skyRows = Math.floor((skyBottom - top) / lineH + 0.15);
  if (skyRows >= MIN_SKY_ROWS || !hud) {
    return { leftX: margin + inset, rightX: width - margin - inset, maxWidth, bottom: skyBottom, lineH, rows: Math.max(1, Math.min(HIT_LOG_MAX_ROWS, skyRows)) };
  }
  // A phone on its side: in the score row's gaps
  const gap = 12;
  const rowLineH = Math.max(14, Math.min(18, lineH));
  const gapWidth = Math.min(hud.rankLeft - hud.comboRight, hud.scoreLeft - hud.rankRight) - gap * 2;
  return {
    leftX: hud.comboRight + gap,
    rightX: hud.scoreLeft - gap,
    maxWidth: Math.max(80, gapWidth),
    bottom: hud.bottom - 4,
    lineH: rowLineH,
    rows: Math.max(1, Math.min(HIT_LOG_MAX_ROWS, Math.floor((hud.bottom - hud.top) / rowLineH))),
  };
}
