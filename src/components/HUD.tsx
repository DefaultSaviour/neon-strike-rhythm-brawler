import React, { useState, useEffect } from 'react';
import { GameScoreState, Track, Lane } from '../types/game';
import { audioEngine } from '../audio/audioEngine';
import { formatSongTime } from '../game/runProgress';
import { Pause, RotateCcw, Music } from 'lucide-react';
import { FitText } from './arcade/ui';
import { fighterTier } from '../game/fighterTier';

const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * The in-song HUD, arcade style. Everything is sized in the arcade unit, so
 * it looks the same at every resolution and stays inside the 16:9 middle.
 * - Top: the song (tap for the song list), PRACTICE, the 1-button switch,
 *   restart and pause, then how far through the song you are.
 * - Score row (data-hud-scores): combo, rank and score. The canvas reads
 *   where these three blocks sit to keep the hit lists clear of them, and on
 *   a phone on its side it puts the lists in the gaps between them.
 * - Bottom: the tap zones for touch screens, with faint key hints.
 */

interface HUDProps {
  track: Track | null;
  scoreState: GameScoreState;
  /** How long the song plays (s) */
  length?: number;
  oneButtonMode?: boolean;
  onToggleOneButtonMode?: () => void;
  /** A practice run: shows a PRACTICE tag by the song name */
  practice?: boolean;
  onStrike: (lane: Lane, eventTimeStamp?: number) => void;
  onOneButtonStrike?: (eventTimeStamp?: number) => void;
  onPause: () => void;
  onRestart: () => void;
  onOpenSelect: () => void;
}

/** The letter rank for this run so far, and its colour */
function rankFor(accuracy: number, misses: number): { grade: string; color: string } {
  if (accuracy >= 98 && misses === 0) return { grade: 'SSS', color: 'var(--yellow)' };
  if (accuracy >= 94) return { grade: 'SS', color: 'var(--cyan)' };
  if (accuracy >= 90) return { grade: 'S', color: 'var(--pink)' };
  if (accuracy >= 80) return { grade: 'A', color: '#3dff9a' };
  if (accuracy >= 70) return { grade: 'B', color: '#6f9bff' };
  if (accuracy >= 60) return { grade: 'C', color: '#ffb020' };
  return { grade: 'D', color: 'var(--muted)' };
}

/** A small square slanted button in the top bar (44px at least, for thumbs) */
const BarButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button type="button" {...rest} className={`arc-btn hud-btn ${className}`}>
    {children}
  </button>
);

