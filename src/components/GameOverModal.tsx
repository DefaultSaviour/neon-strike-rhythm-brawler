import React, { useEffect } from 'react';
import { GameScoreState, Track, HighScoreRecord } from '../types/game';
import type { DeathReport } from '../game/timing';
import { formatSongTime, RunProgress } from '../game/runProgress';
import type { HeroId } from '../game/heroes';
import { RunProgressBar } from './RunProgressBar';
import { ArcadeScreen, SlantButton, useArcadeUnit } from './arcade/ui';

/**
 * The results screen, arcade style, all on one screen (no scrolling, even
 * on a phone on its side): how far you got along the top, a stamp
 * (DEFEATED / CLEARED! / PRACTICE) with why and your grade on the left,
 * the numbers on the right, and the buttons along the bottom with Retry
 * the biggest. R or Space retries.
 */

interface GameOverModalProps {
  cleared: boolean;
  track: Track | null;
  scoreState: GameScoreState;
  highScoreRecord: HighScoreRecord | null;
  onRestart: () => void;
  onOpenSelect: () => void;
  /** Back to the title screen */
  onMainMenu: () => void;
  /** Median press-minus-beat error in ms (positive = late), or null if no hits */
  averageTimingErrorMs?: number | null;
  /** Current latency setting (ms) */
  currentLatencyOffsetMs?: number;
  /** Latency offset suggested from this run's hits, or null if not enough data */
  suggestedLatencyOffsetMs?: number | null;
  onApplyLatencyOffset?: (offsetMs: number) => void;
  /** Why the run ended, when an enemy got through */
  deathReport?: DeathReport | null;
  /** How far through the song this run got (drives the progress bar) */
  runProgress?: RunProgress | null;
  /** The hero you played (the progress-bar runner is drawn as them) */
  heroId?: HeroId;
  /**
   * A small, quiet offer: what a rewarded ad would unlock now (the big one
   * is the last card of the unlock popup). `done` once watched.
   */
  adOffer?: { name: string; busy: boolean; done: boolean; notice?: string | null; onWatch: () => void };
  /** A practice run (nothing was saved), and how many hits were taken */
  practice?: boolean;
  practiceHits?: number;
  /** After practice: play the same song for real (the main button then) */
  onPlayForReal?: () => void;
  /** After a real run: play the same song as practice (getting hit doesn't end it) */
  onPractice?: () => void;
  /** The end-of-song boss: knocked out, still standing, or never reached (null) */
  boss?: 'ko' | 'standing' | null;
  /** Which boss it was ("Titan King") */
  bossName?: string;
}

type Grade = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
const GRADE_COLORS: Record<Grade, string> = {
  SSS: '#ffe600',
  SS: '#00e5ff',
  S: '#ff1f6d',
  A: '#34f5a0',
  B: '#6ea8ff',
  C: '#ffb347',
  D: '#8d95b3',
};

const u = (n: number) => `calc(var(--u) * ${n})`;
/** The progress bar's own canvas height, in px (its caption is written here instead, at a readable size) */
const BAR_HEIGHT = 150;

