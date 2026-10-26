import React, { useEffect, useState } from 'react';
import { STUDIO_ENABLED } from '../game/studioAccess';
import type { HeroId } from '../game/heroes';
import type { EnemyMotionStyle } from '../game/enemyMotion';
import { PRELOADED_TRACKS, audioEngine } from '../audio/audioEngine';
import { ArcadeScreen, SlantButton } from './arcade/ui';
import { TitleFight } from './arcade/TitleFight';

/**
 * The title screen, in the arcade style: the logo, the menu down the left
 * with Play biggest, and your fighter on the right breaking up the title
 * song's enemies as they float in from the right, on their notes (the
 * title music is the last song, from its drop to the end). Switch fighter with ‹ › or Left / Right; the switch at
 * the bottom of the menu flips the controls between one button and two (A / D or the arrows).
 *
 * Works with the mouse, a tap, or the keyboard (Up / Down to move, Enter or
 * Space to pick).
 */

export type StartChoice = 'newGame' | 'unlocks' | 'records' | 'options' | 'studio';

/** The title music: the 15th song, Doomsday (its chart also sends the title's enemies) */
export const TITLE_TRACK_ID = 'track_doomsday';
const TITLE_TRACK = PRELOADED_TRACKS.find((t) => t.id === TITLE_TRACK_ID) ?? PRELOADED_TRACKS[PRELOADED_TRACKS.length - 1];

interface StartScreenProps {
  onChoose: (choice: StartChoice) => void;
  /** The hero you'll play as, and the ones you can switch to (in path order) */
  heroId: HeroId;
  heroLabel: string;
  unlockedHeroes: HeroId[];
  onSelectHero: (id: HeroId) => void;
  /** Your chosen stance: the enemies on the title move in it */
  stance: EnemyMotionStyle;
  /** New unlocks not yet tapped on: a number badge on the Unlocks button */
  newUnlocks?: number;
  /** How many songs there are to play (shown on Play) */
  songCount: number;
  oneButtonMode: boolean;
  onToggleOneButtonMode: () => void;
  /** A short message, e.g. "New stance unlocked: Robot!" */
  notice?: string | null;
}

type MenuItem = StartChoice | 'buttons';

const MENU: Array<{ id: MenuItem; label: string }> = [
  { id: 'newGame', label: '▶ Play' },
  { id: 'unlocks', label: 'Unlocks' },
  { id: 'records', label: 'Records' },
  { id: 'options', label: 'Options' },
  { id: 'buttons', label: 'Controls' },
];

const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * The controls switch, the whole menu row: ONE BUTTON (any key or tap
 * strikes, and the game picks the side) or LEFT & RIGHT (A / D or the arrows,
 * or the two halves of a touch screen). A yellow block slides to the one
 * that's on.
 */
const ControlsSwitch: React.FC<{ one: boolean; active: boolean; onToggle: () => void; onHover: () => void; delay: number }> = ({
  one,
  active,
  onToggle,
  onHover,
  delay,
}) => {
  const cut = u(2.6);
  const slant = `polygon(${cut} 0, 100% 0, calc(100% - ${cut}) 100%, 0 100%)`;
  const side = (on: boolean, children: React.ReactNode) => (
    <span
      className="relative grid place-items-center whitespace-nowrap"
      style={{ color: on ? '#000' : active ? '#fff' : '#6c7192', transition: 'color 0.18s' }}
    >
      {children}
    </span>
  );
  return (
    <button
      type="button"
      role="switch"
      aria-checked={one}
      aria-label={`Controls: ${one ? 'one button' : 'left and right'}. Switch to ${one ? 'left and right' : 'one button'}`}
      onClick={onToggle}
      onMouseEnter={onHover}
      onFocus={onHover}
      className="arc-btn arc-in-left grid grid-cols-2"
      style={{
        animationDelay: `${delay}s`,
        height: u(10),
        width: active ? '104%' : '100%',
        padding: 0,
        gap: 0,
        background: active ? '#2a2a3d' : undefined,
        boxShadow: active ? 'inset 0 0 0 2px #fff' : undefined,
      }}
    >
      {/* The sliding block */}
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0"
        style={{
          left: one ? 0 : '50%',
          width: '50%',
          background: 'var(--yellow)',
          clipPath: slant,
          transition: 'left 0.18s cubic-bezier(0.2, 0.9, 0.2, 1)',
        }}
      />
      {side(one, '1 Button')}
      {side(!one, 'Left & Right')}
    </button>
  );
};

