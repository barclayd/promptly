import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { ease, kf, pulse, tw } from '../lib/motion';
import { stage } from '../lib/theme';

/** Radial particle burst: sparks with drag + gravity, stretched along velocity. */
export const Burst = ({
  x,
  y,
  at,
  count = 36,
  speed = 26,
  colors = [stage.white, stage.indigo, stage.pink, stage.orange],
  seed = 'b',
  life = 34,
  size = 5,
}: {
  x: number;
  y: number;
  at: number;
  count?: number;
  speed?: number;
  colors?: string[];
  seed?: string;
  life?: number;
  size?: number;
}) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0 || t > life) return null;
  return (
    <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width="100%" height="100%">
      {Array.from({ length: count }, (_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const v = speed * (0.35 + random(`${seed}v${i}`) * 0.9);
        const drag = 0.9;
        // Closed-form position under exponential drag.
        const d = (v * (1 - drag ** t)) / (1 - drag);
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d + 0.05 * t * t;
        const vel = v * drag ** t;
        const len = Math.max(1, vel * 1.4);
        const r = size * (0.5 + random(`${seed}s${i}`)) * (1 - t / life);
        const c = colors[i % colors.length];
        return (
          <line
            key={i}
            x1={px}
            y1={py}
            x2={px - Math.cos(a) * len}
            y2={py - Math.sin(a) * len}
            stroke={c}
            strokeWidth={r}
            strokeLinecap="round"
            opacity={1 - (t / life) ** 2}
          />
        );
      })}
    </svg>
  );
};

