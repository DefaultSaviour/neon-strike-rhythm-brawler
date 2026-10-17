import React, { useState, useEffect } from 'react';
import { GameScoreState, Track, Lane } from '../types/game';
import { audioEngine } from '../audio/audioEngine';
import { Pause, RotateCcw, Volume2, Music } from 'lucide-react';

interface HUDProps {
  track: Track | null;
  scoreState: GameScoreState;
  oneButtonMode?: boolean;
  onToggleOneButtonMode?: () => void;
  onStrike: (lane: Lane, eventTimeStamp?: number) => void;
  onOneButtonStrike?: (eventTimeStamp?: number) => void;
  onPause: () => void;
  onRestart: () => void;
  onOpenSelect: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  track,
  scoreState,
  oneButtonMode = false,
  onToggleOneButtonMode,
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
      : 100;

  // Grade calculation
  let grade = 'D';
  let gradeColor = 'text-slate-400';
  if (accuracy >= 98 && scoreState.missCount === 0) {
    grade = 'SSS';
    gradeColor = 'text-amber-300 drop-shadow-[0_0_12px_rgba(255,230,0,0.8)]';
  } else if (accuracy >= 94) {
    grade = 'SS';
    gradeColor = 'text-cyan-300 drop-shadow-[0_0_10px_rgba(0,243,255,0.7)]';
  } else if (accuracy >= 90) {
    grade = 'S';
    gradeColor = 'text-pink-400 drop-shadow-[0_0_8px_rgba(255,0,127,0.7)]';
  } else if (accuracy >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-400';
  } else if (accuracy >= 70) {
    grade = 'B';
    gradeColor = 'text-blue-400';
  } else if (accuracy >= 60) {
    grade = 'C';
    gradeColor = 'text-yellow-400';
  }

  const duration = track?.duration || 60;
  const progressRatio = Math.min(1, playbackTime / duration);
  const multiplier = 1 + Math.floor(scoreState.combo / 10) * 0.5;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10">
      {/* Top Header & Song Progress */}
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center justify-between text-xs tracking-wider text-slate-300">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSelect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900/80 border border-slate-700/80 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer text-xs font-semibold"
              title="Select Track"
            >
              <Music className="w-3.5 h-3.5 text-cyan-400" />
              <span className="truncate max-w-[140px] md:max-w-[200px]">
                {track?.title || 'Track'}
              </span>
            </button>

