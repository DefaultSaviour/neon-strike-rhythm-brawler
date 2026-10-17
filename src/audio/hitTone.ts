/**
 * Hit tone: a short plucked note played when you strike an enemy.
 *
 * To make it sound like part of the song instead of a random beep, we use the
 * pitch of the music at that enemy's beat (measured when the song is charted)
 * and move it up or down by whole octaves into a bright, clear register.
 * Moving by octaves keeps it the same musical note, so it stays in key.
 */

/** Bottom of the register the tone is placed in (G4). The top is one octave up. */
export const HIT_TONE_LOW_HZ = 392;
/** Used when a note has no measured pitch (A4) */
export const HIT_TONE_FALLBACK_HZ = 440;

/** Shift a frequency by whole octaves until it lands in [lowHz, 2 * lowHz). */
export function foldIntoOctave(hz: number, lowHz = HIT_TONE_LOW_HZ): number {
  if (!(hz > 0) || !Number.isFinite(hz)) return HIT_TONE_FALLBACK_HZ;
  let f = hz;
  while (f < lowHz) f *= 2;
  while (f >= lowHz * 2) f /= 2;
  return f;
}

/**
 * Find the strongest frequency between loHz and hiHz in an FFT result.
 * `re`/`im` are the FFT output, `binHz` the width of one bin. Uses a parabola
 * through the peak bin and its neighbours to estimate between bins.
 * Returns undefined if there's no energy in the range.
 */
export function peakHzInBand(
  re: ArrayLike<number>,
  im: ArrayLike<number>,
  binHz: number,
  loHz: number,
  hiHz: number
): number | undefined {
  const k0 = Math.max(1, Math.floor(loHz / binHz));
  const k1 = Math.min(re.length / 2 - 2, Math.ceil(hiHz / binHz));
  const power = (k: number) => re[k] * re[k] + im[k] * im[k];
  let best = -1;
  let bestP = 0;
  for (let k = k0; k <= k1; k++) {
    const pw = power(k);
    if (pw > bestP) {
      bestP = pw;
      best = k;
    }
  }
  if (best < 0 || bestP <= 1e-12) return undefined;
  const a = Math.log(power(best - 1) + 1e-12);
  const b = Math.log(bestP);
  const c = Math.log(power(best + 1) + 1e-12);
  const denom = a - 2 * b + c;
  const shift = Math.abs(denom) > 1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
  return (best + shift) * binHz;
}
