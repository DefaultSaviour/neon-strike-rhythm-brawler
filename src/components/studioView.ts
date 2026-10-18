import { Point } from '../game/enemyMotion';
import { EDIT_BOUNDS } from '../game/customAnimation';

/**
 * Converts between canvas pixels and pose units for the Animation Studio, so
 * the whole editable area (plus a margin) fits the canvas at any size.
 */
export interface StudioView {
  scale: number;
  toScreen(p: Point): Point;
  toPose(p: Point): Point;
}

const MARGIN = 12;

export function studioView(width: number, height: number): StudioView {
  const minX = EDIT_BOUNDS.minX - MARGIN;
  const maxX = EDIT_BOUNDS.maxX + MARGIN;
  const minY = EDIT_BOUNDS.minY - MARGIN;
  const maxY = EDIT_BOUNDS.maxY + MARGIN;
  const scale = Math.max(0.01, Math.min(width / (maxX - minX), height / (maxY - minY)));
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  return {
    scale,
    toScreen: (p) => ({ x: (p.x - centreX) * scale + width / 2, y: (p.y - centreY) * scale + height / 2 }),
    toPose: (p) => ({ x: (p.x - width / 2) / scale + centreX, y: (p.y - height / 2) / scale + centreY }),
  };
}
