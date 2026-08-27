import React from 'react';
import {
  AbsoluteFill,
  Freeze,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Cursor } from './Cursor';
import { ActionPill, ChapterTitle } from './Overlays';
import { cursorAt, activeLabel, RecEvent } from './cursor-path';
import { theme } from './theme';

export type Zoom = {
  scale: number;
  /** Focal point in video pixels. Defaults to the centre of the canvas. */
  fx?: number;
  fy?: number;
  /** Let the focal point track the cursor on that axis. */
  followX?: boolean;
  followY?: boolean;
  fxMin?: number;
  fxMax?: number;
  fyMin?: number;
  fyMax?: number;
  /**
   * Ramp the zoom in only while the cursor is inside a region, instead of holding it
   * for the whole scene. Useful when one take covers both a full-width list and a
   * narrow side panel: `{ axis: 'x', from: 1050, to: 1400 }` stays at scale 1 over the
   * list and reaches `scale` once the cursor is well inside the panel.
   */
  auto?: { axis?: 'x' | 'y'; from: number; to: number };
};

export type SceneProps = {
  /** Path under public/, e.g. 'captures/signup.webm'. */
  clip: string;
  events: RecEvent[];
  /** Frames to skip off the front of the clip (browser startup, login, setup). */
  trim?: number;
  /**
   * Frame at which the video freezes for the rest of the scene. Use it to hold on a
   * result longer than the recording did. Defaults to the full scene duration.
   */
  play?: number;
  index?: string;
  title?: string;
  zoom?: Zoom;
  /** ms the cursor arrives ahead of the action it is about to perform. */
  cursorLead?: number;
  /** Rename or suppress recorded labels at render time. Map to '' to hide one. */
  labelMap?: Record<string, string>;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * One recorded take, composited: untouched screen video underneath, synthetic
 * cursor, click pulses, action pill and chapter title on top, all inside a camera
 * that can zoom and drift.
 *
 * The layer order matters. The cursor and pill live *inside* the zoom transform so
 * they stay pinned to the UI they point at; the chapter title lives outside it so it
 * stays put while the camera moves.
 */
export const Scene: React.FC<SceneProps> = ({
  clip,
  events,
  trim = 0,
  play,
  index,
  title,
  zoom,
  cursorLead = 400,
  labelMap,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;

  const playUntil = play ?? durationInFrames;
  // Past playUntil the video is frozen, so the timeline must stop advancing too or
  // the cursor would keep moving over a still frame.
  const held = Math.min(frame, playUntil - 1);
  const ms = ((trim + held) / fps) * 1000;

  const c = cursorAt(ms + cursorLead, events);
  const raw = c.label ?? activeLabel(ms, events);
  const mapped = raw ? labelMap?.[raw] ?? raw : undefined;
  const label = mapped === '' ? undefined : mapped;

  // Camera. `s` is the zoom factor; `fx/fy` the point that stays centred.
  let s = zoom?.scale ?? 1;
  if (zoom?.auto) {
    const { axis = 'x', from, to } = zoom.auto;
    const pos = axis === 'x' ? c.x : c.y;
    s = 1 + (zoom.scale - 1) * clamp((pos - from) / (to - from), 0, 1);
  }
  // Clamp the focal point so the zoomed frame never runs past the video's edges,
  // which would letterbox the sides mid-shot.
  const edgeX = cx / s;
  const edgeY = cy / s;
  let fx = zoom?.fx ?? cx;
  let fy = zoom?.fy ?? cy;
  if (zoom?.followX) fx = clamp(c.x, zoom.fxMin ?? edgeX, zoom.fxMax ?? width - edgeX);
  if (zoom?.followY) fy = clamp(c.y, zoom.fyMin ?? edgeY, zoom.fyMax ?? height - edgeY);
  fx = clamp(fx, edgeX, width - edgeX);
  fy = clamp(fy, edgeY, height - edgeY);
  const world = s <= 1.001 ? undefined : `translate(${cx - s * fx}px, ${cy - s * fy}px) scale(${s})`;

  // A slow push plus a stronger one over the frozen tail. Without it a long hold
  // reads as a screenshot someone forgot to cut away from.
  const p = durationInFrames > 0 ? frame / durationInFrames : 0;
  const tail =
    playUntil < durationInFrames ? clamp((frame - playUntil) / (durationInFrames - playUntil), 0, 1) : 0;
  const camera = `scale(${(1 + 0.016 * p + 0.028 * tail).toFixed(4)}) translateY(${(-5 * p - 12 * tail).toFixed(1)}px)`;

  const video = <OffthreadVideo src={staticFile(clip)} startFrom={trim} muted />;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <AbsoluteFill style={{ transform: camera, transformOrigin: 'center center' }}>
        <AbsoluteFill style={{ transform: world, transformOrigin: '0 0' }}>
          {frame >= playUntil ? <Freeze frame={playUntil - 1}>{video}</Freeze> : video}
          {label && <ActionPill label={label} x={c.x} y={c.y} canvasWidth={width} />}
          <Cursor x={c.x} y={c.y} clickT={c.clickT} />
        </AbsoluteFill>
      </AbsoluteFill>
      {title && <ChapterTitle index={index} title={title} progress={p} />}
    </AbsoluteFill>
  );
};