export const GameOverModal: React.FC<GameOverModalProps> = ({
  cleared,
  scoreState,
  highScoreRecord,
  onRestart,
  onOpenSelect,
  onMainMenu,
  averageTimingErrorMs = null,
  currentLatencyOffsetMs = 0,
  suggestedLatencyOffsetMs = null,
  onApplyLatencyOffset,
  deathReport = null,
  runProgress = null,
  heroId,
  adOffer,
  practice = false,
  practiceHits = 0,
  onPlayForReal,
  onPractice,
  boss = null,
  bossName = 'boss',
}) => {
  const unit = useArcadeUnit();
  const forReal = practice && onPlayForReal;
  const [appliedOffset, setAppliedOffset] = React.useState<number | null>(null);
  // Freeze the suggestion when the screen opens: once applied, the setting
  // changes, and recomputing from the same hits would count the error twice.
  const [suggestion] = React.useState(suggestedLatencyOffsetMs);
  const [offsetAtOpen] = React.useState(currentLatencyOffsetMs);
  // Only worth suggesting a change if it's a noticeable one.
  const showSuggestion = suggestion !== null && Math.abs(suggestion - offsetAtOpen) >= 15 && onApplyLatencyOffset !== undefined;

  const totalHits = scoreState.perfectCount + scoreState.goodCount + scoreState.okCount + scoreState.missCount;
  const accuracy =
    totalHits > 0
      ? Math.round(((scoreState.perfectCount * 100 + scoreState.goodCount * 70 + scoreState.okCount * 40) / (totalHits * 100)) * 100)
      : 0;
  let grade: Grade = 'D';
  if (accuracy >= 98 && scoreState.missCount === 0) grade = 'SSS';
  else if (accuracy >= 94) grade = 'SS';
  else if (accuracy >= 90) grade = 'S';
  else if (accuracy >= 80) grade = 'A';
  else if (accuracy >= 70) grade = 'B';
  else if (accuracy >= 60) grade = 'C';

  const isNewHighScore = !practice && highScoreRecord && scoreState.score >= highScoreRecord.highScore && scoreState.score > 0;

  // R or Space: straight back in. Caught first, so the game's own R key doesn't restart a second time.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyR' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onRestart();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onRestart]);

  const stamp = practice ? 'Practice' : cleared ? 'Cleared!' : 'Defeated';
  const stampColor = practice ? 'var(--yellow)' : cleared ? 'var(--cyan)' : 'var(--pink)';
  const why = practice
    ? `${practiceHits === 0 ? 'No hits taken!' : `You took ${practiceHits} hit${practiceHits === 1 ? '' : 's'} (red on the bar).`} Practice doesn't count toward unlocks or records.`
    : !cleared && deathReport
      ? `Killed by a ${deathReport.enemyName} on the ${deathReport.lane}. ${deathReport.reason}`
      : cleared && boss === 'standing'
        ? `The ${bossName} survived. Hit back every fist to knock it out.`
        : cleared
          ? 'You made it to the end of the song.'
          : 'An enemy got through.';

  // The progress bar is drawn at a fixed height; scale it to fit the top of the screen
  const barScale = (unit * 18) / BAR_HEIGHT;
  const best = runProgress?.previousBest ?? null;
  const small = `max(10px, ${u(2.3)})`;

  return (
    <ArcadeScreen label="Results">
      {/* How far you got */}
      {runProgress && (
        <div className="absolute" style={{ left: u(5), right: u(5), top: u(2), height: u(23) }}>
          <div style={{ width: `${100 / barScale}%`, transform: `scale(${barScale})`, transformOrigin: '0 0' }}>
            <RunProgressBar run={runProgress} heroId={heroId} hideCaption />
          </div>
          <div className="absolute inset-x-0 flex justify-between font-black uppercase tracking-[0.12em]" style={{ top: u(18.6), fontSize: small }}>
            <span className="text-[color:var(--muted)]">
              {runProgress.hits ? (
                `${runProgress.hits.length} hit${runProgress.hits.length === 1 ? '' : 's'} taken`
              ) : runProgress.cleared ? (
                'Whole song cleared'
              ) : (
                <>
                  Made it to {formatSongTime(runProgress.reachedSec)} <span className="text-white">· {Math.round(runProgress.fraction * 100)}%</span>
                </>
              )}
            </span>
            <span className={runProgress.isNewBest && best !== null ? 'text-[color:var(--yellow)]' : 'text-[color:var(--muted)]'}>
              {best === null ? 'First attempt' : runProgress.isNewBest ? `New best! Was ${Math.round(best * 100)}%` : `Best ${Math.round(best * 100)}%`}
            </span>
          </div>
        </div>
      )}

      {/* Left: the stamp, why, and the grade */}
      <div className="absolute flex flex-col items-start" style={{ left: u(6), top: u(31), width: '44%', gap: u(1.4) }}>
        <div className="arc-display arc-stamp" style={{ fontSize: u(12), color: stampColor, textShadow: `${u(0.6)} ${u(0.6)} 0 #000, ${u(-0.4)} 0 0 var(--cyan)`, transformOrigin: 'left center', ['--tilt' as string]: '-4deg' }}>
          {stamp}
        </div>
        <div className="font-bold text-[#ffc2d6] line-clamp-2" style={{ fontSize: `max(11px, ${u(2.7)})`, lineHeight: 1.25 }}>
          {why}
        </div>
        <div className="flex items-end" style={{ gap: u(2.4), marginTop: u(0.6) }}>
          <span className="arc-display" style={{ fontSize: u(17), lineHeight: 0.8, color: '#fff', WebkitTextStroke: `${u(0.3)} ${GRADE_COLORS[grade]}`, textShadow: `0 0 ${u(2)} ${GRADE_COLORS[grade]}` }}>
            {grade}
          </span>
          <div className="flex flex-col items-start" style={{ gap: u(0.8), paddingBottom: u(0.4) }}>
            {isNewHighScore && <span className="arc-tag">NEW BEST</span>}
            {boss === 'ko' && <span className="arc-tag" style={{ background: 'var(--pink)', color: '#fff' }}>BOSS K.O.!</span>}
            {adOffer &&
              (adOffer.done ? (
                <span className="font-bold text-[color:var(--yellow)]" style={{ fontSize: small }}>
                  {adOffer.name} unlocked and equipped!
                </span>
              ) : (
                <button
                  type="button"
                  onClick={adOffer.onWatch}
                  disabled={adOffer.busy}
                  className="text-left font-bold text-[color:var(--cyan)] underline decoration-dotted underline-offset-2 disabled:opacity-60 cursor-pointer"
                  style={{ fontSize: small, minHeight: 32 }}
                >
                  {adOffer.busy ? 'Loading ad…' : `▶ Watch an ad: unlock ${adOffer.name} now`}
                </button>
              ))}
            {adOffer?.notice && !adOffer.done && <span className="text-pink-300" style={{ fontSize: small }}>{adOffer.notice}</span>}
          </div>
        </div>
      </div>

      {/* Right: the numbers */}
      <div className="absolute flex flex-col" style={{ right: u(4), top: u(28), width: '44%', gap: u(1) }}>
        {(
          [
            ['Score', scoreState.score.toLocaleString()],
            ['Best combo', `${scoreState.maxCombo}×`],
            ['Accuracy', `${accuracy}%`],
          ] as const
        ).map(([label, value], i) => (
          <div key={label} className="arc-strip arc-in-right flex items-center" style={{ height: u(7.4), padding: `0 ${u(4)}`, animationDelay: `${0.05 + i * 0.05}s` }}>
            <span className="font-black tracking-[0.16em] uppercase text-[color:var(--muted)]" style={{ fontSize: small }}>
              {label}
            </span>
            <b className="arc-display ml-auto" style={{ fontSize: u(5) }}>
              {value}
            </b>
          </div>
        ))}
        <div className="grid grid-cols-4 arc-in-right" style={{ gap: u(0.8), animationDelay: '0.2s' }}>
          {(
            [
              ['Perfect', scoreState.perfectCount, '#00e5ff', '#000'],
              ['Good', scoreState.goodCount, '#ff1f6d', '#fff'],
              ['OK', scoreState.okCount, '#ffe600', '#000'],
              ['Miss', scoreState.missCount, '#2c3250', '#fff'],
            ] as const
          ).map(([label, n, bg, fg]) => (
            <div key={label} className="flex flex-col items-center justify-center font-black uppercase" style={{ height: u(8.6), background: bg, color: fg, transform: 'skewX(-10deg)', fontSize: `max(9px, ${u(1.8)})`, letterSpacing: '0.12em' }}>
              {label}
              <b className="arc-display" style={{ fontSize: u(4.2), letterSpacing: 0 }}>
                {n}
              </b>
            </div>
          ))}
        </div>
        {/* Timing: which way you're off, and a fix */}
        {averageTimingErrorMs !== null && (
          <div className="flex items-center justify-between" style={{ gap: u(1.6), marginTop: u(0.4), fontSize: small }}>
            <span className="text-[color:var(--muted)] font-bold">
              Timing:{' '}
              <span className="text-white">
                {Math.abs(averageTimingErrorMs) <= 5 ? 'spot on' : `${Math.abs(averageTimingErrorMs)} ms ${averageTimingErrorMs < 0 ? 'early' : 'late'}`}
              </span>
            </span>
            {showSuggestion && (
              <SlantButton
                size="sm"
                disabled={appliedOffset !== null}
                onClick={() => {
                  onApplyLatencyOffset!(suggestion!);
                  setAppliedOffset(suggestion);
                }}
                style={{ fontSize: `max(11px, ${u(2.6)})` }}
                title="Your presses were consistently off: this moves the timing to match your setup"
              >
                {appliedOffset !== null ? `Offset set: ${appliedOffset} ms` : `Fix it: ${suggestion} ms`}
              </SlantButton>
            )}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="absolute flex" style={{ left: u(5), right: u(4), bottom: u(3.5), gap: u(1.2) }}>
        <SlantButton onClick={onMainMenu} className="flex-1" style={{ padding: 0, height: u(12), fontSize: u(3.8) }}>
          Menu
        </SlantButton>
        <SlantButton onClick={onOpenSelect} className="flex-1" style={{ padding: 0, height: u(12), fontSize: u(3.8) }}>
          Songs
        </SlantButton>
        {forReal ? (
          <>
            <SlantButton variant="alt" hotkey="R" onClick={onRestart} className="flex-[1.3]" style={{ padding: 0, height: u(12), fontSize: u(3.8) }}>
              Practice again
            </SlantButton>
            <SlantButton variant="hot" onClick={onPlayForReal} className="flex-[2] arc-pulse" style={{ padding: 0, height: u(12), fontSize: u(6) }}>
              Fight for real
            </SlantButton>
          </>
        ) : (
          <>
            {!practice && onPractice && (
              <SlantButton
                variant="alt"
                onClick={onPractice}
                className="flex-[1.3]"
                style={{ padding: 0, height: u(12), fontSize: u(3.8) }}
                title="Practice: getting hit doesn't end the song, and nothing counts toward unlocks or records"
              >
                Practice
              </SlantButton>
            )}
            <SlantButton variant="hot" hotkey="SPACE" onClick={onRestart} className="flex-[2] arc-pulse" style={{ padding: 0, height: u(12), fontSize: u(6.4) }}>
              Retry
            </SlantButton>
          </>
        )}
      </div>
    </ArcadeScreen>
  );
};
