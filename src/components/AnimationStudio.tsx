import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FlipHorizontal,
  Play,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { EnemyTier, FrequencyBand } from '../types/game';
import { assemblePose, ENEMY_MOTION_STYLES, EnemyMotionStyle, PoseRig } from '../game/enemyMotion';
import {
  AnimationLibrary,
  animationPhase,
  BEATS_PER_POSE_OPTIONS,
  builtInAnimation,
  CustomAnimation,
  DragHandle,
  ENEMY_KEYS,
  EnemyKey,
  handleAt,
  MAX_POSES,
  mergeLibraries,
  mirrorRig,
  moveHandle,
  parseLibrary,
  roundLibrary,
  sampleAnimation,
  withAnimation,
} from '../game/customAnimation';
import { getBundledAnimations, getSavedAnimations, setSavedAnimations } from '../game/animationLibrary';
import { getEnemyStyle } from '../game/enemyStyles';
import { SIGNATURE_DANCE_NAMES } from '../game/signatureDances';
import { drawEnemyArt } from './enemyArt';
import { studioView } from './studioView';
import { drawBackdrop, drawHandles, HANDLE_HINTS, SmallButton } from './studioShared';
import { HeroPoseEditor } from './HeroPoseEditor';

/**
 * Pose Studio (the Animation Studio): make your own moves for each enemy.
 *
 * Pick an enemy and the stance to replace, then drag the joints to build
 * Pose 1, Pose 2, ... The preview loops them on the beat. "Save to game"
 * makes the game use them right away (stored in this browser); "Export"
 * downloads a file that can be added to the game for everyone
 * (see game/bundledAnimations.ts).
 */

const HISTORY_LIMIT = 60;
/** How close (in screen pixels) the pointer must be to grab a joint. */
const GRAB_RADIUS_PX = 14;

function bandTier(key: EnemyKey): { band: FrequencyBand; tier: EnemyTier } {
  const [band, tier] = key.split('-');
  return { band: band as FrequencyBand, tier: Number(tier) as EnemyTier };
}

/** The moves that ship with the game for this enemy + stance (its signature dance, or the built-in maths). */
function originalAnimation(key: EnemyKey, style: EnemyMotionStyle): CustomAnimation {
  return getBundledAnimations()[key]?.[style] ?? builtInAnimation(style, bandTier(key).band);
}

/** What to show when opening an enemy + stance: your saved version, else the original. */
function startingAnimation(saved: AnimationLibrary, key: EnemyKey, style: EnemyMotionStyle): CustomAnimation {
  return saved[key]?.[style] ?? originalAnimation(key, style);
}

function withPose(anim: CustomAnimation, index: number, rig: PoseRig): CustomAnimation {
  return { ...anim, poses: anim.poses.map((p, i) => (i === index ? rig : p)) };
}

function beatsLabel(b: number) {
  return b === 0.25 ? '¼ beat' : b === 0.5 ? '½ beat' : b === 1 ? '1 beat' : `${b} beats`;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Draw the enemy in pose units, mapped onto the canvas by `view`. */
function drawEnemyAt(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof studioView>,
  pose: ReturnType<typeof assemblePose>,
  key: EnemyKey,
  beat: number,
  alpha = 1
) {
  const { band, tier } = bandTier(key);
  const style = getEnemyStyle(band, tier);
  const origin = view.toScreen({ x: 0, y: 0 });
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(origin.x, origin.y);
  ctx.scale(view.scale, view.scale);
  ctx.strokeStyle = style.color;
  ctx.shadowColor = style.color;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawEnemyArt(ctx, pose, band, tier, { main: style.color, accent: style.accent }, beat, false);
  ctx.restore();
}

/** Small preview of one pose for the pose strip. */
function PoseThumb({
  rig,
  enemy,
  facingCamera,
  upsideDown,
}: {
  rig: PoseRig;
  enemy: EnemyKey;
  facingCamera: boolean;
  upsideDown?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = 56;
    const h = 68;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const view = studioView(w, h);
    drawEnemyAt(ctx, view, assemblePose(rig, 0, facingCamera, upsideDown), enemy, 0);
  }, [rig, enemy, facingCamera, upsideDown]);
  return <canvas ref={ref} style={{ width: 56, height: 68 }} />;
}

