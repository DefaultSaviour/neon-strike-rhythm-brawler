import React from 'react';
import { FLOOR, PoseRig } from '../game/enemyMotion';
import { DRAG_HANDLES, DragHandle, HIP_ZONE, handlePosition } from '../game/customAnimation';
import { studioView } from './studioView';

/** Pieces shared by the Pose Studio's enemy and hero editors. */

export const HANDLE_HINTS: Record<DragHandle, string> = {
  head: 'Head: drag to tilt',
  chest: 'Chest: drag to lean the body',
  pelvis: 'Hips: drag to move the body. They stay inside the shaded timing zone so the enemy stays in time',
  frontHand: 'Front hand: drag to place',
  backHand: 'Back hand: drag to place',
  frontFoot: 'Front foot: drag to place',
  backFoot: 'Back foot: drag to place',
  frontElbow: 'Front elbow: drag to swing the arm (past straight bends it the other way)',
  backElbow: 'Back elbow: drag to swing the arm (past straight bends it the other way)',
  frontKnee: 'Front knee: drag to swing the leg (past straight bends it the other way)',
  backKnee: 'Back knee: drag to swing the leg (past straight bends it the other way)',
};

/** Handle colours: cyan for the body line, yellow for hands and feet, pink for elbows and knees. */
export function handleColour(h: DragHandle) {
  if (h === 'head' || h === 'chest' || h === 'pelvis') return '#00e5ff';
  if (h.endsWith('Elbow') || h.endsWith('Knee')) return '#ff4fd8';
  return '#ffe600';
}


// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** The editing backdrop: grid, the shaded zone the hips must stay in, the centre line and the floor. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, hipZone = HIP_ZONE) {
  ctx.fillStyle = '#070816';
  ctx.fillRect(0, 0, w, h);
  const view = studioView(w, h);
  ctx.lineWidth = 1;
  // Faint 10-unit grid to help line poses up
  ctx.strokeStyle = 'rgba(120, 140, 255, 0.07)';
  ctx.beginPath();
  for (let x = -200; x <= 200; x += 10) {
    const s = view.toScreen({ x, y: 0 }).x;
    ctx.moveTo(s, 0);
    ctx.lineTo(s, h);
  }
  for (let y = -300; y <= 200; y += 10) {
    const s = view.toScreen({ x: 0, y }).y;
    ctx.moveTo(0, s);
    ctx.lineTo(w, s);
  }
  ctx.stroke();
  // Timing zone: the hips must stay inside it (see HIP_ZONE)
  const zoneLeft = view.toScreen({ x: -hipZone, y: 0 }).x;
  const zoneRight = view.toScreen({ x: hipZone, y: 0 }).x;
  const zoneFloor = view.toScreen({ x: 0, y: FLOOR }).y;
  ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
  ctx.fillRect(zoneLeft, 0, zoneRight - zoneLeft, zoneFloor);
  ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('timing zone', (zoneLeft + zoneRight) / 2, 14);
  ctx.textAlign = 'left';
  // Centre line and floor
  const floor = view.toScreen({ x: 0, y: FLOOR }).y;
  const centre = view.toScreen({ x: 0, y: 0 }).x;
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(centre, 0);
  ctx.lineTo(centre, floor);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floor);
  ctx.lineTo(w, floor);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
  ctx.fillRect(0, floor, w, h - floor);
}

export function drawHandles(
  ctx: CanvasRenderingContext2D,
  view: ReturnType<typeof studioView>,
  rig: PoseRig,
  hover: DragHandle | null
) {
  ctx.save();
  for (const h of DRAG_HANDLES) {
    const s = view.toScreen(handlePosition(rig, h));
    const on = hover === h;
    const colour = handleColour(h);
    ctx.beginPath();
    ctx.arc(s.x, s.y, on ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = on ? colour : 'rgba(10, 10, 25, 0.75)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.shadowColor = colour;
    ctx.shadowBlur = on ? 12 : 6;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function SmallButton({
  onClick,
  icon,
  label,
  title,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/70 hover:border-slate-500 flex items-center justify-center gap-1.5 disabled:opacity-35 cursor-pointer disabled:cursor-default"
    >
      {icon}
      {label}
    </button>
  );
}
