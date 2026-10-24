import React, { useEffect, useState } from 'react';
import { STUDIO_ENABLED } from '../game/studioAccess';
import type { HeroId } from '../game/heroes';
import { ArcadeScreen, HeroFigure, SlantButton } from './arcade/ui';

/**
 * The title screen, in the arcade style: the logo, your fighter big on the
 * right, and the menu down the left with Play biggest. Works with the
 * mouse, a tap, or the keyboard (Up / Down to move, Enter or Space to pick).
 */

export type StartChoice = 'newGame' | 'unlocks' | 'records' | 'options' | 'studio';

interface StartScreenProps {
  onChoose: (choice: StartChoice) => void;
  /** The hero you'll play as (drawn big on the right) */
  heroId: HeroId;
  heroLabel: string;
  /** New unlocks not yet tapped on: a number badge on the Unlocks button */
  newUnlocks?: number;
  /** How many songs there are to play (shown on Play) */
  songCount: number;
  oneButtonMode: boolean;
  /** A short message, e.g. "New stance unlocked: Robot!" */
  notice?: string | null;
}

const ALL_CHOICES: Array<{ id: StartChoice; label: string }> = [
  { id: 'newGame', label: '▶ Play' },
  { id: 'unlocks', label: 'Unlocks' },
  { id: 'records', label: 'Records' },
  { id: 'options', label: 'Options' },
  { id: 'studio', label: 'Pose Studio' },
];
// The Pose Studio is a dev-only designer tool (see studioAccess)
const CHOICES = ALL_CHOICES.filter((c) => c.id !== 'studio' || STUDIO_ENABLED);

export const StartScreen: React.FC<StartScreenProps> = ({ onChoose, heroId, heroLabel, newUnlocks = 0, songCount, oneButtonMode, notice }) => {
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

  const u = (n: number) => `calc(var(--u) * ${n})`;

  return (
    <ArcadeScreen label="Main menu">
      {/* Your fighter, big, on the right */}
      <div className="absolute arc-bob" style={{ right: '5%', bottom: u(4), height: u(78), width: u(64) }}>
        <HeroFigure id={heroId} animate className="w-full h-full" style={{ filter: 'drop-shadow(0 0 calc(var(--u) * 1.6) rgba(0,229,255,0.55))' }} />
      </div>
      <div className="absolute text-right" style={{ right: u(5), top: u(5) }}>
        <div className="font-black tracking-[0.25em] text-[color:var(--pink)]" style={{ fontSize: `max(10px, ${u(2.2)})` }}>
          FIGHTER
        </div>
        <div className="arc-display arc-skew" style={{ fontSize: u(5.4) }}>
          {heroLabel}
        </div>
      </div>

      {/* Logo */}
      <div className="absolute" style={{ left: u(6), top: u(5) }}>
        <h1 className="arc-display arc-split arc-skew m-0" style={{ fontSize: u(14) }}>
          Neon Strike
        </h1>
        <div style={{ marginTop: u(2) }}>
          <span className="arc-tag">RHYTHM BRAWLER</span>
        </div>
      </div>

      {/* Menu */}
      <nav className="absolute flex flex-col" style={{ left: u(6), top: u(31), gap: u(1.2), width: `min(46%, ${u(70)})` }} aria-label="Main menu">
        {CHOICES.map((c, i) => {
          const active = i === selected;
          const play = c.id === 'newGame';
          return (
            <SlantButton
              key={c.id}
              variant={play ? 'hot' : active ? 'selected' : 'dark'}
              size={play ? 'lg' : 'md'}
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => onChoose(c.id)}
              className={`arc-in-left justify-start ${play ? 'arc-pulse' : ''}`}
              style={{ animationDelay: `${i * 0.05}s`, width: play ? '108%' : active ? '104%' : '100%', height: play ? undefined : u(10) }}
            >
              {c.label}
              {play && <span className="arc-sub">{songCount} SONGS</span>}
              {c.id === 'unlocks' && newUnlocks > 0 && <span className="arc-badge">{newUnlocks > 99 ? '99+' : newUnlocks} NEW</span>}
            </SlantButton>
          );
        })}
      </nav>

      {notice && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 arc-tag"
          style={{ top: u(4), fontSize: `max(11px, ${u(2.6)})`, letterSpacing: '0.08em' }}
        >
          {notice}
        </div>
      )}

      <div
        className="absolute arc-blink font-black tracking-[0.3em] text-[color:var(--yellow)] [@media(pointer:coarse)]:hidden"
        style={{ left: '50%', bottom: u(4), transform: 'translateX(-50%)', fontSize: `max(10px, ${u(2.2)})` }}
      >
        {oneButtonMode ? 'ENTER TO PICK · SPACE TO STRIKE' : 'ENTER TO PICK · ← → TO STRIKE'}
      </div>
    </ArcadeScreen>
  );
};
