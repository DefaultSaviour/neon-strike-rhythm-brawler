import React, { useEffect } from 'react';
import { GameScoreState, Track, HighScoreRecord } from '../types/game';
import type { DeathReport } from '../game/timing';
import type { RunProgress } from '../game/runProgress';
import { getHero, HeroId } from '../game/heroes';
import { HERO_UNLOCKS } from '../game/heroUnlocks';
import { RunProgressBar } from './RunProgressBar';
import { RotateCcw, Music, Trophy, Flame, Target, Home, Play } from 'lucide-react';

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
  /** Heroes this run just unlocked */
  newUnlocks?: HeroId[];
  /** Switch to a hero (from the "play as them" button) */
  onPickHero?: (id: HeroId) => void;
  /**
   * A small, quiet offer under the buttons: what a rewarded ad would unlock
   * now (the big one is the last card of the unlock popup). `done` once watched.
   */
  adOffer?: { name: string; busy: boolean; done: boolean; notice?: string | null; onWatch: () => void };
  /** A practice run (nothing was saved), and how many hits were taken */
  practice?: boolean;
  practiceHits?: number;
  /** After practice: play the same song for real (the main button then) */
  onPlayForReal?: () => void;
  /** The end-of-song boss: knocked out, still standing, or never reached (null) */
  boss?: 'ko' | 'standing' | null;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  cleared,
  track,
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
  newUnlocks = [],
  onPickHero,
  adOffer,
  practice = false,
  practiceHits = 0,
  onPlayForReal,
  boss = null,
}) => {
  const forReal = practice && onPlayForReal;
  const [pickedHero, setPickedHero] = React.useState<HeroId | null>(null);
  const [appliedOffset, setAppliedOffset] = React.useState<number | null>(null);
  // Freeze the suggestion when the screen opens: once applied, the setting
  // changes, and recomputing from the same hits would count the error twice.
  const [suggestion] = React.useState(suggestedLatencyOffsetMs);
  const [offsetAtOpen] = React.useState(currentLatencyOffsetMs);
  // Only worth suggesting a change if it's a noticeable one.
  const showSuggestion =
    suggestion !== null && Math.abs(suggestion - offsetAtOpen) >= 15 && onApplyLatencyOffset !== undefined;
  const totalHits =
    scoreState.perfectCount + scoreState.goodCount + scoreState.okCount + scoreState.missCount;
  const accuracy =
    totalHits > 0
      ? Math.round(
          ((scoreState.perfectCount * 100 +
            scoreState.goodCount * 70 +
            scoreState.okCount * 40) /
            (totalHits * 100)) *
            100
        )
      : 0;

  let grade: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' = 'D';
  let gradeColor = 'text-slate-400 border-slate-600';
  if (accuracy >= 98 && scoreState.missCount === 0) {
    grade = 'SSS';
    gradeColor = 'text-amber-300 border-amber-300 drop-shadow-[0_0_15px_rgba(255,230,0,0.8)]';
  } else if (accuracy >= 94) {
    grade = 'SS';
    gradeColor = 'text-cyan-300 border-cyan-300 drop-shadow-[0_0_15px_rgba(0,243,255,0.8)]';
  } else if (accuracy >= 90) {
    grade = 'S';
    gradeColor = 'text-pink-400 border-pink-400 drop-shadow-[0_0_15px_rgba(255,0,127,0.8)]';
  } else if (accuracy >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-400 border-emerald-400';
  } else if (accuracy >= 70) {
    grade = 'B';
    gradeColor = 'text-blue-400 border-blue-400';
  } else if (accuracy >= 60) {
    grade = 'C';
    gradeColor = 'text-yellow-400 border-yellow-400';
  }

  const isNewHighScore =
    !practice && highScoreRecord && scoreState.score >= highScoreRecord.highScore && scoreState.score > 0;

  // Keyboard shortcut listener for fast instant retry: [R] or Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R' || e.code === 'Space') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div
        className={`w-full max-w-md bg-[#0b0d1e] border rounded-xl shadow-2xl p-6 flex flex-col items-center text-center ${
          cleared
            ? 'border-cyan-500/50 shadow-[0_0_40px_rgba(0,243,255,0.2)]'
            : 'border-pink-500/50 shadow-[0_0_40px_rgba(255,0,127,0.2)]'
        }`}
      >
        {/* Outcome Header */}
        <div className="w-full flex flex-col items-center mb-5">
          <div
            className={`text-2xl md:text-3xl font-black tracking-widest uppercase ${
              cleared
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500'
            }`}
          >
            {practice ? 'Practice Run' : cleared ? 'Track Cleared' : 'Defeated'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {practice
              ? `${practiceHits === 0 ? 'No hits taken!' : `You took ${practiceHits} hit${practiceHits === 1 ? '' : 's'} (red on the bar).`} Practice doesn't count toward unlocks or records.`
              : cleared
                ? 'Flawless rhythm execution'
                : 'An enemy breached your strike line!'}
          </div>
          {boss === 'ko' && (
            <div className="mt-3 px-4 py-1.5 rounded-lg bg-amber-400 text-black text-sm font-black tracking-[0.2em] shadow-[0_0_18px_rgba(255,213,74,0.6)]">
              BOSS KO!
            </div>
          )}
          {boss === 'standing' && cleared && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-slate-900/80 border border-amber-400/50 text-sm text-slate-200">
              <span className="font-bold text-amber-300">The Titan King is still standing.</span> PERFECT hits on its fists do the most damage.
            </div>
          )}
          {!cleared && deathReport && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/40 text-sm text-slate-200">
              <div className="font-bold text-red-300">
                Killed by a {deathReport.enemyName} on the {deathReport.lane.toUpperCase()}.
              </div>
              <div className="mt-0.5">{deathReport.reason}</div>
            </div>
          )}
          {runProgress && (
            <div className="mt-4 w-full self-stretch">
              <RunProgressBar run={runProgress} heroId={heroId} />
            </div>
          )}
          {newUnlocks.map((id) => {
            const hero = getHero(id);
            return (
              <div
                key={id}
                className="mt-3 w-full self-stretch px-3 py-2.5 rounded-lg bg-amber-400/10 border border-amber-400/60 shadow-[0_0_24px_rgba(255,194,58,0.25)] flex items-center gap-3 text-left"
              >
                <div className="flex-1">
                  <div className="text-[10px] font-black tracking-[0.2em] text-amber-300 uppercase">New hero unlocked</div>
                  <div className="text-sm font-bold text-white">{hero.label}</div>
                  <div className="text-[11px] text-slate-400">{HERO_UNLOCKS[id]?.label}: done!</div>
                </div>
                {onPickHero && (
                  <button
                    type="button"
                    onClick={() => {
                      onPickHero(id);
                      setPickedHero(id);
                    }}
                    disabled={pickedHero === id}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:bg-emerald-400 disabled:cursor-default cursor-pointer"
                  >
                    {pickedHero === id ? 'Selected' : 'Play as them'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Grade Badge */}
        <div className="relative mb-6">
          <div
            className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center font-black text-4xl font-mono bg-slate-900/80 ${gradeColor}`}
          >
            {grade}
          </div>
          {isNewHighScore && (
            <div className="absolute -top-2 -right-3 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shadow-[0_0_8px_rgba(255,230,0,0.8)]">
              New PB
            </div>
          )}
        </div>

        {/* Score & Combo Overview */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-4 mb-5 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              Final Score
            </span>
            <span className="font-mono font-bold text-lg text-slate-100 tabular-nums">
              {scoreState.score.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-pink-400" />
              Max Combo
            </span>
            <span className="font-mono font-bold text-lg text-cyan-400 tabular-nums">
              {scoreState.maxCombo}x
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              Accuracy
            </span>
            <span className="font-mono font-bold text-lg text-slate-100 tabular-nums">
              {accuracy}%
            </span>
          </div>

          <div className="h-px bg-slate-800 my-1" />

          {/* Hit Breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-cyan-400 font-bold">{scoreState.perfectCount}</span>
              <span className="text-[10px] text-slate-500">PERFECT</span>
            </div>
            <div className="flex flex-col">
              <span className="text-pink-400 font-bold">{scoreState.goodCount}</span>
              <span className="text-[10px] text-slate-500">GOOD</span>
            </div>
            <div className="flex flex-col">
              <span className="text-amber-400 font-bold">{scoreState.okCount}</span>
              <span className="text-[10px] text-slate-500">OK</span>
            </div>
            <div className="flex flex-col">
              <span className="text-red-400 font-bold">{scoreState.missCount}</span>
              <span className="text-[10px] text-slate-500">MISS</span>
            </div>
          </div>
        </div>

        {/* Timing feedback: tells players which way they're off, and offers a fix */}
        {averageTimingErrorMs !== null && (
          <div className="w-full mb-4 p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Your average timing</span>
              <span className="font-mono font-bold text-slate-100">
                {Math.abs(averageTimingErrorMs) <= 5
                  ? 'spot on'
                  : `${Math.abs(averageTimingErrorMs)} ms ${averageTimingErrorMs < 0 ? 'early' : 'late'}`}
              </span>
            </div>
            {showSuggestion && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Consistently {averageTimingErrorMs < 0 ? 'early' : 'late'}? Your audio may be delayed.
                </span>
                <button
                  onClick={() => {
                    onApplyLatencyOffset!(suggestion!);
                    setAppliedOffset(suggestion);
                  }}
                  disabled={appliedOffset !== null}
                  className="shrink-0 px-2.5 py-1.5 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono font-bold hover:bg-cyan-900 disabled:opacity-60 cursor-pointer"
                >
                  {appliedOffset !== null
                    ? `Offset set to ${appliedOffset} ms`
                    : `Set offset to ${suggestion} ms`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          {/* After practice, the main button is the real thing */}
          {forReal && (
            <button
              onClick={onPlayForReal}
              className="w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wide shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play for Real</span>
            </button>
          )}
          <button
            onClick={onRestart}
            className={
              forReal
                ? 'w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/60 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer'
                : 'w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wide shadow-[0_0_15px_rgba(0,243,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer'
            }
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {forReal ? 'Practice Again' : 'Restart Song'}
              <span className="[@media(pointer:coarse)]:hidden"> (Press Space / R)</span>
            </span>
          </button>

          <button
            onClick={onOpenSelect}
            className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Music className="w-4 h-4 text-cyan-400" />
            <span>Choose Another Track</span>
          </button>

          <button
            onClick={onMainMenu}
            className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4 text-cyan-400" />
            <span>Main Menu</span>
          </button>
        </div>

        {/* Kept small on purpose: the real offer is in the unlock popup */}
        {adOffer && (
          <div className="mt-3 text-[11px] text-slate-500">
            {adOffer.done ? (
              <span className="text-amber-300">{adOffer.name} unlocked and equipped!</span>
            ) : (
              <button
                type="button"
                onClick={adOffer.onWatch}
                disabled={adOffer.busy}
                className="min-h-8 px-2 text-cyan-300/80 hover:text-cyan-200 underline decoration-dotted underline-offset-2 disabled:opacity-60 cursor-pointer"
              >
                {adOffer.busy ? 'Loading ad…' : `▶ Watch an ad to unlock ${adOffer.name} now`}
              </button>
            )}
            {adOffer.notice && !adOffer.done && <div className="text-pink-300/80">{adOffer.notice}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
