import React from 'react';
import { interpolate } from 'remotion';
import { theme } from './theme';

// A small pill pinned next to the cursor saying what is happening right now.
// Flips to the left of the cursor near the right edge so it never clips off frame.
export const ActionPill: React.FC<{
  label: string;
  x: number;
  y: number;
  canvasWidth: number;
}> = ({ label, x, y, canvasWidth }) => {
  const flip = x > canvasWidth - 490;
  return (
    <div
      style={{
        position: 'absolute',
        ...(flip ? { right: canvasWidth - x + 26 } : { left: x + 26 }),
        top: y + 16,
        background: theme.accent,
        color: theme.accentText,
        fontFamily: theme.font,
        fontSize: 20,
        fontWeight: 600,
        padding: '7px 14px',
        borderRadius: 10,
        boxShadow: `0 6px 18px ${theme.accent}66`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
};

// Lower-third chapter title. `progress` is 0..1 across the scene; the title fades
// in at the head and out at the tail on its own.
export const ChapterTitle: React.FC<{
  index?: string;
  title: string;
  progress: number;
}> = ({ index, title, progress }) => {
  const opacity = interpolate(progress, [0, 0.06, 0.9, 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slide = interpolate(progress, [0, 0.06], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 72,
        bottom: 84,
        opacity,
        transform: `translateY(${slide}px)`,
        fontFamily: theme.font,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          background: 'rgba(10,10,10,0.72)',
          backdropFilter: 'blur(8px)',
          borderRadius: 16,
          padding: '16px 24px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {index && (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: theme.accent,
              color: theme.accentText,
              fontWeight: 800,
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {index}
          </div>
        )}
        <span style={{ color: theme.titleText, fontSize: 30, fontWeight: 700, letterSpacing: -0.3 }}>
          {title}
        </span>
      </div>
    </div>
  );
};