export const HUD: React.FC<HUDProps> = ({
  track,
  scoreState,
  length,
  oneButtonMode = false,
  onToggleOneButtonMode,
  practice = false,
  onStrike,
  onOneButtonStrike,
  onPause,
  onRestart,
  onOpenSelect,
}) => {
  const [playbackTime, setPlaybackTime] = useState(0);
  const [leftActive, setLeftActive] = useState(false);
  const [rightActive, setRightActive] = useState(false);
  const [singleActive, setSingleActive] = useState(false);

  useEffect(() => {
    let animId: number;
    const updateTime = () => {
      setPlaybackTime(audioEngine.getPlaybackTime());
      animId = requestAnimationFrame(updateTime);
    };
    animId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animId);
  }, []);

  const totalHits = scoreState.perfectCount + scoreState.goodCount + scoreState.okCount + scoreState.missCount;
  const accuracy =
    totalHits > 0
      ? Math.round(((scoreState.perfectCount * 100 + scoreState.goodCount * 70 + scoreState.okCount * 40) / (totalHits * 100)) * 100)
      : 100;
  const { grade, color: gradeColor } = rankFor(accuracy, scoreState.missCount);

  const duration = length && length > 0 ? length : track?.duration || 60;
  const progressRatio = Math.min(1, Math.max(0, playbackTime / duration));
  const multiplier = 1 + Math.floor(scoreState.combo / 10) * 0.5;
  const tier = fighterTier(scoreState.combo);

  const handleLeftDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setLeftActive(true);
    onStrike('left', e.timeStamp);
    setTimeout(() => setLeftActive(false), 90);
  };

  const handleRightDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setRightActive(true);
    onStrike('right', e.timeStamp);
    setTimeout(() => setRightActive(false), 90);
  };

  const handleSingleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setSingleActive(true);
    if (onOneButtonStrike) {
      onOneButtonStrike(e.timeStamp);
    } else {
      onStrike('left', e.timeStamp);
    }
    setTimeout(() => setSingleActive(false), 90);
  };

  const label: React.CSSProperties = { fontSize: `max(9px, ${u(1.9)})`, letterSpacing: '0.2em', color: 'var(--muted)', fontWeight: 900 };

  return (
    <div className="hud absolute inset-0 pointer-events-none z-10 flex flex-col">
      {/* Tap zones fill the whole screen behind the bars (a tap anywhere below the top bar strikes) */}
      {oneButtonMode ? (
        <div
          onPointerDown={handleSingleDown}
          className="absolute inset-0 pointer-events-auto select-none touch-none cursor-pointer"
          style={{ background: singleActive ? 'rgba(255, 230, 0, 0.1)' : undefined }}
        >
          <div className="absolute inset-x-0 flex justify-center" style={{ bottom: u(4) }}>
            <span className="arc-display hud-hint" style={{ color: 'var(--yellow)' }}>
              <span className="[@media(pointer:coarse)]:hidden">Space · </span>Tap anywhere to strike
            </span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex pointer-events-auto select-none touch-none">
          <div
            onPointerDown={handleLeftDown}
            className="flex-1 relative cursor-pointer"
            style={{ background: leftActive ? 'linear-gradient(90deg, rgba(0, 229, 255, 0.16), transparent 80%)' : undefined }}
          >
            <span className="arc-display hud-hint absolute" style={{ left: u(5), bottom: u(4), color: 'var(--cyan)' }}>
              <span className="[@media(pointer:coarse)]:hidden">◀ A · Strike left</span>
              <span className="hidden [@media(pointer:coarse)]:inline">◀ Tap to strike</span>
            </span>
          </div>
          <div
            onPointerDown={handleRightDown}
            className="flex-1 relative cursor-pointer"
            style={{ background: rightActive ? 'linear-gradient(270deg, rgba(255, 31, 109, 0.16), transparent 80%)' : undefined }}
          >
            <span className="arc-display hud-hint absolute" style={{ right: u(5), bottom: u(4), color: 'var(--pink)' }}>
              <span className="[@media(pointer:coarse)]:hidden">Strike right · D ▶</span>
              <span className="hidden [@media(pointer:coarse)]:inline">Tap to strike ▶</span>
            </span>
          </div>
        </div>
      )}

      {/* Practice: a big banner, up the whole song, so nobody misses that it's practice.
          A short game box (a phone on its side, or upright) has no room for it over the fight,
          so there only the PRACTICE tag in the top bar shows (see .hud .practice-banner). */}
      {practice && (
        <div className="practice-banner absolute inset-x-0 flex flex-col items-center text-center" style={{ top: u(35), gap: u(0.8) }}>
          <span className="arc-tag" style={{ fontSize: u(3.6), padding: `${u(0.5)} ${u(2.6)}`, letterSpacing: '0.3em' }}>
            PRACTICE
          </span>
          <span className="font-black" style={{ fontSize: u(2.2), color: 'var(--yellow)', textShadow: '0 2px 4px #000' }}>
            Getting hit won't end the song. Nothing counts toward unlocks.
          </span>
        </div>
      )}

      {/* The top, kept to the 16:9 middle */}
      <div className="relative mx-auto w-full flex flex-col" style={{ maxWidth: u(178), padding: `${u(3)} ${u(4)} 0`, gap: u(1.2) }}>
        <div className="flex items-center pointer-events-auto" style={{ gap: u(1.4) }}>
          <button type="button" onClick={onOpenSelect} className="arc-btn hud-song min-w-0" title="Pick another song">
            <Music className="shrink-0" style={{ width: u(2.6), height: u(2.6), minWidth: 13, minHeight: 13, color: 'var(--cyan)' }} />
            <FitText className="arc-display" style={{ fontSize: 'inherit' }}>{track?.title || 'Song'}</FitText>
          </button>
          {practice && <span className="arc-tag shrink-0">PRACTICE</span>}
          <div className="flex-1" />
          {onToggleOneButtonMode && (
            <BarButton onClick={onToggleOneButtonMode} className={`hud-mode ${oneButtonMode ? 'is-alt' : ''}`} title="Switch between one button and left & right">
              {oneButtonMode ? '1 Button' : 'Left & Right'}
            </BarButton>
          )}
          <BarButton onClick={onRestart} title="Restart the song (R)" aria-label="Restart">
            <RotateCcw style={{ width: '42%', height: '42%' }} />
          </BarButton>
          <BarButton onClick={onPause} title="Pause (Esc / Space)" aria-label="Pause">
            <Pause style={{ width: '42%', height: '42%' }} />
          </BarButton>
        </div>

        {/* How far through the song */}
        <div className="flex items-center" style={{ gap: u(1.6) }}>
          <div className="arc-strip relative flex-1" style={{ height: `max(6px, ${u(1.5)})`, background: 'rgba(20, 20, 31, 0.9)' }} aria-hidden="true">
            <div className="absolute inset-y-0 left-0" style={{ width: `${progressRatio * 100}%`, background: 'linear-gradient(90deg, var(--cyan), var(--pink) 60%, var(--yellow))' }} />
          </div>
          <span className="font-black tabular-nums whitespace-nowrap" style={{ fontSize: `max(10px, ${u(2.2)})`, color: 'var(--muted)' }}>
            <span style={{ color: '#fff' }}>{formatSongTime(playbackTime)}</span> / {formatSongTime(duration)}
          </span>
        </div>

        {/* What the enemies' colours mean */}
        <div className="flex items-center justify-center font-black uppercase select-none" style={{ gap: u(3), fontSize: `max(9px, ${u(1.8)})`, letterSpacing: '0.16em' }}>
          {[
            ['#ff1744', 'Sub / Kick', 'Sub & kicks (36–145 Hz): Titan, Breaker, Rammer'],
            ['#d84dff', 'Bassline', 'Bassline (105–300 Hz): Warlord, Ronin, Acid Dancer'],
            ['#00e5ff', 'Highs', 'Highs & leads (800–6500 Hz): Speeder, Wraith, Seraph'],
          ].map(([c, name, tip]) => (
            <span key={name} className="flex items-center" style={{ gap: u(0.8), color: c }} title={tip}>
              <span style={{ width: u(1.2), height: u(1.2), minWidth: 6, minHeight: 6, background: c, transform: 'skewX(-14deg)', boxShadow: `0 0 ${u(1)} ${c}` }} />
              {name}
            </span>
          ))}
        </div>

        {/* Combo, rank, score (the canvas reads where these three sit: keep them as the row's only children) */}
        <div data-hud-scores className="flex items-start justify-between" style={{ marginTop: u(0.4) }}>
          {/* The combo, as on the Fighters screen: a big yellow count that pops on every hit, and
              the fighter's tier name under it (the same tiers the fighter levels up through) */}
          <div className="flex flex-col items-start">
            <div className="flex items-baseline" style={{ gap: u(1) }}>
              <span
                key={scoreState.combo}
                className="arc-display arc-split tabular-nums hud-num"
                style={{
                  fontSize: u(9),
                  color: scoreState.combo > 0 ? 'var(--yellow)' : '#4a4f66',
                  animation: scoreState.combo > 0 ? 'arc-stamp 0.18s cubic-bezier(0.2, 0.9, 0.2, 1) both' : undefined,
                  ['--tilt' as string]: '0deg',
                }}
              >
                {scoreState.combo}
              </span>
              <span className="arc-display" style={{ fontSize: u(3), color: scoreState.combo > 0 ? '#fff' : '#4a4f66' }}>
                Hits
              </span>
            </div>
            <span
              key={tier.name}
              className="arc-display arc-stamp whitespace-nowrap"
              style={{ fontSize: u(3.2), color: scoreState.combo > 0 ? tier.color : '#4a4f66', marginTop: u(0.5), ['--tilt' as string]: '-4deg', textShadow: `${u(0.3)} ${u(0.3)} 0 #000` }}
            >
              {tier.name}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span style={label}>RANK</span>
            <span className="arc-display arc-split hud-num" style={{ fontSize: u(7.5), color: gradeColor }}>
              {grade}
            </span>
            <span className="font-black tabular-nums" style={{ fontSize: `max(9px, ${u(2)})`, color: 'var(--muted)' }}>
              {accuracy}% ACC
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span style={label}>SCORE</span>
            <span className="arc-display tabular-nums hud-num" style={{ fontSize: u(6), color: '#fff' }}>
              {scoreState.score.toLocaleString()}
            </span>
            {/* The combo's score bonus */}
            {multiplier > 1 && (
              <span className="arc-tag" style={{ fontSize: `max(9px, ${u(1.9)})`, padding: `${u(0.2)} ${u(1)}`, letterSpacing: '0.1em', marginTop: u(0.6) }}>
                ×{multiplier.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
