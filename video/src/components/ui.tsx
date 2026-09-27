import {
  IconChevronDown,
  IconChevronRight,
  IconCode,
  IconFileText,
  IconPinFilled,
} from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { useCurrentFrame } from 'remotion';
import { ease, kf, pop, springs, tw } from '../lib/motion';
import { mono, sans, stage, useTokens } from '../lib/theme';

/** Floating product surface with depth shadow and a coloured under-glow. */
export const Panel = ({
  children,
  w,
  h,
  glow = stage.indigo,
  style,
  radius = 20,
}: {
  children: ReactNode;
  w?: number;
  h?: number;
  glow?: string;
  style?: CSSProperties;
  radius?: number;
}) => {
  const t = useTokens();
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: radius,
        boxShadow: `0 40px 120px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), 0 30px 140px -40px ${glow}`,
        fontFamily: sans,
        color: t.text,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Btn = ({
  children,
  variant = 'primary',
  press = 0,
  size = 24,
  style,
}: {
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  press?: number;
  size?: number;
  style?: CSSProperties;
}) => {
  const t = useTokens();
  const bg = variant === 'primary' ? t.primary : variant === 'outline' ? t.card : 'transparent';
  const fg = variant === 'primary' ? t.primaryText : t.text;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * 0.4,
        padding: `${size * 0.45}px ${size * 0.8}px`,
        borderRadius: size * 0.42,
        background: bg,
        color: fg,
        border: variant === 'outline' ? `1px solid ${t.border}` : '1px solid transparent',
        fontSize: size,
        fontWeight: 600,
        transform: `scale(${1 - press * 0.08})`,
        boxShadow: press > 0 ? `0 0 0 ${press * 6}px rgba(99,102,241,${press * 0.35})` : undefined,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Click squish curve for a button pressed at frame `at`. */
export const pressAt = (f: number, at: number) => kf(f, [at - 3, at, at + 6], [0, 1, 0]);

export const Badge = ({
  kind,
  size = 18,
  style,
}: {
  kind: 'draft' | 'published' | 'live' | 'baseline' | 'enterprise';
  size?: number;
  style?: CSSProperties;
}) => {
  const t = useTokens();
  const map = {
    draft: { bg: 'rgba(245,158,11,0.14)', fg: '#F59E0B', label: 'Draft', bd: 'rgba(245,158,11,0.35)' },
    published: { bg: t.primary, fg: t.primaryText, label: 'Published', bd: 'transparent' },
    live: { bg: 'rgba(16,185,129,0.14)', fg: '#10B981', label: '● Live', bd: 'rgba(16,185,129,0.4)' },
    baseline: { bg: 'rgba(99,102,241,0.16)', fg: '#A5B4FC', label: 'Baseline', bd: 'rgba(99,102,241,0.4)' },
    enterprise: { bg: 'rgba(245,158,11,0.15)', fg: '#F59E0B', label: 'ENTERPRISE', bd: 'transparent' },
  }[kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${size * 0.15}px ${size * 0.55}px`,
        borderRadius: 999,
        fontSize: size,
        fontWeight: 600,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {map.label}
    </span>
  );
};

/** `${variable}` highlight, with an optional ignite glow at frame `at`. */
export const Var = ({ name, at, style }: { name: string; at?: number; style?: CSSProperties }) => {
  const t = useTokens();
  const f = useCurrentFrame();
  const g = at === undefined ? 0 : kf(f, [at, at + 4, at + 22], [0, 1, 0.25]);
  const on = at === undefined ? 1 : tw(f, at, at + 6);
  return (
    <span
      style={{
        color: on > 0.5 ? t.variable : t.text,
        textShadow: g > 0 ? `0 0 ${18 * g}px ${t.variable}, 0 0 ${4 * g}px ${t.variable}` : undefined,
        borderRadius: 6,
        background: g > 0 ? `rgba(245,165,36,${0.18 * g})` : undefined,
        ...style,
      }}
    >
      {'${'}
      {name}
      {'}'}
    </span>
  );
};

/** Composer variable badge. */
export const VarChip = ({ name, size = 20, style }: { name: string; size?: number; style?: CSSProperties }) => {
  const t = useTokens();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.3,
        padding: `${size * 0.12}px ${size * 0.5}px`,
        borderRadius: 999,
        background: t.varBg,
        border: `1px solid ${t.mode === 'dark' ? 'rgba(234,88,12,0.45)' : 'rgba(234,88,12,0.3)'}`,
        color: t.mode === 'dark' ? '#FB923C' : '#EA580C',
        fontSize: size,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <IconCode size={size * 0.9} stroke={2.2} />
      {name}
    </span>
  );
};

/** Composer prompt-reference badge, optionally pinned to a version. */
export const RefChip = ({
  name,
  size = 20,
  pin,
  pinP = 1,
  style,
}: {
  name: string;
  size?: number;
  pin?: string;
  pinP?: number;
  style?: CSSProperties;
}) => {
  const t = useTokens();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.35,
        padding: `${size * 0.15}px ${size * 0.5}px`,
        borderRadius: size * 0.45,
        background: t.refBg,
        border: `1px solid ${t.mode === 'dark' ? 'rgba(59,130,246,0.45)' : 'rgba(37,99,235,0.3)'}`,
        color: t.ref,
        fontSize: size,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      <IconFileText size={size * 0.9} stroke={2} />
      {name}
      {pin ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: mono,
            fontSize: size * 0.72,
            padding: `2px ${size * 0.35}px`,
            borderRadius: 999,
            background: t.ref,
            color: t.mode === 'dark' ? '#0A0A0A' : '#fff',
            transform: `scale(${pinP})`,
            opacity: Math.min(1, pinP * 2),
            maxWidth: pinP * 120,
            overflow: 'hidden',
          }}
        >
          <IconPinFilled size={size * 0.65} />
          {pin}
        </span>
      ) : null}
      <span style={{ width: 1, alignSelf: 'stretch', background: 'currentColor', opacity: 0.35 }} />
      <IconChevronDown size={size * 0.8} stroke={2} />
    </span>
  );
};

export const Caret = ({ color, h = 1 }: { color?: string; h?: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  return (
    <span
      style={{
        display: 'inline-block',
        width: 3,
        height: `${h}em`,
        marginLeft: 2,
        verticalAlign: 'text-bottom',
        background: color ?? t.text,
        opacity: Math.floor(f / 8) % 2 === 0 ? 1 : 0,
      }}
    />
  );
};

/** Animated gradient sweep over text, for "Running…" / "Thinking…" states. */
export const Shimmer = ({ children, size = 22 }: { children: ReactNode; size?: number }) => {
  const f = useCurrentFrame();
  const t = useTokens();
  const x = ((f * 4) % 300) - 100;
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 500,
        backgroundImage: `linear-gradient(90deg, ${t.subtle} ${x - 30}%, ${t.text} ${x}%, ${t.subtle} ${x + 30}%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      {children}
    </span>
  );
};

/** Sidebar accordion header, e.g. "Schema Builder  >". */
export const SectionHead = ({ label, open, size = 24 }: { label: string; open?: boolean; size?: number }) => {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${size * 0.7}px ${size}px`,
        fontSize: size,
        fontWeight: 600,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      {label}
      {open ? <IconChevronDown size={size} /> : <IconChevronRight size={size} />}
    </div>
  );
};

/** JSON input tree in the app's style. Values in orange, keys muted. */
export const JsonTree = ({
  rows,
  size = 18,
  reveal = 1,
}: {
  rows: [string, string | null, number?][];
  size?: number;
  reveal?: number;
}) => {
  const t = useTokens();
  return (
    <div style={{ fontFamily: sans, fontSize: size, lineHeight: 1.7 }}>
      {rows.map(([k, v, indent = 1], i) => {
        const p = Math.min(1, Math.max(0, reveal * rows.length - i));
        return (
          <div
            key={i}
            style={{
              paddingLeft: indent * size * 1.1,
              opacity: p,
              transform: `translateX(${(1 - p) * -14}px)`,
              color: t.muted,
              whiteSpace: 'nowrap',
            }}
          >
            {k}
            {v !== null ? <span style={{ color: t.mode === 'dark' ? '#FB923C' : '#EA580C', marginLeft: 10 }}>{v}</span> : null}
          </div>
        );
      })}
    </div>
  );
};

export const INPUT_ROWS: [string, string | null, number?][] = [
  ['root: {  4 items', null, 0],
  ['product_name:', '"Aurora Smart Desk Lamp"'],
  ['features: [  3 items  ]', null],
  ['audience:', '"Remote workers"'],
  ['tone:', '"premium"'],
  ['}', null, 0],
];

/** Keyboard key with a press animation. */
export const Kbd = ({ children, at, size = 64 }: { children: ReactNode; at: number; size?: number }) => {
  const f = useCurrentFrame();
  const p = pop(f, at - 10, springs.bouncy);
  const press = kf(f, [at - 2, at, at + 6], [0, 1, 0]);
  return (
    <div
      style={{
        width: size * 1.1,
        height: size,
        borderRadius: size * 0.22,
        background: 'linear-gradient(180deg, #2A2A2E, #18181B)',
        border: '1px solid #3F3F46',
        boxShadow: `0 ${8 - press * 6}px 0 #0B0B0D, 0 ${14 - press * 8}px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: stage.white,
        fontFamily: sans,
        fontSize: size * 0.5,
        fontWeight: 600,
        transform: `translateY(${press * 6}px) scale(${p})`,
      }}
    >
      {children}
    </div>
  );
};

