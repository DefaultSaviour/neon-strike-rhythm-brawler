import React, { useEffect, useState } from 'react';
import { Play, Lock, Sliders, Clapperboard } from 'lucide-react';

/**
 * The title screen: the game's name and four big choices. Works with the
 * mouse, a tap, or the keyboard (Up / Down to move, Enter or Space to pick).
 */

export type StartChoice = 'newGame' | 'unlocks' | 'options' | 'studio';

interface StartScreenProps {
  onChoose: (choice: StartChoice) => void;
  /** The hero you'll play as */
  heroLabel: string;
  unlockedHeroes: number;
  totalHeroes: number;
  oneButtonMode: boolean;
}

const CHOICES: Array<{ id: StartChoice; label: string; icon: React.ReactNode }> = [
  { id: 'newGame', label: 'New Game', icon: <Play className="w-5 h-5 fill-current" /> },
  { id: 'unlocks', label: 'Unlocks', icon: <Lock className="w-5 h-5" /> },
  { id: 'options', label: 'Options', icon: <Sliders className="w-5 h-5" /> },
  { id: 'studio', label: 'Pose Studio', icon: <Clapperboard className="w-5 h-5" /> },
];

export const StartScreen: React.FC<StartScreenProps> = ({ onChoose, heroLabel, unlockedHeroes, totalHeroes, oneButtonMode }) => {
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
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-10 p-6 bg-black/60 backdrop-blur-[2px]">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-300 to-pink-500 drop-shadow-[0_0_35px_rgba(0,243,255,0.6)]">
          NEON STRIKE
        </h1>
        <p className="mt-3 text-sm md:text-base font-mono tracking-[0.3em] uppercase text-cyan-300/80">Rhythm Brawler</p>
      </div>

      <nav className="flex flex-col gap-3 w-full max-w-xs" aria-label="Main menu">
        {CHOICES.map((c, i) => {
          const active = i === selected;
          return (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => onChoose(c.id)}
              className={`group relative flex items-center gap-3 px-6 py-4 rounded-xl border-2 font-black text-lg tracking-widest uppercase transition-all cursor-pointer ${
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
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 text-xs font-mono text-slate-400">
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
