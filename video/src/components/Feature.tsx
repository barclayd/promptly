import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { pop, springs, tw } from '../lib/motion';
import { mono, stage, useTokens } from '../lib/theme';
import { Float } from './Fx';
import { Eyebrow, Kinetic } from './Kinetic';

/**
 * Montage layout: copy on one side, a floating product panel on the other.
 * The panel springs up out of perspective so every shot opens with motion.
 */
export const Feature = ({
  side = 'right',
  n,
  label,
  title,
  accent = [],
  grad,
  sub,
  children,
  size = 88,
}: {
  side?: 'left' | 'right';
  n: string;
  label: string;
  title: string;
  accent?: string[];
  grad?: [string, string];
  sub?: string;
  children: ReactNode;
  size?: number;
}) => {
  const f = useCurrentFrame();
  const p = pop(f, 0, springs.bouncy);
  const right = side === 'right';
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: right ? 150 : 1110,
          top: 540,
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
        }}
      >
        <Eyebrow n={n} label={label} start={1} />
        <Kinetic text={title} start={2} size={size} variant="rise" align="left" accent={accent} gradient={grad} stagger={0.8} />
        {sub ? (
          <Kinetic
            text={sub}
            start={9}
            size={30}
            weight={500}
            variant="blur"
            align="left"
            color={stage.dim}
            stagger={0.3}
            tracking={-0.01}
            lineHeight={1.35}
          />
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: right ? 1330 : 590,
          top: 540,
          transform: `translate(-50%, -50%) translateY(${(1 - p) * 160}px) scale(${0.88 + 0.12 * p})`,
          opacity: tw(f, 0, 6),
        }}
      >
        <Float ry={right ? -12 : 12} rx={6}>
          {children}
        </Float>
      </div>
    </AbsoluteFill>
  );
};

/** Text input in the app's style, with an optional focus ring. */
export const Field = ({
  label,
  children,
  focus = 0,
  mono: isMono,
  style,
}: {
  label?: string;
  children: ReactNode;
  focus?: number;
  mono?: boolean;
  style?: CSSProperties;
}) => {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {label ? <span style={{ fontSize: 18, fontWeight: 600 }}>{label}</span> : null}
      <div
        style={{
          minHeight: 54,
          padding: '12px 18px',
          borderRadius: 12,
          border: `1px solid ${focus > 0.5 ? stage.indigo : t.border}`,
          background: t.input,
          boxShadow: focus > 0 ? `0 0 0 ${4 * focus}px rgba(99,102,241,0.25)` : undefined,
          fontSize: 22,
          fontFamily: isMono ? mono : undefined,
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </div>
    </div>
  );
};
