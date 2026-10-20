import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, Copy, FlipHorizontal, Play, RotateCcw, Save, Square, Trash2, Undo2, X } from 'lucide-react';
import { AttackMove, SkeletonPose } from '../types/game';
import { assemblePose, PoseRig } from '../game/enemyMotion';
import { DragHandle, handleAt, MAX_POSES, mirrorRig, moveHandle } from '../game/customAnimation';
import { HeroDefinition, HeroId, HEROES } from '../game/heroes';
import {
  applyEdit,
  editForSharing,
  editFromMove,
  editFromStance,
  HERO_HIP_LIMITS,
  HeroPoseEdit,
  HeroPoseLibrary,
  POSE_MS_OPTIONS,
  STANCE_SLOT,
} from '../game/heroPoses';
import { getSavedHeroPoses, setSavedHeroPoses } from '../game/heroPoseLibrary';
import { comboDuration, comboFrame } from '../game/combo';
import { keyToPlayerPose } from '../game/heroMoves/poseBuilder';
import { fighterTier } from '../game/fighterTier';
import { drawFighter, drawSlashCrescent } from './fighterArt';
import { studioView } from './studioView';
import { drawBackdrop, drawHandles, HANDLE_HINTS, SmallButton } from './studioShared';

/**
 * The Pose Studio's hero editor: pick a hero and one of their moves (or their
 * stance), then drag the joints of each pose. "Save to game" makes the game
 * use your version straight away (stored in this browser); "Copy for Claude"
 * copies the poses as text to paste into a chat.
 */

const HISTORY_LIMIT = 60;
const GRAB_RADIUS_PX = 14;
/** A short pause between loops of the preview, so you can see where the move ends. */
const LOOP_PAUSE_SEC = 0.45;

const baseHero = (id: HeroId): HeroDefinition => HEROES.find((h) => h.id === id) ?? HEROES[0];
const findMove = (hero: HeroDefinition, slot: string): AttackMove | undefined => hero.moves.find((m) => m.name === slot);

/** The poses that ship with the game for this hero + slot. */
function originalEdit(heroId: HeroId, slot: string): HeroPoseEdit {
  const hero = baseHero(heroId);
  if (slot === STANCE_SLOT) return editFromStance(hero.idlePose);
  const move = findMove(hero, slot);
  return move?.sequence ? editFromMove(move) : editFromStance(hero.idlePose);
}

function startingEdit(lib: HeroPoseLibrary, heroId: HeroId, slot: string): HeroPoseEdit {
  return lib[heroId]?.[slot] ?? originalEdit(heroId, slot);
}

function withEditPose(edit: HeroPoseEdit, index: number, rig: PoseRig): HeroPoseEdit {
  return { ...edit, poses: edit.poses.map((p, i) => (i === index ? rig : p)) };
}

/** A pose as the hero's own skeleton. */
const playerPose = (rig: PoseRig): SkeletonPose => keyToPlayerPose({ pose: assemblePose(rig, 0, false), ms: 0 });

function drawHeroAt(ctx: CanvasRenderingContext2D, view: ReturnType<typeof studioView>, pose: SkeletonPose, hero: HeroId, alpha = 1, effect = true) {
  const origin = view.toScreen({ x: 0, y: 0 });
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(origin.x, origin.y);
  ctx.scale(view.scale, view.scale);
  drawFighter(ctx, pose, { tier: fighterTier(0), facing: 1, time: performance.now() / 1000, hero, random: () => 0.5, noBuild: true });
  if (effect && pose.bladeSlash) drawSlashCrescent(ctx, pose.bladeSlash);
  ctx.restore();
}

function HeroThumb({ rig, hero }: { rig: PoseRig; hero: HeroId }) {
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
    drawHeroAt(ctx, studioView(w, h), playerPose(rig), hero, 1, false);
  }, [rig, hero]);
  return <canvas ref={ref} style={{ width: 56, height: 68 }} />;
}

