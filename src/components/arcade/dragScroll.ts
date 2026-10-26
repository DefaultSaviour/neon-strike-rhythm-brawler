import { useEffect, type RefObject } from 'react';

/**
 * Click-and-drag scrolling for a list, like a phone. Touch already scrolls
 * natively, so this only handles the mouse (and pen). A drag that moves more
 * than a few pixels scrolls the list, and the click that ends it is swallowed
 * so you don't pick the row you let go on. Let go while moving and the list
 * coasts to a stop.
 */

/** Pixels the pointer must move before a press becomes a drag */
export const DRAG_THRESHOLD_PX = 6;
/** How quickly a fling slows down: speed is multiplied by this every second */
const FRICTION_PER_SEC = 0.004;
/** Below this speed (px/s) a fling stops */
const MIN_SPEED = 20;

/** The speed (px/s) a fling has after `dt` seconds of coasting. */
export function coastSpeed(speed: number, dt: number): number {
  const next = speed * Math.pow(FRICTION_PER_SEC, dt);
  return Math.abs(next) < MIN_SPEED ? 0 : next;
}

export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pointerId: number | null = null;
    let startY = 0;
    let startScroll = 0;
    let dragging = false;
    let swallowClick = false;
    // Recent moves, for the fling speed when you let go
    let samples: Array<{ y: number; t: number }> = [];
    let coastFrame = 0;

    const stopCoast = () => {
      cancelAnimationFrame(coastFrame);
      coastFrame = 0;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      stopCoast();
      pointerId = e.pointerId;
      startY = e.clientY;
      startScroll = el.scrollTop;
      dragging = false;
      swallowClick = false;
      samples = [{ y: e.clientY, t: e.timeStamp }];
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        // Now it's a drag. Capture only from here, so a plain click still lands on its row.
        dragging = true;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
      }
      el.scrollTop = startScroll - dy;
      samples.push({ y: e.clientY, t: e.timeStamp });
      if (samples.length > 6) samples.shift();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      swallowClick = true;
      el.style.cursor = '';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

      // Fling: keep going at the speed of the last few moves, slowing down
      const first = samples[0];
      const last = samples[samples.length - 1];
      const span = (last.t - first.t) / 1000;
      if (span <= 0 || e.timeStamp - last.t > 80) return;
      let speed = -(last.y - first.y) / span;
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.05, (now - prev) / 1000);
        prev = now;
        const before = el.scrollTop;
        el.scrollTop += speed * dt;
        speed = coastSpeed(speed, dt);
        // Stop at either end, or once it's slowed right down
        coastFrame = speed !== 0 && el.scrollTop !== before ? requestAnimationFrame(step) : 0;
      };
      coastFrame = requestAnimationFrame(step);
    };

    // The click after a drag would pick whatever row you let go on
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // Stop a fling when the wheel or a key takes over
    const onWheel = () => stopCoast();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('wheel', onWheel, { passive: true });
    // Dragging shouldn't select text or drag the row away as an image
    const onDragStart = (e: DragEvent) => e.preventDefault();
    el.addEventListener('dragstart', onDragStart);
    return () => {
      stopCoast();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dragstart', onDragStart);
    };
  }, [ref]);
}