/** Expanding ring shockwave. */
export const Shockwave = ({
  x,
  y,
  at,
  size = 900,
  color = 'rgba(199,210,254,0.9)',
  dur = 22,
  width = 6,
}: {
  x: number;
  y: number;
  at: number;
  size?: number;
  color?: string;
  dur?: number;
  width?: number;
}) => {
  const f = useCurrentFrame();
  const p = tw(f, at, at + dur, 0, 1, ease.outExpo);
  if (f < at || p >= 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${width * (1 - p) + 0.5}px solid ${color}`,
        transform: `scale(${0.05 + p})`,
        opacity: 1 - p,
        boxShadow: `0 0 60px ${color}, inset 0 0 60px ${color}`,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Full-frame flash. */
export const Flash = ({ at, decay = 5, color = '#fff', max = 0.9 }: { at: number; decay?: number; color?: string; max?: number }) => {
  const f = useCurrentFrame();
  const o = pulse(f, at, decay) * max;
  if (o < 0.01) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none', mixBlendMode: 'screen' }} />;
};

/** Paper confetti with flutter. */
export const Confetti = ({
  x,
  y,
  at,
  count = 60,
  seed = 'c',
  spread = 1,
}: {
  x: number;
  y: number;
  at: number;
  count?: number;
  seed?: string;
  spread?: number;
}) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0 || t > 70) return null;
  const colors = [stage.orange, stage.indigo, stage.pink, stage.cyan, stage.green, '#FDE68A'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const a = -Math.PI / 2 + (random(`${seed}a${i}`) - 0.5) * 2.2 * spread;
        const v = 18 + random(`${seed}v${i}`) * 26;
        const drag = 0.92;
        const d = (v * (1 - drag ** t)) / (1 - drag);
        const px = x + Math.cos(a) * d + Math.sin(t * 0.25 + i) * 10;
        const py = y + Math.sin(a) * d + 0.35 * t * t * 0.5;
        const rot = t * (8 + random(`${seed}r${i}`) * 14) * (i % 2 ? 1 : -1);
        const flip = Math.abs(Math.cos(t * 0.3 + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: 10,
              height: 16,
              borderRadius: 2,
              background: colors[i % colors.length],
              transform: `rotate(${rot}deg) scaleX(${flip})`,
              opacity: kf(t, [0, 50, 70], [1, 1, 0]),
            }}
          />
        );
      })}
    </div>
  );
};

/** Four-point twinkles, e.g. around a success state. */
export const Sparkles = ({ items, at }: { items: { x: number; y: number; s?: number; d?: number }[]; at: number }) => {
  const f = useCurrentFrame();
  return (
    <>
      {items.map((it, i) => {
        const st = at + (it.d ?? i * 3);
        const p = kf(f, [st, st + 8, st + 22], [0, 1, 0], ease.outQuint);
        if (p <= 0) return null;
        const sz = 28 * (it.s ?? 1) * p;
        return (
          <svg
            key={i}
            width={sz}
            height={sz}
            viewBox="0 0 24 24"
            style={{ position: 'absolute', left: it.x - sz / 2, top: it.y - sz / 2, transform: `rotate(${p * 90}deg)` }}
          >
            <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill="#fff" />
          </svg>
        );
      })}
    </>
  );
};

type Move = 'whipL' | 'whipR' | 'zoomIn' | 'zoomOut' | 'rise' | 'drop' | 'flip' | 'fade' | 'none';

const moveStyle = (m: Move, p: number, dir: 1 | -1): { t: string; blur: number; o: number } => {
  // p: 0 = fully hidden, 1 = settled. dir flips the travel direction for exits.
  const q = 1 - p;
  switch (m) {
    case 'whipL':
      return { t: `translateX(${q * 1400 * dir}px) skewX(${q * -12 * dir}deg)`, blur: q * 40, o: 1 };
    case 'whipR':
      return { t: `translateX(${-q * 1400 * dir}px) skewX(${q * 12 * dir}deg)`, blur: q * 40, o: 1 };
    case 'zoomIn':
      return { t: `scale(${dir === 1 ? 0.55 + p * 0.45 : 1 + q * 1.8})`, blur: q * 30, o: p };
    case 'zoomOut':
      return { t: `scale(${dir === 1 ? 1 + q * 1.6 : 1 - q * 0.45})`, blur: q * 30, o: p };
    case 'rise':
      return { t: `translateY(${q * 500 * dir}px) rotateX(${q * 30 * dir}deg)`, blur: q * 18, o: p };
    case 'drop':
      return { t: `translateY(${-q * 500 * dir}px)`, blur: q * 18, o: p };
    case 'flip':
      return { t: `rotateY(${q * 90 * dir}deg) scale(${1 - q * 0.2})`, blur: q * 6, o: p > 0.02 ? 1 : 0 };
    case 'fade':
      return { t: '', blur: q * 10, o: p };
    default:
      return { t: '', blur: 0, o: 1 };
  }
};

/**
 * A shot inside a Sequence: handles its own entrance and exit, with an optional slow
 * camera push so nothing ever sits perfectly still.
 */
export const Shot = ({
  children,
  dur,
  enter = 'zoomIn',
  exit = 'zoomOut',
  inLen = 10,
  outLen = 8,
  push = 0.04,
  style,
}: {
  children: ReactNode;
  dur: number;
  enter?: Move;
  exit?: Move;
  inLen?: number;
  outLen?: number;
  push?: number;
  style?: CSSProperties;
}) => {
  const f = useCurrentFrame();
  const pin = tw(f, 0, inLen, 0, 1, ease.outExpo);
  const pout = tw(f, dur - outLen, dur, 1, 0, ease.inExpo);
  const a = moveStyle(enter, pin, 1);
  const b = f > dur - outLen ? moveStyle(exit, pout, -1) : { t: '', blur: 0, o: 1 };
  const scale = 1 + push * (f / Math.max(1, dur));
  const blur = a.blur + b.blur;
  return (
    <AbsoluteFill
      style={{
        perspective: 2000,
        transform: `${a.t} ${b.t} scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
        opacity: a.o * b.o,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Slow 3D float for UI panels: slight tilt that drifts over time. */
export const Float = ({
  children,
  rx = 8,
  ry = -14,
  drift = 1,
  style,
}: {
  children: ReactNode;
  rx?: number;
  ry?: number;
  drift?: number;
  style?: CSSProperties;
}) => {
  const f = useCurrentFrame();
  const t = f / 30;
  return (
    <div
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(2200px) rotateX(${rx + Math.sin(t * 0.8) * 1.5 * drift}deg) rotateY(${ry + Math.cos(t * 0.6) * 2 * drift}deg) translateY(${Math.sin(t * 1.1) * 8 * drift}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
