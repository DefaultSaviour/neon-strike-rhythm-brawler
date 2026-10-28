import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BACKDROP_ITEMS, BACKDROP_LAYERS, backdropGoalScore, BackdropLayer, nextBackdrop, scoreToNextBackdrop } from '../game/backdrops';
import type { LifetimeStats } from '../game/heroUnlocks';
import { shortNumber } from '../game/records';
import { BackdropCanvas } from './BackdropCanvas';
import { ArcadeScreen, ArcadeSwitch, SlantButton } from './arcade/ui';
import { releaseSteps, wrapIndex } from './arcade/fighterCarousel';
import { GoalBar, InfoName, InfoTags, u, UnlockFooter, UnlockHeader, UnlockInfo, useSeenAfterLook } from './arcade/UnlockCarousel';

/**
 * The Backdrops tab of Unlocks, arcade style (the user's pick of two
 * mockups): you mix your own backdrop from four layers. A switch picks the
 * layer (sky, skyline, centrepiece, floor); the big stage shows your mix
 * live, with that layer's pieces flicked through right on it (swipe it, or
 * ‹ ›), and little pips for where you are among its five. Locked pieces
 * still show on the stage, dimmed and stamped LOCKED, with the total score
 * that opens them; the next one can be opened now with the pink ad offer.
 *
 * Keys: Left / Right flick through the pieces, Up / Down change layer,
 * Enter or Space uses the piece, Escape goes back.
 */

interface BackdropScreenProps {
  stats: LifetimeStats;
  /** The pieces in use, one per layer */
  selected: Record<BackdropLayer, string>;
  isUnlocked: (id: string) => boolean;
  onSelect: (layer: BackdropLayer, id: string) => void;
  /** Watch an ad to open the next piece now; present only when an ad can be shown here */
  onWatchAd?: () => void;
  adBusy?: boolean;
  /** Why ads can't be offered here, shown in place of the ad button */
  adsOffNote?: string | null;
  /** A message after watching an ad (unlocked, or why not) */
  notice?: string | null;
  /** Open but not yet looked at: these wear a NEW tag */
  isNew?: (id: string) => boolean;
  /** The player has looked at this piece */
  onSeen?: (id: string) => void;
  /** The Fighters / Stances / Backdrops tab bar, shown top right */
  tabs?: React.ReactNode;
  onClose: () => void;
}

const LAYER_OPTIONS = BACKDROP_LAYERS.map((l) => ({ id: l.layer, label: l.label }));
const piecesOf = (layer: BackdropLayer) => BACKDROP_ITEMS.filter((b) => b.layer === layer);
const SLANT = `polygon(${u(3.4)} 0, 100% 0, calc(100% - ${u(3.4)}) 100%, 0 100%)`;

