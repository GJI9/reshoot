import React from 'react';
import { Composition, staticFile } from 'remotion';
import { Scene } from './Scene';
import type { Take } from './cursor-path';
import take from '../public/captures/demo.events.json';

// The recorder writes fps and viewport into the take, so the composition matches the
// recording by construction. Change the viewport in example/record.mjs and this
// follows without edits here.
const demo = take as Take;
const s = (sec: number) => Math.round(sec * demo.fps);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Demo"
      component={Scene}
      durationInFrames={s(11.5)}
      fps={demo.fps}
      width={demo.viewport.width}
      height={demo.viewport.height}
      defaultProps={{
        clip: 'captures/demo.webm',
        events: demo.events,
        index: '1',
        title: 'Submit an expense',
        // The take runs 9.2s. Freezing just before it ends and holding to 11.5s lets
        // the eye settle on the new row - a longer pause without re-recording one.
        play: s(8.9),
        // Stays at scale 1 over the table, easing to 1.35 as the cursor moves right
        // into the side panel, then holding there.
        zoom: { scale: 1.35, auto: { axis: 'x', from: 1180, to: 1460 }, followX: true, followY: true },
      }}
    />
  </>
);