// ---------------------------------------------------------------------------
// The studio
// ---------------------------------------------------------------------------

/** Enemies or heroes: what the studio is editing. */
type StudioMode = 'enemies' | 'heroes';

/**
 * The Pose Studio: an enemy editor and a hero editor, with a switch between
 * them in the header. Switching asks first if there are unsaved changes.
 */
export function AnimationStudio({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<StudioMode>('heroes');
  const modeSwitch = (confirmDiscard: () => boolean) => (
    <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs" role="tablist" aria-label="What to edit">
      {(['heroes', 'enemies'] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => m !== mode && confirmDiscard() && setMode(m)}
          className={`px-3 py-1.5 rounded font-bold capitalize cursor-pointer ${mode === m ? 'bg-cyan-400 text-black' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
  return mode === 'heroes' ? (
    <HeroPoseEditor onClose={onClose} modeSwitch={modeSwitch} />
  ) : (
    <EnemyStudio onClose={onClose} modeSwitch={modeSwitch} />
  );
}

function EnemyStudio({ onClose, modeSwitch }: { onClose: () => void; modeSwitch: (confirm: () => boolean) => React.ReactNode }) {
  const [saved, setSaved] = useState<AnimationLibrary>(() => getSavedAnimations());
  const [enemy, setEnemy] = useState<EnemyKey>('bass-3');
  const [stance, setStance] = useState<EnemyMotionStyle>('dance');
  const [draft, setDraft] = useState<CustomAnimation>(() => startingAnimation(getSavedAnimations(), 'bass-3', 'dance'));
  const [history, setHistory] = useState<CustomAnimation[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [onion, setOnion] = useState(true);
  const [hover, setHover] = useState<DragHandle | null>(null);
  const [message, setMessage] = useState('');

  // Refs let the drawing loop and pointer handlers read the latest values without re-subscribing.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const historyRef = useRef(history);
  const live = useRef({ enemy, selected, playing, bpm, onion, hover, playStart: 0, playIndex: 0 });
  const dragRef = useRef<DragHandle | null>(null);
  draftRef.current = draft;
  historyRef.current = history;
  Object.assign(live.current, { enemy, selected, playing, bpm, onion, hover });

  const sel = Math.min(selected, draft.poses.length - 1);
  const { band, tier } = bandTier(enemy);
  const enemyName = getEnemyStyle(band, tier).name;
  const stanceLabel = ENEMY_MOTION_STYLES.find((s) => s.id === stance)?.label ?? stance;
  const hasSaved = !!saved[enemy]?.[stance];

  // --- editing helpers -----------------------------------------------------

  /** Make a change that Undo can take back. */
  const commit = useCallback((next: CustomAnimation) => {
    const prev = draftRef.current;
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), prev];
    setHistory(historyRef.current);
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const prev = h[h.length - 1];
    historyRef.current = h.slice(0, -1);
    setHistory(historyRef.current);
    draftRef.current = prev;
    setDraft(prev);
    setDirty(true);
  }, []);

  const confirmDiscard = () => !dirty || window.confirm('You have unsaved changes. Discard them?');

  const openSlot = (key: EnemyKey, style: EnemyMotionStyle, lib = saved) => {
    const anim = startingAnimation(lib, key, style);
    setEnemy(key);
    setStance(style);
    draftRef.current = anim;
    setDraft(anim);
    historyRef.current = [];
    setHistory([]);
    setDirty(false);
    setSelected(0);
  };

  const pickSlot = (key: EnemyKey, style: EnemyMotionStyle) => {
    if ((key === enemy && style === stance) || !confirmDiscard()) return;
    openSlot(key, style);
    setMessage('');
  };

  const persist = (lib: AnimationLibrary, okMessage: string) => {
    const ok = setSavedAnimations(lib);
    setSaved(lib);
    setMessage(ok ? okMessage : 'Could not save: this browser blocked storage. Use Export to keep a copy.');
    return ok;
  };

  const save = () => {
    persist(withAnimation(saved, enemy, stance, draft), `Saved! ${enemyName} now uses your moves for "${stanceLabel}".`);
    setDirty(false);
  };

  const removeMine = () => {
    if (!window.confirm(`Remove your "${stanceLabel}" moves for ${enemyName} and go back to the original?`)) return;
    const lib = withAnimation(saved, enemy, stance, null);
    persist(lib, `${enemyName} is back to the original "${stanceLabel}".`);
    openSlot(enemy, stance, lib);
  };

  const exportFile = () => {
    let lib = saved;
    if (dirty) {
      lib = withAnimation(saved, enemy, stance, draft);
      persist(lib, '');
      setDirty(false);
    }
    const all = roundLibrary(mergeLibraries(getBundledAnimations(), lib));
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neon-strike-animations.json';
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Exported neon-strike-animations.json (all your saved animations).');
  };

  const importFile = async (file: File) => {
    try {
      const imported = parseLibrary(JSON.parse(await file.text()));
      const slots = ENEMY_KEYS.reduce((n, k) => n + Object.keys(imported[k] ?? {}).length, 0);
      if (slots === 0) {
        setMessage('No animations found in that file.');
        return;
      }
      if (!confirmDiscard()) return;
      const lib = mergeLibraries(saved, imported);
      persist(lib, `Imported ${slots} animation${slots === 1 ? '' : 's'}.`);
      openSlot(enemy, stance, lib);
    } catch {
      setMessage('That file could not be read. Is it an exported animation file?');
    }
  };

  const close = () => {
    if (confirmDiscard()) onClose();
  };

  // Pose strip actions
  const addPose = () => {
    if (draft.poses.length >= MAX_POSES) return;
    const poses = [...draft.poses];
    poses.splice(sel + 1, 0, draft.poses[sel]);
    commit({ ...draft, poses });
    setSelected(sel + 1);
  };
  const deletePose = () => {
    if (draft.poses.length <= 1) return;
    commit({ ...draft, poses: draft.poses.filter((_, i) => i !== sel) });
    setSelected(Math.max(0, sel - 1));
  };
  const movePose = (dir: -1 | 1) => {
    const to = sel + dir;
    if (to < 0 || to >= draft.poses.length) return;
    const poses = [...draft.poses];
    [poses[sel], poses[to]] = [poses[to], poses[sel]];
    commit({ ...draft, poses });
    setSelected(to);
  };

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p) live.current.playStart = performance.now();
      return !p;
    });
  }, []);

  // --- keyboard shortcuts --------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const n = draftRef.current.poses.length;
        setSelected((s) => (Math.min(s, n - 1) + (e.code === 'ArrowLeft' ? n - 1 : 1)) % n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, togglePlay]);

  // --- drawing loop --------------------------------------------------------

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !wrap || !ctx) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(ctx, w, h);
      const view = studioView(w, h);
      const anim = draftRef.current;
      const L = live.current;
      const index = Math.min(L.selected, anim.poses.length - 1);

      if (L.playing) {
        const beat = ((now - L.playStart) / 1000) * (L.bpm / 60);
        drawEnemyAt(ctx, view, sampleAnimation(anim, beat), L.enemy, beat);
        const current = animationPhase(anim, beat).index;
        if (current !== L.playIndex) {
          L.playIndex = current;
          setPlayIndex(current);
        }
        return;
      }
      // Onion skin: the previous pose, faint, so you can see how far each joint travels.
      if (L.onion && anim.poses.length > 1) {
        const prev = anim.poses[(index - 1 + anim.poses.length) % anim.poses.length];
        drawEnemyAt(ctx, view, assemblePose(prev, 0, anim.facingCamera, anim.upsideDown), L.enemy, 0, 0.18);
      }
      const rig = anim.poses[index];
      drawEnemyAt(ctx, view, assemblePose(rig, 0, anim.facingCamera, anim.upsideDown), L.enemy, 0);
      drawHandles(ctx, view, rig, L.hover);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- pointer editing -----------------------------------------------------

  const pointerInPose = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const view = studioView(rect.width, rect.height);
    return { p: view.toPose({ x: e.clientX - rect.left, y: e.clientY - rect.top }), radius: GRAB_RADIUS_PX / view.scale };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const { p, radius } = pointerInPose(e);
    const anim = draftRef.current;
    const rig = anim.poses[sel];
    const hit = handleAt(rig, p, radius);
    if (!hit) return;
    // Remember the pose before the drag so one Undo takes back the whole drag.
    commit(anim);
    dragRef.current = hit;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (playing) return;
    const { p, radius } = pointerInPose(e);
    const anim = draftRef.current;
    const rig = anim.poses[sel];
    if (dragRef.current) {
      const next = withPose(anim, sel, moveHandle(rig, dragRef.current, p));
      draftRef.current = next;
      setDraft(next);
      return;
    }
    const hit = handleAt(rig, p, radius);
    if (hit !== hover) setHover(hit);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const hint = playing
    ? 'Previewing. Click the figure or press Space to stop and edit.'
    : hover
      ? HANDLE_HINTS[hover]
      : 'Drag any circle to pose: blue = body, yellow = hands and feet, pink = elbows and knees.';

  // --- layout --------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 bg-[#05060f] text-slate-200 flex flex-col overflow-y-auto font-mono">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-lg font-black tracking-widest text-cyan-400">POSE STUDIO</div>
            <div className="text-[11px] text-slate-500">Make your own moves for each enemy</div>
          </div>
          {modeSwitch(confirmDiscard)}
        </div>
        <button
          onClick={close}
          className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 cursor-pointer"
          aria-label="Close the studio"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Enemy + stance pickers */}
      <div className="px-4 pt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ENEMY_KEYS.map((key) => {
            const bt = bandTier(key);
            const st = getEnemyStyle(bt.band, bt.tier);
            const active = key === enemy;
            return (
              <button
                key={key}
                onClick={() => pickSlot(key, stance)}
                aria-pressed={active}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active ? 'bg-slate-800 border-slate-400 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
                {st.name}
                {saved[key]?.[stance] && <span className="text-amber-300" title="Has your custom moves">★</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ENEMY_MOTION_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => pickSlot(enemy, s.id)}
              aria-pressed={s.id === stance}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                s.id === stance ? 'bg-cyan-400/15 border-cyan-400 text-cyan-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="shrink-0 md:shrink md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-3 p-4">
        <div className="flex-1 flex flex-col min-h-[340px] gap-2">
          <div ref={wrapRef} className="relative flex-1 min-h-[300px] rounded-xl border border-slate-800 overflow-hidden">
            <canvas
              ref={canvasRef}
              aria-label="Pose editor: drag the joints to pose the enemy"
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: 'none', cursor: dragRef.current ? 'grabbing' : hover ? 'grab' : 'default' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => !dragRef.current && setHover(null)}
            />
            <div className="absolute top-2 left-3 text-xs text-slate-400 pointer-events-none">
              {enemyName} · {stanceLabel}
              {stance === 'dance' && ` (signature: ${SIGNATURE_DANCE_NAMES[enemy]})`} · {playing ? `Pose ${playIndex + 1}` : `Pose ${sel + 1} of ${draft.poses.length}`}
              {dirty && <span className="text-amber-300"> · unsaved</span>}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 min-h-[16px]">{hint}</div>
        </div>

        <div className="md:w-64 flex flex-col gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
            <button
              onClick={togglePlay}
              className={`w-full py-2 rounded-lg font-extrabold flex items-center justify-center gap-2 cursor-pointer ${
                playing ? 'bg-pink-500 text-black' : 'bg-cyan-400 text-black hover:bg-cyan-300'
              }`}
            >
              {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? 'Stop preview' : 'Play preview'} <span className="opacity-60">(Space)</span>
            </button>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Preview speed: {bpm} BPM</span>
              <input type="range" min={60} max={180} step={5} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Each pose lasts</span>
              <select
                value={draft.beatsPerPose}
                onChange={(e) => commit({ ...draft, beatsPerPose: Number(e.target.value) })}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5"
              >
                {BEATS_PER_POSE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {beatsLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={draft.facingCamera} onChange={(e) => commit({ ...draft, facingCamera: e.target.checked })} />
              <span>Facing the camera</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.upsideDown === true}
                onChange={(e) => {
                  const { upsideDown: _old, ...rest } = draft;
                  commit(e.target.checked ? { ...rest, upsideDown: true } : rest);
                }}
              />
              <span>Upside down (handstand)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} />
              <span>Show previous pose (ghost)</span>
            </label>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-2">
            <button
              onClick={save}
              disabled={!dirty}
              className="w-full py-2 rounded-lg font-extrabold flex items-center justify-center gap-2 bg-amber-300 text-black disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <Save className="w-4 h-4" /> Save to game
            </button>
            <div className="grid grid-cols-2 gap-2">
              <SmallButton onClick={undo} disabled={history.length === 0} icon={<Undo2 className="w-3.5 h-3.5" />} label="Undo" />
              <SmallButton
                onClick={() => commit(originalAnimation(enemy, stance))}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                label="Start over"
                title="Replace the poses with the original moves (you can Undo)"
              />
              <SmallButton onClick={exportFile} icon={<Download className="w-3.5 h-3.5" />} label="Export" title="Download all your animations as a file" />
              <SmallButton onClick={() => fileRef.current?.click()} icon={<Upload className="w-3.5 h-3.5" />} label="Import" title="Load an exported animation file" />
            </div>
            {hasSaved && (
              <button onClick={removeMine} className="text-[11px] text-slate-500 hover:text-pink-400 underline cursor-pointer self-start">
                Remove my version (use the original)
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = '';
              }}
            />
            {message && <div className="text-[11px] text-amber-200">{message}</div>}
          </div>
        </div>
      </div>

      {/* Pose strip */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {draft.poses.map((rig, i) => {
            const active = playing ? i === playIndex : i === sel;
            return (
              <button
                key={i}
                onClick={() => {
                  setPlaying(false);
                  setSelected(i);
                }}
                className={`shrink-0 rounded-lg border p-1 flex flex-col items-center cursor-pointer ${
                  active ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                }`}
              >
                <PoseThumb rig={rig} enemy={enemy} facingCamera={draft.facingCamera} upsideDown={draft.upsideDown} />
                <span className="text-[10px] text-slate-400">Pose {i + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
          <SmallButton onClick={addPose} disabled={draft.poses.length >= MAX_POSES} icon={<Copy className="w-3.5 h-3.5" />} label="Add pose (copy this one)" />
          <SmallButton onClick={() => commit(withPose(draft, sel, mirrorRig(draft.poses[sel])))} icon={<FlipHorizontal className="w-3.5 h-3.5" />} label="Mirror" title="Swap left and right limbs" />
          <SmallButton onClick={() => movePose(-1)} disabled={sel === 0} icon={<ChevronLeft className="w-3.5 h-3.5" />} label="Move earlier" />
          <SmallButton onClick={() => movePose(1)} disabled={sel >= draft.poses.length - 1} icon={<ChevronRight className="w-3.5 h-3.5" />} label="Move later" />
          <SmallButton onClick={deletePose} disabled={draft.poses.length <= 1} icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete pose" />
        </div>
      </div>
    </div>
  );
}
