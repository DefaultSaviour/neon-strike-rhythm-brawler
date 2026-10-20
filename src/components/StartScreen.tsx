import React, { useEffect, useState } from 'react';
import { Play, Lock, Sliders, Clapperboard, Trophy, Users } from 'lucide-react';

/**
 * The title screen: the game's name and five big choices. Works with the
 * mouse, a tap, or the keyboard (Up / Down to move, Enter or Space to pick).
 */

export type StartChoice = 'newGame' | 'unlocks' | 'stances' | 'records' | 'options' | 'studio';

interface StartScreenProps {
  onChoose: (choice: StartChoice) => void;
  /** The hero you'll play as */
  heroLabel: string;
  unlockedHeroes: number;
  totalHeroes: number;
  oneButtonMode: boolean;
  /** Countdown to the next enemy stance ("12:05"), or null when they're all open */
  stanceCountdown: string | null;
  /** Present only when an ad can be shown here */
  onWatchAd?: () => void;
  adBusy?: boolean;
  /** A short message, e.g. "New stance unlocked: Robot!" */
  notice?: string | null;
}

const CHOICES: Array<{ id: StartChoice; label: string; icon: React.ReactNode }> = [
  { id: 'newGame', label: 'New Game', icon: <Play className="w-5 h-5 fill-current" /> },
  { id: 'unlocks', label: 'Unlocks', icon: <Lock className="w-5 h-5" /> },
  { id: 'stances', label: 'Stances', icon: <Users className="w-5 h-5" /> },
  { id: 'records', label: 'Records', icon: <Trophy className="w-5 h-5" /> },
  { id: 'options', label: 'Options', icon: <Sliders className="w-5 h-5" /> },
  { id: 'studio', label: 'Pose Studio', icon: <Clapperboard className="w-5 h-5" /> },
];

export const StartScreen: React.FC<StartScreenProps> = ({
  onChoose,
  heroLabel,
  unlockedHeroes,
  totalHeroes,
  oneButtonMode,
  stanceCountdown,
  onWatchAd,
  adBusy,
  notice,
}) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        setSelected((i) => (i + 1) % CHOICES.length);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        setSelected((i) => (i - 1 + CHOICES.length) % CHOICES.length);
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onChoose(CHOICES[selected].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onChoose]);

  return (
    // Short screens (a phone on its side): the logo sits beside the menu instead of above it
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-10 p-6 bg-black/60 backdrop-blur-[2px] overflow-y-auto [@media(max-height:560px)]:flex-row [@media(max-height:560px)]:gap-8 [@media(max-height:560px)]:p-3">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-6xl md:text-8xl [@media(max-height:560px)]:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-300 to-pink-500 drop-shadow-[0_0_35px_rgba(0,243,255,0.6)]">
          NEON STRIKE
        </h1>
        <p className="mt-3 text-sm md:text-base font-mono tracking-[0.3em] uppercase text-cyan-300/80">Rhythm Brawler</p>
      </div>

      <nav className="flex flex-col gap-3 [@media(max-height:560px)]:gap-2 w-full max-w-xs" aria-label="Main menu">
        {CHOICES.map((c, i) => {
          const active = i === selected;
          const button = (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => onChoose(c.id)}
              className={`group relative flex items-center gap-3 px-6 py-4 [@media(max-height:560px)]:py-2 [@media(max-height:560px)]:text-base rounded-xl border-2 font-black text-lg tracking-widest uppercase transition-all cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-300 border-transparent text-black shadow-[0_0_30px_rgba(0,243,255,0.55)] scale-105'
                  : 'bg-slate-950/80 border-slate-700 text-slate-200 hover:border-cyan-400'
              }`}
            >
              {c.icon}
              <span className="flex-1 text-left">{c.label}</span>
              {c.id === 'unlocks' && (
                <span className={`text-xs font-mono tracking-normal ${active ? 'text-black/70' : 'text-amber-300'}`}>
                  {unlockedHeroes}/{totalHeroes}
                </span>
              )}
              {c.id === 'stances' && (
                <span className={`text-xs font-mono tracking-normal tabular-nums whitespace-nowrap ${active ? 'text-black/70' : 'text-amber-300'}`}>
                  {stanceCountdown ? `⏱ ${stanceCountdown}` : 'ALL'}
                </span>
              )}
            </button>
          );
          // The Stances row also offers the ad, beside the button (a button can't hold another button)
          if (c.id === 'stances' && stanceCountdown && onWatchAd) {
            return (
              <div key={c.id} className="flex items-stretch gap-2">
                <div className="flex-1 flex flex-col">{button}</div>
                <button
                  type="button"
                  onClick={onWatchAd}
                  disabled={adBusy}
                  title="Watch an ad to unlock the next enemy stance now"
                  className="px-3 rounded-xl border-2 border-amber-400/70 bg-amber-400/10 hover:bg-amber-400/20 disabled:opacity-60 text-amber-300 text-[11px] font-black leading-tight cursor-pointer"
                >
                  ▶ Watch
                  <br />
                  ad
                </button>
              </div>
            );
          }
          return button;
        })}
      </nav>

      {notice && (
        <div className="-mt-6 [@media(max-height:560px)]:mt-0 [@media(max-height:560px)]:absolute [@media(max-height:560px)]:bottom-3 px-4 py-2 rounded-lg bg-amber-400/15 border border-amber-400/60 text-amber-200 text-sm font-bold" role="status">
          {notice}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 text-xs font-mono text-slate-400 [@media(max-height:560px)]:hidden">
        <div>
          Playing as <span className="text-cyan-300 font-bold">{heroLabel}</span>
        </div>
        <div className="text-slate-500">
          {oneButtonMode ? '[SPACE] or tap to strike · [ESC] pause' : '[←] [A] strike left · [→] [D] strike right · [SPACE] pause'}
        </div>
      </div>
    </div>
  );
};