export const StartScreen: React.FC<StartScreenProps> = ({
  onChoose,
  heroId,
  heroLabel,
  unlockedHeroes,
  onSelectHero,
  stance,
  newUnlocks = 0,
  songCount,
  oneButtonMode,
  onToggleOneButtonMode,
  notice,
}) => {
  const [selected, setSelected] = useState(0);

  const heroIndex = Math.max(0, unlockedHeroes.indexOf(heroId));
  const switchHero = (step: number) => {
    if (unlockedHeroes.length < 2) return;
    onSelectHero(unlockedHeroes[(heroIndex + step + unlockedHeroes.length) % unlockedHeroes.length]);
  };

  const pick = (item: MenuItem) => (item === 'buttons' ? onToggleOneButtonMode() : onChoose(item));

  // The title music. It keeps playing through Unlocks, Records and Options; song select and songs take over.
  useEffect(() => {
    void audioEngine.playPreview(TITLE_TRACK, { toEnd: true });
    // A browser holds the sound until the first tap or key: a key press starts it too (a tap already does, in App)
    const wake = () => audioEngine.getAudioContext();
    window.addEventListener('keydown', wake);
    return () => window.removeEventListener('keydown', wake);
  }, []);

  // Keys. Caught first (capture) so the game's own keys never fire here too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let handled = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') setSelected((i) => (i + 1) % MENU.length);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') setSelected((i) => (i - 1 + MENU.length) % MENU.length);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') switchHero(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') switchHero(-1);
      else if (e.code === 'Enter' || e.code === 'Space') !e.repeat && pick(MENU[selected].id);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <ArcadeScreen label="Main menu">
      {/* Your fighter, breaking up the title song's enemies on their notes (left of it is the menu) */}
      {/* (A canvas won't stretch between its edges like a box does, so it sits in one that does) */}
      <div className="absolute pointer-events-none" style={{ left: `calc(${u(6)} + min(46%, ${u(70)}) * 1.08)`, right: 0, top: 0, bottom: 0 }}>
        <TitleFight
          key={heroId}
          heroId={heroId}
          stance={stance}
          track={TITLE_TRACK}
          clock={() => audioEngine.getPreviewSongTime()}
          sceneHeightU={84}
          className="w-full h-full"
        />
      </div>

      {/* Who you're playing as, and switching */}
      <div className="absolute flex flex-col items-end" style={{ right: u(5), top: u(5), gap: u(1) }}>
        <div className="font-black tracking-[0.25em] text-[color:var(--pink)]" style={{ fontSize: `max(10px, ${u(2.2)})` }}>
          FIGHTER {unlockedHeroes.length > 1 && <span className="text-[color:var(--muted)]">{heroIndex + 1}/{unlockedHeroes.length}</span>}
        </div>
        <div className="flex items-center" style={{ gap: u(1.4) }}>
          {unlockedHeroes.length > 1 && (
            <SlantButton size="sm" onClick={() => switchHero(-1)} aria-label="Previous fighter" style={{ width: u(9), padding: 0 }}>
              ‹
            </SlantButton>
          )}
          <div className="arc-display arc-skew whitespace-nowrap" style={{ fontSize: u(5.4) }}>
            {heroLabel}
          </div>
          {unlockedHeroes.length > 1 && (
            <SlantButton size="sm" onClick={() => switchHero(1)} aria-label="Next fighter" style={{ width: u(9), padding: 0 }}>
              ›
            </SlantButton>
          )}
        </div>
        {/* The Pose Studio is a dev-only designer tool (see studioAccess): tucked up here, not in the menu */}
        {STUDIO_ENABLED && (
          <SlantButton size="sm" variant="alt" onClick={() => onChoose('studio')} style={{ marginTop: u(1) }}>
            Pose Studio
          </SlantButton>
        )}
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
        {MENU.map((c, i) => {
          const active = i === selected;
          if (c.id === 'buttons') {
            return (
              <ControlsSwitch key={c.id} one={oneButtonMode} active={active} onToggle={onToggleOneButtonMode} onHover={() => setSelected(i)} delay={i * 0.05} />
            );
          }
          const play = c.id === 'newGame';
          return (
            <SlantButton
              key={c.id}
              variant={play ? 'hot' : active ? 'selected' : 'dark'}
              size={play ? 'lg' : 'md'}
              onMouseEnter={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onClick={() => pick(c.id)}
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
        ENTER TO PICK · ← → FIGHTER
      </div>
    </ArcadeScreen>
  );
};