export const BackdropScreen: React.FC<BackdropScreenProps> = ({ stats, selected, isUnlocked, onSelect, onWatchAd, adBusy, adsOffNote, notice, isNew, onSeen, tabs, onClose }) => {
  // Open on a new piece you haven't looked at yet, if there is one, or else on the sky you have
  const [layer, setLayer] = useState<BackdropLayer>(() => BACKDROP_ITEMS.find((b) => isUnlocked(b.id) && isNew?.(b.id))?.layer ?? 'sky');
  // Which piece is on the stage for each layer: to start, the one in use (or the new one)
  const [focusOf, setFocusOf] = useState<Record<BackdropLayer, number>>(() => {
    const out = {} as Record<BackdropLayer, number>;
    for (const { layer: l } of BACKDROP_LAYERS) {
      const pieces = piecesOf(l);
      const fresh = pieces.findIndex((b) => isUnlocked(b.id) && isNew?.(b.id));
      out[l] = fresh >= 0 ? fresh : Math.max(0, pieces.findIndex((b) => b.id === selected[l]));
    }
    return out;
  });
  const pieces = useMemo(() => piecesOf(layer), [layer]);
  const focus = focusOf[layer];
  const piece = pieces[focus];
  const open = isUnlocked(piece.id);
  const inUse = selected[layer] === piece.id;
  const fresh = open && !!isNew?.(piece.id);
  useSeenAfterLook(piece.id, fresh, onSeen);

  // Which way the last flick went, so the new piece slides in from that side
  const [dir, setDir] = useState<1 | -1>(1);
  const move = useCallback(
    (step: number) => {
      if (!step) return;
      setDir(step > 0 ? 1 : -1);
      setFocusOf((f) => ({ ...f, [layer]: wrapIndex(f[layer], step, piecesOf(layer).length) }));
    },
    [layer]
  );
  const changeLayer = useCallback((step: number) => {
    setLayer((l) => BACKDROP_LAYERS[wrapIndex(BACKDROP_LAYERS.findIndex((x) => x.layer === l), step, BACKDROP_LAYERS.length)].layer);
  }, []);

  // A piece just put up (with the ad offer, say): show it
  const lastSelected = useRef(selected);
  useEffect(() => {
    const before = lastSelected.current;
    lastSelected.current = selected;
    const changed = BACKDROP_LAYERS.find(({ layer: l }) => before[l] !== selected[l]);
    if (!changed) return;
    const i = piecesOf(changed.layer).findIndex((b) => b.id === selected[changed.layer]);
    setLayer(changed.layer);
    if (i >= 0) setFocusOf((f) => ({ ...f, [changed.layer]: i }));
  }, [selected]);

  const use = useCallback(() => {
    if (open && !inUse) onSelect(layer, piece.id);
  }, [open, inUse, onSelect, layer, piece.id]);

  // Keys. Caught first (capture) so the game's own keys never fire here too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      let handled = true;
      if (e.code === 'Escape' || e.code === 'Backspace') onClose();
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') move(1);
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') move(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') changeLayer(1);
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') changeLayer(-1);
      else if (e.code === 'Enter' || e.code === 'Space') !e.repeat && use();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, move, changeLayer, use]);

  // Swipe the stage to flick through the pieces (a long swipe goes past several)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const t0 = performance.now();
    const stepPx = 30 * Math.min(window.innerHeight / 100, window.innerWidth * 0.005625);
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const dx = ev.clientX - x0;
      move(releaseSteps(dx, stepPx, dx / Math.max(1, performance.now() - t0)));
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const next = nextBackdrop(stats);
  const toGo = scoreToNextBackdrop(stats);
  const goal = backdropGoalScore(piece.id, stats);
  const isNext = next?.id === piece.id;
  const earned = BACKDROP_ITEMS.filter((b) => isUnlocked(b.id)).length;
  // The stage: your mix, with this layer's piece on it
  const preview = useMemo(() => ({ ...selected, [layer]: piece.id }), [selected, layer, piece.id]);

  return (
    <ArcadeScreen label="Backdrops" stripes="flat">
      <UnlockHeader
        title="Backdrops"
        onClose={onClose}
        offer={onWatchAd && next ? { name: next.label, busy: !!adBusy, done: false, onWatch: onWatchAd } : undefined}
        offerNote={next ? adsOffNote : null}
        tabs={tabs}
      />

      {/* Which layer */}
      <div className="absolute arc-in-left" style={{ left: 0, right: 0, marginInline: 'auto', top: u(17), width: `min(100% - ${u(36)}, ${u(112)})`, animationDelay: '0.06s' }}>
        <ArcadeSwitch label="Layer" options={LAYER_OPTIONS} value={layer} onChange={setLayer} />
      </div>

      {/* The stage (swipe it) */}
      <div
        className="absolute arc-in-right select-none overflow-hidden"
        role="group"
        aria-roledescription="carousel"
        aria-label={`${BACKDROP_LAYERS.find((l) => l.layer === layer)!.label} pieces`}
        onPointerDown={onPointerDown}
        // Never wider than 150 units, so a very wide screen doesn't stretch it into a thin strip
        style={{ left: 0, right: 0, marginInline: 'auto', width: `min(100% - ${u(38)}, ${u(150)})`, top: u(29), height: u(35), clipPath: SLANT, background: `linear-gradient(to top, var(--pink) ${u(0.9)}, #000 ${u(0.9)})`, paddingBottom: u(0.9), touchAction: 'none', cursor: 'grab', animationDelay: '0.1s' }}
      >
        <div key={layer + piece.id} className={`absolute inset-0 ${dir > 0 ? 'arc-in-right' : 'arc-in-left'}`} style={{ bottom: u(0.9), animationDuration: '0.28s' }}>
          <BackdropCanvas pieces={preview} animated stage className="w-full h-full block" />
          {!open && <span className="absolute inset-0" style={{ background: 'rgba(5,5,10,0.55)' }} />}
        </div>
        {!open && (
          <span key={'lock' + piece.id} className="absolute arc-display arc-stamp pointer-events-none" style={{ right: u(7), top: u(3), fontSize: u(7), color: '#fff', ['--tilt' as string]: '-8deg', textShadow: `${u(0.4)} ${u(0.4)} 0 #000` }}>
            LOCKED
          </span>
        )}
        {/* Where this piece is among the layer's five: yellow is on the stage, white is open, pink is new, dark is locked */}
        <div className="absolute flex pointer-events-none" style={{ left: 0, right: 0, bottom: u(2.4), justifyContent: 'center', gap: u(1) }} aria-hidden="true">
          {pieces.map((b, i) => (
            <i
              key={b.id}
              style={{
                width: u(i === focus ? 5 : 2.6),
                height: u(1.4),
                minHeight: 5,
                transform: 'skewX(-20deg)',
                background: i === focus ? 'var(--yellow)' : !isUnlocked(b.id) ? '#2c3250' : isNew?.(b.id) ? 'var(--pink)' : '#fff',
                transition: 'width 0.18s',
              }}
            />
          ))}
        </div>
      </div>
      {/* Beside the stage (at the screen's edges, until the stage stops growing) */}
      <div className="absolute z-20 arc-in-left" style={{ left: `max(${u(4)}, 50% - ${u(90)})`, top: u(41), animationDelay: '0.12s' }}>
        <SlantButton onClick={() => move(-1)} aria-label="Previous piece" style={{ width: u(12), padding: 0 }}>
          ‹
        </SlantButton>
      </div>
      <div className="absolute z-20 arc-in-right" style={{ right: `max(${u(4)}, 50% - ${u(90)})`, top: u(41), animationDelay: '0.12s' }}>
        <SlantButton onClick={() => move(1)} aria-label="Next piece" style={{ width: u(12), padding: 0 }}>
          ›
        </SlantButton>
      </div>

      {/* About the piece on the stage */}
      <UnlockInfo>
        <InfoTags index={focus} count={pieces.length} fresh={fresh} locked={!open} notice={notice} />
        <InfoName name={piece.label} locked={!open} />
        <div className="font-bold text-[color:var(--muted)] line-clamp-2" style={{ fontSize: `max(11px, ${u(2.6)})`, lineHeight: 1.25 }}>
          {piece.description}
        </div>
        {open ? (
          inUse ? (
            <SlantButton variant="selected" size="sm" aria-disabled="true" style={{ padding: `0 ${u(6)}`, cursor: 'default', marginTop: u(0.6) }}>
              ✓ In use
            </SlantButton>
          ) : (
            <SlantButton variant="hot" size="sm" hotkey="ENTER" onClick={use} style={{ padding: `0 ${u(8)}`, fontSize: u(4.2), marginTop: u(0.6) }}>
              Use
            </SlantButton>
          )
        ) : isNext && toGo === 0 ? (
          <div className="font-bold text-[color:var(--yellow)]" style={{ fontSize: `max(11px, ${u(2.6)})` }}>
            Opens after your next song
          </div>
        ) : goal !== null ? (
          <>
            <div className="font-bold text-[color:var(--yellow)]" style={{ fontSize: `max(11px, ${u(2.6)})` }}>
              Opens at {goal.toLocaleString()} total score
            </div>
            {isNext && <GoalBar fraction={stats.totalScore / goal} text={`${shortNumber(stats.totalScore)} / ${shortNumber(goal)}`} />}
          </>
        ) : null}
      </UnlockInfo>

      <UnlockFooter earned={earned} count={BACKDROP_ITEMS.length} />
    </ArcadeScreen>
  );
};
