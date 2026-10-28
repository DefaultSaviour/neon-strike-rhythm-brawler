import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../audio/audioEngine';
import { AdOffer, AdOfferButton, SlantButton } from './ui';
import { carouselOffset, placeAt, releaseSteps, TAP_PX, wrapOffset } from './fighterCarousel';

/**
 * The pieces the Unlocks tabs share (Fighters, Stances): the header with
 * the ad offer between the title and the tabs, the carousel (swipe, tap a
 * side one, or ‹ ›), the tags over the name, the progress bar, and the
 * keys. Each tab draws its own things in the carousel and its own info.
 */

export const u = (n: number) => `calc(var(--u) * ${n})`;
export const small = `max(10px, ${u(2.3)})`;

/** The box each thing is drawn in (arcade units): the one in focus fills it, feet at the bottom */
export const BOX_W = 64;
export const BOX_H = 46;
/** How far up from the bottom of the screen the feet are (room for the info below) */
export const BOX_BOTTOM = 36;

/** The beat being heard: the menu music's, or a steady 120 BPM when there's none (sound not started yet). */
export function heardBeat(): { beat: number; since: number; period: number } {
  const music = audioEngine.getPreviewBeat();
  if (music) return music;
  const period = 0.5;
  const t = performance.now() / 1000;
  const beat = Math.floor(t / period);
  return { beat, since: t - beat * period, period };
}

/** The title, the ad offer (always there when there's one, or why ads are off), and the tabs. */
export const UnlockHeader: React.FC<{ title: string; onClose: () => void; offer?: AdOffer; offerNote?: string | null; tabs?: React.ReactNode }> = ({ title, onClose, offer, offerNote, tabs }) => (
  <div className="absolute flex items-center z-30" style={{ left: u(5), right: u(4), top: u(4), gap: u(3) }}>
    <div className="flex items-center shrink-0" style={{ gap: u(2) }}>
      <SlantButton onClick={onClose} aria-label="Back" className="arc-in-left" style={{ width: u(12), padding: 0 }}>
        ‹
      </SlantButton>
      <h2 className="arc-display arc-skew m-0 arc-in-left" style={{ fontSize: u(8.4), textShadow: `${u(0.4)} 0 0 var(--pink)` }}>
        {title}
      </h2>
    </div>
    <div className="flex-1 min-w-0 flex justify-center arc-in-left" style={{ animationDelay: '0.1s' }}>
      {offer ? (
        <AdOfferButton offer={offer} style={{ height: u(9), maxWidth: '100%', fontSize: u(3), padding: `0 ${u(3)}` }} />
      ) : (
        offerNote && (
          <span className="font-bold text-[color:var(--muted)] text-center" style={{ fontSize: small }}>
            {offerNote}
          </span>
        )
      )}
    </div>
    <div className="shrink-0 arc-in-right" style={{ width: `min(${u(70)}, 46%)` }}>
      {tabs}
    </div>
  </div>
);

/**
 * The carousel: `count` things in a ring, the one at `focus` big in the
 * middle, two each side getting smaller. Drag it round with a finger (or
 * the mouse): everything follows 1:1, growing as it comes to the middle,
 * a long drag goes past several, and letting go settles on the nearest (a
 * quick flick moves one). Or tap one at the side, or use the ‹ › buttons.
 * `onMove` gets how many places to go.
 */