export function HeroPoseEditor({ onClose, modeSwitch }: { onClose: () => void; modeSwitch: (confirm: () => boolean) => React.ReactNode }) {
  const [saved, setSaved] = useState<HeroPoseLibrary>(() => getSavedHeroPoses());
  const [heroId, setHeroId] = useState<HeroId>(HEROES[1]?.id ?? HEROES[0].id);
  const [slot, setSlot] = useState<string>(() => baseHero(HEROES[1]?.id ?? HEROES[0].id).moves[0]?.name ?? STANCE_SLOT);
  const [draft, setDraft] = useState<HeroPoseEdit>(() => startingEdit(getSavedHeroPoses(), heroId, slot));
  const [history, setHistory] = useState<HeroPoseEdit[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [onion, setOnion] = useState(true);
  const [hover, setHover] = useState<DragHandle | null>(null);
  const [message, setMessage] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  const historyRef = useRef(history);
  const live = useRef({ heroId, slot, selected, playing, onion, hover, playStart: 0 });
  const dragRef = useRef<DragHandle | null>(null);
  draftRef.current = draft;
  historyRef.current = history;
  Object.assign(live.current, { heroId, slot, selected, playing, onion, hover });

  const hero = baseHero(heroId);
  const isStance = slot === STANCE_SLOT;
  const sel = Math.min(selected, draft.poses.length - 1);
  const hasSaved = !!saved[heroId]?.[slot];
  const moveTier = findMove(hero, slot)?.tier;

  // --- editing helpers -----------------------------------------------------

  const commit = useCallback((next: HeroPoseEdit) => {
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), draftRef.current];
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

  const open = (id: HeroId, s: string, lib = saved) => {
    const edit = startingEdit(lib, id, s);
    setHeroId(id);
    setSlot(s);
    draftRef.current = edit;
    setDraft(edit);
    historyRef.current = [];
    setHistory([]);
    setDirty(false);
    setSelected(0);
    setPlaying(false);
  };

  const pick = (id: HeroId, s: string) => {
    if ((id === heroId && s === slot) || !confirmDiscard()) return;
    open(id, s);
    setMessage('');
  };

  const persist = (lib: HeroPoseLibrary, okMessage: string) => {
    const ok = setSavedHeroPoses(lib);
    setSaved(lib);
    setMessage(ok ? okMessage : 'Could not save: this browser blocked storage. Use Copy for Claude instead.');
  };

  const save = () => {
    persist({ ...saved, [heroId]: { ...(saved[heroId] ?? {}), [slot]: draft } }, `Saved! ${hero.label} now uses your "${slot}" in the game.`);
    setDirty(false);
  };

  const removeMine = () => {
    if (!window.confirm(`Remove your "${slot}" for ${hero.label} and go back to the original?`)) return;
    const mine = { ...(saved[heroId] ?? {}) };
    delete mine[slot];
    const lib = { ...saved, [heroId]: mine };
    persist(lib, `${hero.label} is back to the original "${slot}".`);
    open(heroId, slot, lib);
  };

  const copyForClaude = async () => {
    const text = editForSharing(heroId, slot, draft);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied! Paste it into the chat with Claude.');
    } catch {
      setMessage('Could not copy here. Press Save to game instead: Claude can read saved poses from this browser.');
    }
  };

  const close = () => {
    if (confirmDiscard()) onClose();
  };

  // Pose strip actions (the stance is a single pose)
  const addPose = () => {
    if (isStance || draft.poses.length >= MAX_POSES) return;
    const poses = [...draft.poses];
    const ms = [...draft.ms];
    poses.splice(sel + 1, 0, draft.poses[sel]);
    ms.splice(sel + 1, 0, 120);
    commit({ poses, ms });
    setSelected(sel + 1);
  };
  const deletePose = () => {
    if (draft.poses.length <= 1) return;
    commit({ poses: draft.poses.filter((_, i) => i !== sel), ms: draft.ms.filter((_, i) => i !== sel) });
    setSelected(Math.max(0, sel - 1));
  };
  const movePose = (dir: -1 | 1) => {
    const to = sel + dir;
    if (to < 0 || to >= draft.poses.length) return;
    const poses = [...draft.poses];
    const ms = [...draft.ms];
    [poses[sel], poses[to]] = [poses[to], poses[sel]];
    [ms[sel], ms[to]] = [ms[to], ms[sel]];
    commit({ poses, ms });
    setSelected(to);
  };

  const togglePlay = useCallback(() => {
    if (live.current.slot === STANCE_SLOT) return;
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
      drawBackdrop(ctx, w, h, HERO_HIP_LIMITS.zone);
      const view = studioView(w, h);
      const L = live.current;
      const edit = draftRef.current;
      const h0 = baseHero(L.heroId);
      const index = Math.min(L.selected, edit.poses.length - 1);

      if (L.playing) {
        // Play the move the way the game does: snap into the hit, through each pose, back to the stance.
        const move = findMove(h0, L.slot);
        if (move?.sequence) {
          const built = applyEdit(move, edit);
          const keys = built.sequence!;
          const rest = h0.idlePose;
          const total = comboDuration(keys) + LOOP_PAUSE_SEC;
          const t = ((now - L.playStart) / 1000) % total;
          const f = comboFrame(t, rest, keys, rest, 0, (p) => p);
          drawHeroAt(ctx, view, f.pose, L.heroId);
        }
        return;
      }
      if (L.onion && edit.poses.length > 1 && index > 0) {
        drawHeroAt(ctx, view, playerPose(edit.poses[index - 1]), L.heroId, 0.18, false);
      }
      const rig = edit.poses[index];
      // Show the hit effect on this pose, as the game will.
      const move = findMove(h0, L.slot);
      let pose = playerPose(rig);
      if (move?.sequence) {
        const built = applyEdit(move, edit).sequence!.filter((k) => !k.hold);
        if (built[index]) pose = keyToPlayerPose(built[index]);
      }
      drawHeroAt(ctx, view, pose, L.heroId);
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
    const hit = handleAt(draftRef.current.poses[sel], p, radius);
    if (!hit) return;
    commit(draftRef.current);
    dragRef.current = hit;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (playing) return;
    const { p, radius } = pointerInPose(e);
    const edit = draftRef.current;
    const rig = edit.poses[sel];
    if (dragRef.current) {
      const next = withEditPose(edit, sel, moveHandle(rig, dragRef.current, p, HERO_HIP_LIMITS));
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
    ? 'Previewing the move as it plays in the game. Click the figure or press Space to stop and edit.'
    : hover
      ? HANDLE_HINTS[hover].replace('timing zone so the enemy stays in time', 'shaded zone so the hero stays on his spot')
      : 'Drag any circle to pose: blue = body, yellow = hands and feet, pink = elbows and knees.';

  // --- layout --------------------------------------------------------------

  const slots: Array<{ name: string; label: string }> = [
    { name: STANCE_SLOT, label: 'Stance (between attacks)' },
    ...hero.moves.filter((m) => m.sequence).map((m) => ({ name: m.name, label: `Tier ${m.tier} · ${m.name}` })),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#05060f] text-slate-200 flex flex-col overflow-y-auto font-mono">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-lg font-black tracking-widest text-cyan-400">POSE STUDIO</div>
            <div className="text-[11px] text-slate-500">Reshape any hero's moves</div>
          </div>
          {modeSwitch(confirmDiscard)}
        </div>
        <button onClick={close} className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 cursor-pointer" aria-label="Close the studio">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Hero + move pickers */}
      <div className="px-4 pt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {HEROES.map((h) => (
            <button
              key={h.id}
              onClick={() => pick(h.id, h.id === heroId ? slot : h.moves.find((m) => m.sequence)?.name ?? STANCE_SLOT)}
              aria-pressed={h.id === heroId}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                h.id === heroId ? 'bg-slate-800 border-slate-400 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {h.label}
              {saved[h.id] && Object.keys(saved[h.id]!).length > 0 && <span className="text-amber-300" title="Has your edits"> ★</span>}
            </button>
          ))}
        </div>
        <select
          value={slot}
          onChange={(e) => pick(heroId, e.target.value)}
          className="self-start bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
          aria-label="Which move to edit"
        >
          {slots.map((s) => (
            <option key={s.name} value={s.name}>
              {s.label}
              {saved[heroId]?.[s.name] ? ' ★' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Canvas + side panel */}
      <div className="shrink-0 md:shrink md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-3 p-4">
        <div className="flex-1 flex flex-col min-h-[340px] gap-2">
          <div ref={wrapRef} className="relative flex-1 min-h-[300px] rounded-xl border border-slate-800 overflow-hidden">
            <canvas
              ref={canvasRef}
              aria-label="Pose editor: drag the joints to pose the hero"
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: 'none', cursor: dragRef.current ? 'grabbing' : hover ? 'grab' : 'default' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={() => !dragRef.current && setHover(null)}
            />
            <div className="absolute top-2 left-3 text-xs text-slate-400 pointer-events-none">
              {hero.label} · {slot}
              {moveTier && ` (tier ${moveTier})`} · {isStance ? 'Stance' : `Pose ${sel + 1} of ${draft.poses.length}`}
              {sel === 0 && !isStance && <span className="text-cyan-300"> · the hit</span>}
              {dirty && <span className="text-amber-300"> · unsaved</span>}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 min-h-[16px]">{hint}</div>
        </div>

        <div className="md:w-64 flex flex-col gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
            <button
              onClick={togglePlay}
              disabled={isStance}
              className={`w-full py-2 rounded-lg font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                playing ? 'bg-pink-500 text-black' : 'bg-cyan-400 text-black hover:bg-cyan-300'
              }`}
            >
              {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? 'Stop preview' : 'Play the move'} <span className="opacity-60">(Space)</span>
            </button>
            {!isStance && (
              <label className="flex flex-col gap-1">
                <span className="text-slate-400">{sel === 0 ? 'The hit lands on the beat' : `Time to reach pose ${sel + 1}`}</span>
                <select
                  value={draft.ms[sel]}
                  disabled={sel === 0}
                  onChange={(e) => commit({ ...draft, ms: draft.ms.map((m, i) => (i === sel ? Number(e.target.value) : m)) })}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 disabled:opacity-40"
                >
                  {sel === 0 ? (
                    <option value={draft.ms[0]}>instant</option>
                  ) : (
                    Array.from(new Set([...POSE_MS_OPTIONS, draft.ms[sel]]))
                      .sort((a, b) => a - b)
                      .map((ms) => (
                        <option key={ms} value={ms}>
                          {ms} ms
                        </option>
                      ))
                  )}
                </select>
              </label>
            )}
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
            <button
              onClick={() => void copyForClaude()}
              className="w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/10 cursor-pointer"
              title="Copy these poses as text to paste into the chat"
            >
              <Clipboard className="w-4 h-4" /> Copy for Claude
            </button>
            <div className="grid grid-cols-2 gap-2">
              <SmallButton onClick={undo} disabled={history.length === 0} icon={<Undo2 className="w-3.5 h-3.5" />} label="Undo" />
              <SmallButton
                onClick={() => commit(originalEdit(heroId, slot))}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                label="Start over"
                title="Replace the poses with the original move (you can Undo)"
              />
            </div>
            {hasSaved && (
              <button onClick={removeMine} className="text-[11px] text-slate-500 hover:text-pink-400 underline cursor-pointer self-start">
                Remove my version (use the original)
              </button>
            )}
            {message && <div className="text-[11px] text-amber-200">{message}</div>}
          </div>
        </div>
      </div>

      {/* Pose strip */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {draft.poses.map((rig, i) => (
            <button
              key={i}
              onClick={() => {
                setPlaying(false);
                setSelected(i);
              }}
              className={`shrink-0 rounded-lg border p-1 flex flex-col items-center cursor-pointer ${
                i === sel ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
              }`}
            >
              <HeroThumb rig={rig} hero={heroId} />
              <span className="text-[10px] text-slate-400">{isStance ? 'Stance' : i === 0 ? 'Hit' : `Pose ${i + 1}`}</span>
            </button>
          ))}
        </div>
        {!isStance && (
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <SmallButton onClick={addPose} disabled={draft.poses.length >= MAX_POSES} icon={<Copy className="w-3.5 h-3.5" />} label="Add pose (copy this one)" />
            <SmallButton onClick={() => commit(withEditPose(draft, sel, mirrorRig(draft.poses[sel])))} icon={<FlipHorizontal className="w-3.5 h-3.5" />} label="Mirror" title="Swap the front and back limbs" />
            <SmallButton onClick={() => movePose(-1)} disabled={sel === 0} icon={<ChevronLeft className="w-3.5 h-3.5" />} label="Move earlier" />
            <SmallButton onClick={() => movePose(1)} disabled={sel >= draft.poses.length - 1} icon={<ChevronRight className="w-3.5 h-3.5" />} label="Move later" />
            <SmallButton onClick={deletePose} disabled={draft.poses.length <= 1} icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete pose" />
          </div>
        )}
      </div>
    </div>
  );
}
