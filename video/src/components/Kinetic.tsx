import type { CSSProperties } from 'react';
import { useCurrentFrame } from 'remotion';
import { ease, pop, springs, tw } from '../lib/motion';
import { sans, stage } from '../lib/theme';

type Variant = 'rise' | 'blur' | 'slam' | 'drop' | 'wide';

type Props = {
  text: string;
  start: number;
  size?: number;
  weight?: number;
  variant?: Variant;
  stagger?: number;
  color?: string;
  accent?: string[];
  gradient?: [string, string];
  out?: number;
  outStagger?: number;
  align?: CSSProperties['textAlign'];
  tracking?: number;
  lineHeight?: number;
  font?: string;
  style?: CSSProperties;
};

/**
 * Per-character kinetic type. Each glyph springs in with its own delay; accent words
 * get a vertical gradient (uniform per glyph, so it reads as one continuous fill).
 */
export const Kinetic = ({
  text,
  start,
  size = 120,
  weight = 800,
  variant = 'rise',
  stagger = 1.6,
  color = stage.white,
  accent = [],
  gradient = ['#C7D2FE', '#A855F7'],
  out,
  outStagger = 0.8,
  align = 'center',
  tracking = -0.035,
  lineHeight = 1.02,
  font = sans,
  style,
}: Props) => {
  const f = useCurrentFrame();
  let i = 0;
  const lines = text.split('\n');

  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight,
        textAlign: align,
        color,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: 'nowrap' }}>
          {line.split(' ').map((word, wi) => {
            const bare = (w: string) => w.replace(/[.,!?]/g, '');
            const isAccent = accent.some((a) => bare(a) === bare(word));
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  overflow: variant === 'rise' ? 'hidden' : 'visible',
                  paddingBottom: variant === 'rise' ? '0.12em' : 0,
                  marginBottom: variant === 'rise' ? '-0.12em' : 0,
                  marginRight: '0.24em',
                  verticalAlign: 'top',
                }}
              >
                {[...word].map((ch, ci) => {
                  const idx = i++;
                  const at = start + idx * stagger;
                  const p = pop(f, at, variant === 'slam' ? springs.bouncy : springs.snappy);
                  const lin = tw(f, at, at + 10, 0, 1, ease.outExpo);
                  let transform = '';
                  let opacity = 1;
                  let blur = 0;
                  if (variant === 'rise') {
                    transform = `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 10}deg)`;
                    blur = (1 - lin) * 6;
                  } else if (variant === 'blur') {
                    transform = `scale(${1.5 - 0.5 * lin}) translateY(${(1 - lin) * -20}px)`;
                    opacity = lin;
                    blur = (1 - lin) * 24;
                  } else if (variant === 'slam') {
                    transform = `scale(${1.9 - 0.9 * p}) translateZ(0)`;
                    opacity = Math.min(1, lin * 2);
                    blur = (1 - lin) * 18;
                  } else if (variant === 'drop') {
                    transform = `translateY(${(1 - p) * -120}px) rotate(${(1 - p) * -18}deg)`;
                    opacity = Math.min(1, lin * 3);
                    blur = (1 - lin) * 8;
                  } else if (variant === 'wide') {
                    transform = `translateX(${(1 - lin) * (idx - 6) * 30}px)`;
                    opacity = lin;
                    blur = (1 - lin) * 14;
                  }
                  if (out !== undefined) {
                    const o = tw(f, out + idx * outStagger, out + idx * outStagger + 10, 0, 1, ease.inExpo);
                    transform += ` translateY(${-o * 70}%) scale(${1 - o * 0.2})`;
                    opacity *= 1 - o;
                    blur += o * 14;
                  }
                  if (f < at - 1) opacity = 0;
                  return (
                    <span
                      key={ci}
                      style={{
                        display: 'inline-block',
                        transform,
                        opacity,
                        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                        ...(isAccent
                          ? {
                              backgroundImage: `linear-gradient(180deg, ${gradient[0]} 10%, ${gradient[1]} 95%)`,
                              WebkitBackgroundClip: 'text',
                              backgroundClip: 'text',
                              color: 'transparent',
                            }
                          : null),
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Small mono eyebrow label with a sliding rule, e.g. "03 — SCHEMA BUILDER". */
export const Eyebrow = ({
  n,
  label,
  start,
  color = stage.white,
  out,
}: {
  n?: string;
  label: string;
  start: number;
  color?: string;
  out?: number;
}) => {
  const f = useCurrentFrame();
  const p = tw(f, start, start + 14);
  const o = out === undefined ? 0 : tw(f, out, out + 8, 0, 1, ease.inExpo);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontFamily: 'inherit',
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: '0.24em',
        color,
        opacity: p * (1 - o),
        transform: `translateX(${(1 - p) * -30 - o * 30}px)`,
      }}
    >
      {n ? <span style={{ color: stage.orange }}>{n}</span> : null}
      <span style={{ width: 60 * p, height: 2, background: 'rgba(255,255,255,0.5)' }} />
      <span>{label}</span>
    </div>
  );
};
