import { describe, expect, it } from 'vitest';
import { addHitLog, HIT_LOG_MAX_ROWS, HIT_LOG_SECONDS, hitLogArea, HitLogEntry, liveHitLog } from './hitLog';
import { computeArenaLayout, FIGHTER_HEIGHT } from './layout';

const entry = (id: number, lane: 'left' | 'right', at = 0): HitLogEntry => ({ id, lane, text: 'PERFECT', move: 'Jab', at });

describe('the hit lists', () => {
  it('keep at most HIT_LOG_MAX_ROWS lines a side, dropping that side\'s oldest', () => {
    let log: HitLogEntry[] = [entry(0, 'right')];
    for (let i = 1; i <= HIT_LOG_MAX_ROWS + 2; i++) log = addHitLog(log, entry(i, 'left'));
    const left = log.filter((e) => e.lane === 'left');
    expect(left).toHaveLength(HIT_LOG_MAX_ROWS);
    expect(left[0].id).toBe(3);
    // The other side is untouched
    expect(log.some((e) => e.id === 0)).toBe(true);
  });

  it('let lines go after a few seconds', () => {
    const log = [entry(1, 'left', 0), entry(2, 'left', 4000)];
    expect(liveHitLog(log, HIT_LOG_SECONDS * 1000 - 1)).toHaveLength(2);
    expect(liveHitLog(log, HIT_LOG_SECONDS * 1000).map((e) => e.id)).toEqual([2]);
  });
});

describe('where the lists go', () => {
  // The score row is centred and at most 896 px wide (the HUD's max-w-4xl): combo left, rank middle, score right
  const hudFor = (w: number, top: number, bottom: number) => {
    const rowW = Math.min(896, w - 48);
    const left = (w - rowW) / 2;
    const right = (w + rowW) / 2;
    return { left, right, top, bottom, comboRight: left + 85, rankLeft: w / 2 - 25, rankRight: w / 2 + 25, scoreLeft: right - 60 };
  };
  // Width, height, and where the score row sat on that screen (measured in the browser)
  const screens: [number, number, number, number][] = [
    [1920, 1080, 120, 185],
    [2000, 924, 120, 185],
    [1366, 768, 120, 185],
    [767, 900, 105, 165],
    [844, 390, 111, 179],
    [667, 375, 111, 179],
    [2560, 960, 120, 185],
    [3440, 1440, 120, 185],
  ];

  for (const [w, h, hudTop, hudBottom] of screens) {
    it(`fit a ${w}x${h} screen, clear of the score row, the middle and the fighters`, () => {
      const layout = computeArenaLayout(w, h);
      const hud = hudFor(w, hudTop, hudBottom);
      const heads = layout.floorScreenY - FIGHTER_HEIGHT * layout.scale;
      const a = hitLogArea(w, h, layout.horizonY - 10, heads - 24, layout.scale, hud);
      const top = a.bottom - a.rows * a.lineH;
      // Every screen with room shows all six; phones on their side get the score row's gaps
      expect(a.rows).toBeGreaterThanOrEqual(h >= 600 ? 6 : 3);
      // Lines stay out of the middle, where the fighter, the rank and the PRACTICE banner are
      expect(a.leftX + a.maxWidth).toBeLessThanOrEqual(Math.max(w * 0.35, hud.rankLeft));
      expect(a.rightX - a.maxWidth).toBeGreaterThanOrEqual(Math.min(w * 0.65, hud.rankRight));
      const inSky = a.bottom < heads && (a.leftX + a.maxWidth <= hud.left || top >= hud.bottom - 1);
      const inRowGaps = a.leftX >= hud.comboRight && a.leftX + a.maxWidth <= hud.rankLeft && a.rightX <= hud.scoreLeft && top >= hud.top - 1 && a.bottom <= hud.bottom;
      expect(inSky || inRowGaps).toBe(true);
      // Within the 16:9 middle, so ultra-wide screens keep them near the fight
      const margin = (w - Math.min(w, (h * 16) / 9)) / 2;
      expect(a.leftX).toBeGreaterThanOrEqual(margin);
      expect(a.rightX).toBeLessThanOrEqual(w - margin);
    });
  }

  it("use the score row's gaps only when the sky is too small", () => {
    const big = computeArenaLayout(1366, 768);
    expect(hitLogArea(1366, 768, big.horizonY - 10, big.floorScreenY - FIGHTER_HEIGHT * big.scale - 24, big.scale, hudFor(1366, 120, 185)).leftX).toBeCloseTo(24, 0);
    const phone = computeArenaLayout(844, 390);
    expect(hitLogArea(844, 390, phone.horizonY - 10, phone.floorScreenY - FIGHTER_HEIGHT * phone.scale - 24, phone.scale, hudFor(844, 111, 179)).leftX).toBeGreaterThan(100);
  });

  it('look the same on every 16:9 screen, just scaled: same lines, text in step with the fight', () => {
    const at = (w: number, h: number) => {
      const L = computeArenaLayout(w, h);
      const heads = L.floorScreenY - FIGHTER_HEIGHT * L.scale;
      return hitLogArea(w, h, L.horizonY - 10, heads - 24, L.scale, hudFor(w, 120, 185));
    };
    const big = at(1920, 1080);
    const mid = at(1600, 900);
    expect(mid.rows).toBe(big.rows);
    expect(mid.lineH / 900).toBeCloseTo(big.lineH / 1080, 2);
    expect(mid.leftX).toBe(big.leftX);
  });

  it('keep the same size on an ultra-wide screen as on a 16:9 one of the same height', () => {
    const at = (w: number, h: number) => {
      const L = computeArenaLayout(w, h);
      return hitLogArea(w, h, L.horizonY - 10, L.floorScreenY - FIGHTER_HEIGHT * L.scale - 24, L.scale, hudFor(w, 120, 185));
    };
    expect(at(2560, 1080).lineH).toBeCloseTo(at(1920, 1080).lineH, 0);
    expect(at(2560, 1080).leftX).toBeCloseTo((2560 - 1920) / 2 + 24, 0);
  });
});