export const UnlockCarousel: React.FC<{
  label: string;
  count: number;
  focus: number;
  onMove: (step: number) => void;
  /** A stable key, and a name (for "Show …"), for each */
  keyAt: (i: number) => string;
  nameAt: (i: number) => string;
  /** Unlocked but not yet looked at: a NEW tag on the ones beside the one in focus */
  isNewAt?: (i: number) => boolean;
  /** Draw thing `i` (fills its box) */
  render: (i: number, inFocus: boolean) => React.ReactNode;
  /** The glow on the floor under the one in focus */
  floorColor: string;
}> = ({ label, count, focus, onMove, keyAt, nameAt, isNewAt, render, floorColor }) => {
  // Dragging: how many places the finger has turned the ring so far (fractions too). A drag isn't a tap on a side one.
  const [drag, setDrag] = useState(0);
  const swiped = useRef(false);
  // When the screen opened: things slide in then, but not ones dragged into view later
  const openedAt = useRef(performance.now());
  const opening = performance.now() - openedAt.current < 900;
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    // One place is as far apart as the one in focus and the next (in px, for this screen)
    const stepPx = 44 * Math.min(window.innerHeight / 100, window.innerWidth * 0.005625);
    swiped.current = false;
    // The last moment or so of the drag, for how fast it was going when the finger let go
    let lastX = startX;
    let lastT = performance.now();
    let speed = 0;
    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) >= TAP_PX) swiped.current = true;
      const now = performance.now();
      if (now > lastT) speed = speed * 0.6 + ((ev.clientX - lastX) / (now - lastT)) * 0.4;
      lastX = ev.clientX;
      lastT = now;
      setDrag(swiped.current ? dx / stepPx : 0);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      // Stopped before letting go: no flick
      if (performance.now() - lastT > 90) speed = 0;
      setDrag(0);
      const steps = releaseSteps(ev.clientX - startX, stepPx, speed);
      if (steps) onMove(steps);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      {/* The floor the one in focus stands on */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none arc-in-right"
        style={{
          left: 0,
          right: 0,
          marginInline: 'auto',
          animationDelay: '0.06s',
          bottom: u(BOX_BOTTOM - 3),
          width: u(56),
          height: u(7),
          background: `radial-gradient(closest-side, ${floorColor}55, transparent)`,
          transition: 'background 0.3s',
        }}
      />

      <div
        className="absolute inset-x-0 select-none"
        style={{ top: u(16), bottom: u(BOX_BOTTOM - 4), touchAction: 'none' }}
        onPointerDown={onPointerDown}
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
      >
        {Array.from({ length: count }, (_, i) => {
          const off = carouselOffset(i, focus, count);
          // Where it is right now, with the drag (a fraction of a place, or several)
          const at = wrapOffset(off + drag, count);
          if (Math.abs(at) > 3.5) return null;
          const place = placeAt(at);
          const inFocus = off === 0;
          return (
            <div
              key={keyAt(i)}
              className="absolute pointer-events-none"
              aria-hidden={!inFocus}
              style={{
                left: `calc(50% - ${u(BOX_W / 2)})`,
                bottom: u(4),
                width: u(BOX_W),
                height: u(BOX_H),
                zIndex: Math.round(20 - Math.abs(at) * 2),
                opacity: place.opacity,
                transformOrigin: '50% 100%',
                transform: `translateX(${u(place.x)}) scale(${place.scale})`,
                // Straight under the finger while dragging, then a quick settle
                transition: drag ? 'none' : 'transform 0.38s cubic-bezier(0.2, 0.9, 0.2, 1), opacity 0.3s',
              }}
            >
              {/* Slides in when the screen opens, the one in focus first (inside: the outer box is moved by the carousel) */}
              <div className={`w-full h-full ${opening ? 'arc-in-right' : ''}`} style={{ animationDelay: `${0.06 + Math.abs(off) * 0.06}s` }}>
                {render(i, inFocus)}
              </div>
              {!inFocus && Math.abs(off) <= 2 && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Show ${nameAt(i)}`}
                  onClick={() => !swiped.current && onMove(off)}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{ left: '28%', width: '44%', top: '12%', bottom: 0, background: 'none', border: 0 }}
                />
              )}
              {Math.abs(off) === 1 && isNewAt?.(i) && (
                <span className="absolute arc-tag" style={{ left: '50%', top: '4%', transform: 'translateX(-50%) skewX(-14deg)', background: 'var(--pink)', color: '#fff', fontSize: u(4) }}>
                  NEW
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute z-20 arc-in-left" style={{ left: u(4), top: u(38), animationDelay: '0.12s' }}>
        <SlantButton onClick={() => onMove(-1)} aria-label="Previous" style={{ width: u(12), padding: 0 }}>
          ‹
        </SlantButton>
      </div>
      <div className="absolute z-20 arc-in-right" style={{ right: u(4), top: u(38), animationDelay: '0.12s' }}>
        <SlantButton onClick={() => onMove(1)} aria-label="Next" style={{ width: u(12), padding: 0 }}>
          ›
        </SlantButton>
      </div>
    </>
  );
};

/** The info under the one in focus: a column centred at the bottom, sliding in with the rest. */
export const UnlockInfo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section
    className="absolute flex flex-col items-center text-center z-20 arc-in-left"
    aria-live="polite"
    style={{ left: 0, right: 0, marginInline: 'auto', bottom: u(4), width: `min(100% - ${u(36)}, ${u(110)})`, gap: u(1), animationDelay: '0.14s' }}
  >
    {children}
  </section>
);

/** Over the name: where it is in the ring ("3/16") with NEW or LOCKED, or a message after an ad. */
export const InfoTags: React.FC<{ index: number; count: number; fresh?: boolean; locked: boolean; notice?: string | null }> = ({ index, count, fresh, locked, notice }) => (
  <div className="flex items-center" style={{ gap: u(2.4), minHeight: u(3.6) }}>
    {notice ? (
      <span role="status" className="arc-tag">
        {notice}
      </span>
    ) : (
      <>
        <span className="font-black tracking-[0.25em] text-[color:var(--muted)]" style={{ fontSize: small }}>
          {index + 1}/{count}
        </span>
        {fresh && (
          <span className="arc-tag" style={{ background: 'var(--pink)', color: '#fff' }}>
            NEW
          </span>
        )}
        {locked && (
          <span className="arc-tag" style={{ background: '#2a2d40', color: '#c9cde0' }}>
            LOCKED
          </span>
        )}
      </>
    )}
  </div>
);

/** The big name of the one in focus (it slides in each time a new one comes into focus). */
export const InfoName: React.FC<{ name: string; locked: boolean }> = ({ name, locked }) => (
  <h3 key={name} className="arc-display arc-skew arc-split m-0 whitespace-nowrap arc-in-right" style={{ fontSize: u(7.4), color: locked ? '#aeb3c8' : '#fff', animationDuration: '0.25s' }}>
    {name}
  </h3>
);

/** How far along a goal is: a slanted yellow bar, and the numbers beside it. */
export const GoalBar: React.FC<{ fraction: number; text: string }> = ({ fraction, text }) => (
  <div className="flex items-center w-full justify-center" style={{ gap: u(2) }}>
    <div className="relative overflow-hidden" style={{ width: u(52), height: u(1.8), minHeight: 6, background: '#1d2033', transform: 'skewX(-20deg)' }}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: 'var(--yellow)' }} />
    </div>
    <span className="font-mono font-extrabold text-[color:var(--muted)] whitespace-nowrap" style={{ fontSize: small }}>
      {text}
    </span>
  </div>
);

/** Bottom corners: how many are earned, and the keys (hidden on touch screens). */
export const UnlockFooter: React.FC<{ earned: number; count: number }> = ({ earned, count }) => (
  <>
    <div className="absolute font-black tracking-[0.2em] text-[color:var(--muted)] arc-in-left" style={{ left: u(5), bottom: u(4), fontSize: small, animationDelay: '0.2s' }}>
      <span className="text-[color:var(--yellow)]">{earned}</span>/{count} EARNED
    </div>
    <div className="absolute arc-blink font-black tracking-[0.3em] text-[color:var(--yellow)] whitespace-nowrap [@media(pointer:coarse)]:hidden" style={{ right: u(4), bottom: u(4), fontSize: `max(10px, ${u(2.2)})` }}>
      ←→ BROWSE · ESC BACK
    </div>
  </>
);

/** The keys: Left / Right move, Enter or Space picks, Escape goes back. Caught first, so the game's own keys never fire here too. */
export function useCarouselKeys(move: (step: number) => void, onPick: (() => void) | null, onClose: () => void) {
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let handled = true;
      if (e.code === 'Escape' || e.code === 'Backspace') onClose();
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') move(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') move(-1);
      else if (e.code === 'Enter' || e.code === 'Space') !e.repeat && pick.current?.();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [move, onClose]);
}

/** Looked at for a moment (in focus a little over a second): no longer new. */
export function useSeenAfterLook<T extends string>(id: T, fresh: boolean, onSeen?: (id: T) => void) {
  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => onSeen?.(id), 1200);
    return () => window.clearTimeout(t);
  }, [id, fresh, onSeen]);
}
