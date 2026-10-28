import React, { useEffect } from 'react';
import { GameScoreState, Track } from '../types/game';
import type { ScoreComparison } from '../game/records';
import type { DeathReport } from '../game/timing';
import { formatSongTime, RunProgress } from '../game/runProgress';
import type { HeroId } from '../game/heroes';
import { RunProgressBar } from './RunProgressBar';
import { AdOffer, AdOfferButton, ArcadeScreen, SlantButton, useArcadeUnit } from './arcade/ui';

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
  /** How this run's score compared with the song's old best (null for practice): drives NEW RECORD */
  scoreRecord?: ScoreComparison | null;
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
  adOffer?: AdOffer;
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
  scoreRecord = null,
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

  // Beat your old best on this song: a NEW RECORD stamp, and the score row lit up with how much by.
  // (The first time you play a song it's just your first score.)
  const newRecord = !practice && !!scoreRecord?.newBest;
  const beatBy = newRecord && scoreRecord?.previousBest != null ? scoreState.score - scoreRecord.previousBest : 0;
  const firstScore = !practice && scoreRecord?.previousBest === null && scoreState.score > 0;
  const newCombo = !practice && !!scoreRecord?.newCombo;

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
        <div className="flex items-center" style={{ gap: u(2.4) }}>
          <div className="arc-display arc-stamp" style={{ fontSize: u(12), color: stampColor, textShadow: `${u(0.6)} ${u(0.6)} 0 #000, ${u(-0.4)} 0 0 var(--cyan)`, transformOrigin: 'left center', ['--tilt' as string]: '-4deg' }}>
            {stamp}
          </div>
          {/* Slams in just after the stamp */}
          {newRecord && (
            <div
              className="arc-display arc-stamp whitespace-nowrap"
              style={{ fontSize: u(4.6), lineHeight: 1, color: '#000', background: 'var(--yellow)', padding: `${u(1)} ${u(1.8)}`, boxShadow: `${u(0.6)} ${u(0.6)} 0 #000, 0 0 ${u(3)} rgba(255,230,0,0.55)`, animationDelay: '0.35s', ['--tilt' as string]: '6deg' }}
            >
              New record!
            </div>
          )}
        </div>
        <div className="font-bold text-[#ffc2d6] line-clamp-2" style={{ fontSize: `max(11px, ${u(2.7)})`, lineHeight: 1.25 }}>
          {why}
        </div>
        <div className="flex items-end" style={{ gap: u(2.4), marginTop: u(0.6) }}>
          <span className="arc-display" style={{ fontSize: u(17), lineHeight: 0.8, color: '#fff', WebkitTextStroke: `${u(0.3)} ${GRADE_COLORS[grade]}`, textShadow: `0 0 ${u(2)} ${GRADE_COLORS[grade]}` }}>
            {grade}
          </span>
          <div className="flex flex-col items-start" style={{ gap: u(0.8), paddingBottom: u(0.4) }}>
            {firstScore && <span className="arc-tag">FIRST SCORE</span>}
            {boss === 'ko' && <span className="arc-tag" style={{ background: 'var(--pink)', color: '#fff' }}>BOSS K.O.!</span>}
          </div>
        </div>
      </div>

      {/* Right: the numbers */}
      <div className="absolute flex flex-col" style={{ right: u(4), top: u(28), width: '44%', gap: u(1) }}>
        {(
          [
            ['Score', newRecord ? 'New record' : 'Score', scoreState.score.toLocaleString(), newRecord],
            ['Combo', newCombo ? 'New best combo' : 'Best combo', `${scoreState.maxCombo}×`, false],
            ['Accuracy', 'Accuracy', `${accuracy}%`, false],
          ] as const
        ).map(([key, label, value, lit], i) => (
          <div
            key={key}
            className="arc-strip arc-in-right flex items-center"
            style={{ height: u(7.4), padding: `0 ${u(4)}`, gap: u(2), animationDelay: `${0.05 + i * 0.05}s`, background: lit ? 'var(--yellow)' : undefined, color: lit ? '#000' : undefined }}
          >
            <span
              className="font-black tracking-[0.16em] uppercase whitespace-nowrap"
              style={{ fontSize: small, color: lit ? '#000' : key === 'Combo' && newCombo ? 'var(--cyan)' : 'var(--muted)' }}
            >
              {label}
            </span>
            {lit && beatBy > 0 && (
              <span className="arc-display whitespace-nowrap" style={{ fontSize: u(3.4), lineHeight: 1, color: 'var(--yellow)', background: '#000', padding: `${u(0.6)} ${u(1.2)}`, transform: 'skewX(-10deg)' }}>
                +{beatBy.toLocaleString()}
              </span>
            )}
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
        {/* Timing: when your presses were steadily off, one big button that fixes it (which way
            you were off is on the button); otherwise just a line saying how close you were */}
        {averageTimingErrorMs !== null &&
          (showSuggestion ? (
            <button
              type="button"
              disabled={appliedOffset !== null}
              onClick={() => {
                onApplyLatencyOffset!(suggestion!);
                setAppliedOffset(suggestion);
              }}
              className="arc-btn arc-in-right w-full"
              style={{
                height: u(9.4),
                justifyContent: 'space-between',
                padding: `0 ${u(4)}`,
                marginTop: u(0.6),
                animationDelay: '0.25s',
                background: appliedOffset !== null ? 'var(--panel)' : 'var(--cyan)',
                color: appliedOffset !== null ? 'var(--cyan)' : '#000',
              }}
              title="Your presses were steadily off: this moves the timing to match your setup"
            >
              <span className="font-black uppercase whitespace-nowrap not-italic" style={{ fontFamily: 'Outfit, sans-serif', fontSize: `max(10px, ${u(2.2)})`, letterSpacing: '0.14em' }}>
                {Math.abs(averageTimingErrorMs)} ms {averageTimingErrorMs < 0 ? 'early' : 'late'}
              </span>
              <span className="whitespace-nowrap" style={{ fontSize: u(4.6) }}>
                {appliedOffset !== null ? `✓ Timing fixed: ${appliedOffset} ms` : `Fix my timing: ${suggestion} ms`}
              </span>
            </button>
          ) : (
            <div className="font-bold" style={{ marginTop: u(0.6), fontSize: `max(11px, ${u(2.8)})`, color: 'var(--muted)' }}>
              Timing:{' '}
              <span className="text-white">
                {Math.abs(averageTimingErrorMs) <= 5 ? 'spot on' : `${Math.abs(averageTimingErrorMs)} ms ${averageTimingErrorMs < 0 ? 'early' : 'late'}`}
              </span>
            </div>
          ))}
      </div>

      {/* Buttons */}
      <div className="absolute flex items-end" style={{ left: u(5), right: u(4), bottom: u(3.5), gap: u(1.2) }}>
        {/* Menu and Songs, with the ad offer (when there is one) sitting right on top of them */}
        <div className="flex-[2] min-w-0 flex flex-col" style={{ gap: u(1.2) }}>
          {adOffer && <AdOfferButton offer={adOffer} />}
          <div className="flex" style={{ gap: u(1.2) }}>
            <SlantButton onClick={onMainMenu} className="flex-1" style={{ padding: 0, height: u(12), fontSize: u(3.8) }}>
              Menu
            </SlantButton>
            <SlantButton onClick={onOpenSelect} className="flex-1" style={{ padding: 0, height: u(12), fontSize: u(3.8) }}>
              Songs
            </SlantButton>
          </div>
        </div>
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
