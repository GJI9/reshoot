import React from 'react';
import { AbsoluteFill } from 'remotion';
import { theme } from './theme';

// The synthetic cursor and its click pulse. Coordinates are video pixels, which
// equal the CSS pixels the recorder logged - see the viewport contract in
// record/recorder.mjs.
export const Cursor: React.FC<{ x: number; y: number; clickT: number; size?: number }> = ({
  x,
  y,
  clickT,
  size = 34,
}) => {
  const pulsing = clickT >= 0;
  // Ring expands over the first 500ms of a click and fades as it grows.
  const p = pulsing ? Math.min(clickT / 0.5, 1) : 0;
  const r = 14 + p * 46;
  const opacity = pulsing ? (1 - p) * 0.55 : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {pulsing && (
        <div
          style={{
            position: 'absolute',
            left: x - r,
            top: y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: `3px solid ${theme.accent}`,
            opacity,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
          transform: pulsing ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        <path
          d="M4 2 L4 20 L9 15 L12.5 22 L15 21 L11.5 14 L18 14 Z"
          fill={theme.cursorFill}
          stroke={theme.cursorStroke}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </AbsoluteFill>
  );
};
