import { Easing, interpolate, spring } from 'remotion';
import { FPS } from './theme';

/** Seconds → frames. The whole edit is timed in seconds against the 120 BPM track. */
export const s = (sec: number) => Math.round(sec * FPS);
/** One beat at 120 BPM. */
export const BEAT = FPS / 2;

export const ease = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outQuint: Easing.bezier(0.22, 1, 0.36, 1),
  inOutExpo: Easing.bezier(0.87, 0, 0.13, 1),
  inOutCubic: Easing.bezier(0.65, 0, 0.35, 1),
  inExpo: Easing.bezier(0.7, 0, 0.84, 0),
  inQuad: Easing.bezier(0.11, 0, 0.5, 0),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  anticipate: Easing.bezier(0.36, -0.4, 0.3, 1.2),
  linear: Easing.linear,
};

/** Clamped interpolate between two frames. */
export const tw = (
  frame: number,
  from: number,
  to: number,
  a = 0,
  b = 1,
  easing: (t: number) => number = ease.outExpo,
) =>
  interpolate(frame, [from, to], [a, b], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

/** Multi-stop clamped interpolate. */
export const kf = (
  frame: number,
  input: number[],
  output: number[],
  easing: (t: number) => number = ease.inOutCubic,
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const springs = {
  snappy: { damping: 14, stiffness: 230, mass: 0.7 },
  bouncy: { damping: 9, stiffness: 170, mass: 0.8 },
  jelly: { damping: 7, stiffness: 120, mass: 0.9 },
  smooth: { damping: 26, stiffness: 120, mass: 1 },
  heavy: { damping: 16, stiffness: 90, mass: 1.6 },
};

export const pop = (
  frame: number,
  start: number,
  config: Partial<typeof springs.snappy> = springs.snappy,
) => spring({ frame: frame - start, fps: FPS, config });

/** Decaying pulse that fires at `at` — for beat bumps, flashes and hit reactions. */
export const pulse = (frame: number, at: number, decay = 6) => {
  const d = frame - at;
  return d < 0 ? 0 : Math.exp(-d / decay);
};

/** Sum of pulses on every beat in [from, to). */
export const beatPulse = (
  frame: number,
  from: number,
  to: number,
  every = BEAT,
  decay = 5,
) => {
  if (frame < from || frame >= to + decay * 4) return 0;
  const n = Math.floor((Math.min(frame, to - 1) - from) / every);
  const at = from + n * every;
  return pulse(frame, at, decay);
};

/** Characters revealed for a typewriter effect. */
export const typed = (text: string, frame: number, start: number, cps = 30) =>
  text.slice(0, Math.max(0, Math.floor(((frame - start) / FPS) * cps)));

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