/** Line-by-line text reveal where each line wipes in with a blur trail. */
export const StreamText = ({
  text,
  start,
  cps = 90,
  size = 20,
  lineHeight = 1.55,
  style,
  mdHeadings = true,
}: {
  text: string;
  start: number;
  cps?: number;
  size?: number;
  lineHeight?: number;
  style?: CSSProperties;
  mdHeadings?: boolean;
}) => {
  const f = useCurrentFrame();
  const t = useTokens();
  const shown = Math.max(0, Math.floor(((f - start) / 30) * cps));
  let used = 0;
  return (
    <div style={{ fontSize: size, lineHeight, color: t.text, ...style }}>
      {text.split('\n').map((line, i) => {
        const vis = line.slice(0, Math.max(0, shown - used));
        const done = shown - used >= line.length;
        used += line.length + 1;
        if (!vis && line) return null;
        if (!line) return <div key={i} style={{ height: size * 0.6 }} />;
        const h1 = mdHeadings && line.startsWith('# ');
        const bold = mdHeadings && line.startsWith('**');
        const bullet = mdHeadings && line.startsWith('- ');
        const clean = vis.replace(/^# /, '').replace(/\*\*/g, '').replace(/^- /, '');
        return (
          <div
            key={i}
            style={{
              fontSize: h1 ? size * 1.5 : size,
              fontWeight: h1 ? 800 : bold ? 700 : 400,
              letterSpacing: h1 ? '-0.02em' : undefined,
              marginBottom: h1 ? size * 0.3 : 0,
              display: 'flex',
              gap: 10,
            }}
          >
            {bullet ? <span style={{ color: stage.indigo }}>•</span> : null}
            <span>
              {clean}
              {!done ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: size * 0.55,
                    height: size * 0.95,
                    marginLeft: 3,
                    verticalAlign: 'text-bottom',
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${stage.indigo}, ${stage.pink})`,
                    boxShadow: `0 0 16px ${stage.violet}`,
                  }}
                />
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** Reveal helper for staggered list entrance: returns a style for item i. */
export const stag = (f: number, start: number, i: number, gap = 3, dist = 40) => {
  const p = pop(f, start + i * gap, springs.snappy);
  const o = tw(f, start + i * gap, start + i * gap + 8, 0, 1, ease.outQuint);
  return {
    transform: `translateY(${(1 - p) * dist}px) scale(${0.96 + p * 0.04})`,
    opacity: o,
  } as CSSProperties;
};