            <span className="hidden md:inline text-slate-500 font-mono text-xs">
              {track?.artist} · {track?.bpm} BPM
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onToggleOneButtonMode && (
              <button
                onClick={onToggleOneButtonMode}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  oneButtonMode
                    ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(255,230,0,0.35)]'
                    : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-cyan-400'
                }`}
                title="Toggle One-Button Mode (Auto-targets nearest beat enemy)"
              >
                <span>Mode:</span>
                <span className={oneButtonMode ? 'text-amber-300 font-black' : 'text-cyan-400 font-semibold'}>
                  {oneButtonMode ? '1-Button' : '2-Button'}
                </span>
              </button>
            )}

            <button
              onClick={onRestart}
              className="p-1.5 rounded bg-slate-900/80 border border-slate-700/80 hover:border-pink-500 hover:text-pink-400 transition-colors cursor-pointer"
              title="Restart Track (R)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onPause}
              className="p-1.5 rounded bg-slate-900/80 border border-slate-700/80 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Pause (Esc / Space)"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>

            <div className="font-mono text-xs text-slate-400 ml-1">
              <span className="text-slate-200">{formatTime(playbackTime)}</span> / {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Neon Progress Bar */}
        <div className="w-full h-1.5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-800 relative">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-300 transition-all duration-100 shadow-[0_0_10px_rgba(0,243,255,0.8)]"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        {/* Acoustic Frequency Band Legend */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 text-[10px] tracking-wider uppercase font-mono font-semibold text-slate-400 select-none py-0.5">
          <div className="flex items-center gap-1.5" title="Sub & Kicks (36-145 Hz) • Titan, Breaker, Rammer">
            <span className="w-2 h-2 rounded-full bg-[#ff1744] shadow-[0_0_8px_#ff1744]" />
            <span className="text-[#ff8a80]">Sub / Kick</span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1.5" title="Bassline (105-300 Hz) • Warlord, Ronin, Acid Dancer">
            <span className="w-2 h-2 rounded-full bg-[#d84dff] shadow-[0_0_8px_#d84dff]" />
            <span className="text-[#e1c4ff]">Bassline</span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1.5" title="Highs & Leads (800-6500 Hz) • Speeder, Wraith, Seraph">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]" />
            <span className="text-[#a5f3fc]">Highs</span>
          </div>
        </div>

        {/* Dynamic In-Game HUD: Score, Combo, Grade */}
        <div className="flex items-center justify-between mt-2">
          {/* Left: Combo Counter */}
          <div className="flex flex-col">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Chain Combo
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl md:text-4xl font-extrabold tracking-tight font-mono tabular-nums transition-all ${
                  scoreState.combo > 20
                    ? 'text-cyan-400 drop-shadow-[0_0_12px_rgba(0,243,255,0.9)]'
                    : scoreState.combo > 0
                    ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(255,0,127,0.8)]'
                    : 'text-slate-600'
                }`}
              >
                {scoreState.combo}x
              </span>
              {multiplier > 1 && (
                <span className="text-xs font-mono font-bold text-amber-300">
                  {multiplier.toFixed(1)}x Bonus
                </span>
              )}
            </div>
          </div>

          {/* Center: Letter Grade */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Rank
            </div>
            <div className={`text-2xl md:text-3xl font-black font-mono tracking-tighter ${gradeColor}`}>
              {grade}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {accuracy}% Acc
            </div>
          </div>

          {/* Right: Score */}
          <div className="flex flex-col items-end">
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Score
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono tabular-nums text-slate-100 tracking-wider">
              {scoreState.score.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Touch Strike Zones for Mobile / Touch Screen */}
      {oneButtonMode ? (
        <div className="w-full flex-1 flex pointer-events-auto mt-6">
          <div
            onPointerDown={handleSingleDown}
            className={`w-full flex-1 flex flex-col justify-end items-center pb-8 border-t border-amber-500/20 cursor-pointer select-none transition-colors ${
              singleActive ? 'bg-amber-400/20' : 'hover:bg-amber-400/5'
            }`}
          >
            <div className="flex items-center gap-3 text-amber-300 text-xs font-bold tracking-widest uppercase bg-slate-950/80 px-4 py-2 rounded-full border border-amber-400/50 shadow-[0_0_15px_rgba(255,230,0,0.3)]">
              <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-400/80 text-[11px] font-mono font-black text-amber-300">
                [SPACE] · [TAP ANYWHERE]
              </span>
              <span>One-Button Strike (Auto-Targets Nearest Beat)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex-1 flex pointer-events-auto mt-6">
          {/* Left Strike Zone */}
          <div
            onPointerDown={handleLeftDown}
            className={`flex-1 flex flex-col justify-end pb-8 pl-6 border-r border-cyan-500/10 cursor-pointer select-none transition-colors ${
              leftActive ? 'bg-cyan-500/15' : 'hover:bg-cyan-500/5'
            }`}
          >
            <div className="flex items-center gap-2 opacity-50 text-cyan-400 text-xs font-bold tracking-widest uppercase">
              <span className="px-2 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono">
                [←] or [A]
              </span>
              <span>Strike Left</span>
            </div>
          </div>

          {/* Right Strike Zone */}
          <div
            onPointerDown={handleRightDown}
            className={`flex-1 flex flex-col justify-end pb-8 pr-6 items-end border-l border-pink-500/10 cursor-pointer select-none transition-colors ${
              rightActive ? 'bg-pink-500/15' : 'hover:bg-pink-500/5'
            }`}
          >
            <div className="flex items-center gap-2 opacity-50 text-pink-400 text-xs font-bold tracking-widest uppercase">
              <span>Strike Right</span>
              <span className="px-2 py-1 rounded bg-pink-950/80 border border-pink-500/40 text-[10px] font-mono">
                [→] or [D]
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
