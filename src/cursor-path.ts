// events.json -> a cursor position for any millisecond of the take.
//
// The motion model is "hold, then travel": the cursor sits still at the action it is
// performing, then moves to the next one over the last `travelMs` before that action
// fires. Interpolating evenly between events instead looks wrong - the cursor slides
// away from a field while text is still appearing in it.
//
// Because this is computed at render time, cursor speed and lead are editing
// decisions, not recording decisions. That is the reason the recorder does not draw
// a cursor into the video.

export type RecEvent = {
  t: number; // ms since the start of the recording
  type: 'nav' | 'move' | 'click' | 'type' | 'scroll' | 'flash';
  x: number;
  y: number;
  label?: string;
  text?: string;
};

export type Take = {
  name: string;
  viewport: { width: number; height: number; dpr: number };
  fps: number;
  t0_epoch: number;
  events: RecEvent[];
};

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const POSITIONAL = new Set(['nav', 'move', 'click', 'type', 'scroll']);

// How long a label stays pinned to the cursor after its event fired. Without an
// expiry the last action's label sits on screen for the whole closing hold.
const LABEL_HOLD_MS = 1500;

// A nav moves the camera, it is not something the cursor is doing, so it must never
// raise an action pill - otherwise the URL sits on screen through the opening shot.
const labelAt = (e: RecEvent, ms: number, holdMs: number) =>
  e.type === 'nav' || ms - e.t > holdMs ? undefined : e.label;

// How long a click pulse stays on screen, in ms. Past this the ring has faded out.
const PULSE_MS = 600;

export type CursorState = { x: number; y: number; clickT: number; label?: string };

export function cursorAt(
  ms: number,
  events: RecEvent[],
  travelMs = 480,
  labelHoldMs = LABEL_HOLD_MS
): CursorState {
  const kf = events.filter((e) => POSITIONAL.has(e.type));
  if (kf.length === 0) return { x: -100, y: -100, clickT: -1 };

  // clickT is seconds since the most recent click, or -1 if no pulse is active.
  let clickT = -1;
  for (const e of events) {
    if (e.type === 'click' && ms >= e.t && ms - e.t < PULSE_MS) clickT = (ms - e.t) / 1000;
  }

  if (ms <= kf[0].t) return { x: kf[0].x, y: kf[0].y, clickT, label: labelAt(kf[0], ms, labelHoldMs) };

  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i];
    const b = kf[i + 1];
    if (ms >= a.t && ms <= b.t) {
      const label = labelAt(a, ms, labelHoldMs);
      const moveStart = Math.max(a.t, b.t - travelMs);
      if (ms < moveStart) return { x: a.x, y: a.y, clickT, label };
      const p = easeInOut((ms - moveStart) / (b.t - moveStart));
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), clickT, label };
    }
  }
  const last = kf[kf.length - 1];
  return { x: last.x, y: last.y, clickT, label: labelAt(last, ms, labelHoldMs) };
}

// The label to show while text is being typed. Held for a beat after the last
// keystroke so it does not vanish the instant typing stops.
export function activeLabel(ms: number, events: RecEvent[], holdMs = 1800): string | undefined {
  let label: string | undefined;
  for (const e of events) {
    if (e.type === 'type' && ms >= e.t && ms - e.t < holdMs) label = e.label;
  }
  return label;
}
