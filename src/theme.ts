// Every colour and font the overlay draws. Change these, re-render, done -
// no re-recording, because none of it is baked into the video.

export const theme = {
  // Letterbox behind the video. Match your app's background or the zoom edges show.
  background: '#0A0A0A',
  // Click pulses, the action pill, the chapter number chip.
  accent: '#2980D4',
  accentText: '#FFFFFF',
  titleText: '#FAFAFA',
  cursorFill: '#FFFFFF',
  cursorStroke: '#111111',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export type Theme = typeof theme;
